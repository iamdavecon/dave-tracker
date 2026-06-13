import * as state from "../public/utils/state.js";
import { DAVE_RAVE_MIN_PLAYERS, DAVE_RAVE_RADIUS_METERS } from "../public/utils/raves.js";
import { getMapData } from "../public/utils/map.js"
import { haversineDistance, inRange } from "../public/utils/distance.js";
import { getFirstItemDefinition } from "../public/utils/itemUI.js";
import { DAVE_TANGENT_NAME, GOON_NAME } from "./bots.js";

const TACO_ITEM = "🌮";
const BABY_ITEM = "👶";
export const BLACK_BADGE_RAFFLE_ITEM = "🎟️";
export const DAVE_RAVE_COOLDOWN = 60 * 60 * 1000;
const VIRUS_INFLUENCE_BY_STATE = {
	infected: 1,
	corrupted: 2
};
const DAVECON_CONTROL_BY_STATE = {
	resonant: 1,
	ascended: 2,
	dope: 3
};

function hasClaimedGoonRaffle(dave, goonId) {
	return Array.isArray(dave?.claimedGoonRaffles) && dave.claimedGoonRaffles.includes(goonId);
}

function getDisplayTags(dave, places = {}) {
	const tags = Array.isArray(dave.tags)
		? dave.tags.filter(tag => !state.isTerritoryTag(tag))
		: [];
	const rank = state.getTerritoryRank(state.getTerritoryScore(dave, places), state.getDavePointUpgradeCount(dave));

	if (rank) {
		tags.unshift(rank.tag);
	}

	return tags;
}

function countAcquiredItems(dave) {
	return Object.values(dave ?? {}).reduce((total, value) => {
		if (value && Number.isFinite(value.count)) {
			return total + value.count;
		}

		return total;
	}, 0);
}

export function summarizeDave(dave, places = {}) {
	let score = 0;
	const currentState = state.getState(dave);
	let teamVirus = VIRUS_INFLUENCE_BY_STATE[currentState] ?? 0;
	let teamAntivirus = DAVECON_CONTROL_BY_STATE[currentState] ?? 0;
	const tags = getDisplayTags(dave, places);

	score = teamVirus + (teamAntivirus * 2); 
	if (dave.daveravesStarted) {
		score += (dave.daveravesStarted * 2);
	}
	if (Array.isArray(dave.linkedDaves)) {
		score += (dave.linkedDaves.length * 5);
	}
	score += countAcquiredItems(dave);
	score += tags.length * 2;

	let daveDetails = {
		userId: dave.userId,
		name: dave.name,  
		score: score,
		teamVirus: teamVirus,
		teamAntivirus: teamAntivirus,
		daveravesStarted: dave.daveravesStarted || 0,
		state: currentState.toUpperCase(),
		tags,
		badgeStatus: dave.badgeStatus ?? null
	};

	return daveDetails;
}

export function getLinkedDaveSummaries(dave, allDaves = {}) {
	const linkedIds = Array.isArray(dave?.linkedDaves) ? dave.linkedDaves : [];

	return linkedIds
		.map((id) => allDaves[id])
		.filter(Boolean)
		.map((linkedDave) => ({
			userId: linkedDave.userId,
			name: linkedDave.name,
			state: state.getState(linkedDave).toUpperCase()
		}));
}

export function countDavesInArea(me, allDaves = {}) {
	return getDavesInArea(me, allDaves).length;
}

export function getDavesInArea(me, allDaves = {}) {
	if (!me || !Number.isFinite(me.lat) || !Number.isFinite(me.lng)) {
		return [];
	}

	return Object.values(allDaves).filter((dave) => {
		if (!dave || dave.isBot || dave.visible === false || !Number.isFinite(dave.lat) || !Number.isFinite(dave.lng)) {
			return false;
		}

		return dave.userId === me.userId || haversineDistance(me, dave) < DAVE_RAVE_RADIUS_METERS;
	});
}

export function getDaveRaveDebug(me, allDaves = {}) {
	if (!me || !Number.isFinite(me.lat) || !Number.isFinite(me.lng)) {
		return {
			eligibleDaves: [],
			excludedDaves: []
		};
	}

	const eligibleDaves = [];
	const excludedDaves = [];

	for (const dave of Object.values(allDaves)) {
		if (!dave) {
			continue;
		}

		if (dave.isBot || dave.visible === false) {
			if (Number.isFinite(dave.lat) && Number.isFinite(dave.lng)) {
				const distanceMeters = Math.round(haversineDistance(me, dave));
				if (distanceMeters < DAVE_RAVE_RADIUS_METERS) {
					excludedDaves.push({
						userId: dave.userId,
						name: dave.name ?? dave.userId,
						reason: dave.isBot ? "bot" : "invisible",
						distanceMeters
					});
				}
			}
			continue;
		}

		if (!Number.isFinite(dave.lat) || !Number.isFinite(dave.lng)) {
			excludedDaves.push({
				userId: dave.userId,
				name: dave.name ?? dave.userId,
				reason: "missing-coordinates"
			});
			continue;
		}

		const distanceMeters = dave.userId === me.userId ? 0 : Math.round(haversineDistance(me, dave));
		if (dave.userId === me.userId || distanceMeters < DAVE_RAVE_RADIUS_METERS) {
			eligibleDaves.push({
				userId: dave.userId,
				name: dave.name ?? dave.userId,
				distanceMeters
			});
		} else if (distanceMeters < DAVE_RAVE_RADIUS_METERS + 100) {
			excludedDaves.push({
				userId: dave.userId,
				name: dave.name ?? dave.userId,
				reason: "outside-radius",
				distanceMeters
			});
		}
	}

	return {
		eligibleDaves,
		excludedDaves
	};
}

export function canStartDaveRave(me, allDaves = {}) {
	return countDavesInArea(me, allDaves) >= DAVE_RAVE_MIN_PLAYERS && getDaveRaveCooldownRemaining(me) === 0;
}

export function getDaveRaveCooldownRemaining(dave) {
	if (!Number.isFinite(dave?.lastDaveRaveTime)) {
		return 0;
	}

	return Math.max(0, dave.lastDaveRaveTime + DAVE_RAVE_COOLDOWN - Date.now());
}

export function getInteraction(me, dave, allDaves = {}, places = {}) {
	state.syncTerritoryRank(me, places);
	state.syncTerritoryRank(dave, places);
	let daveDetails = { ...dave };
	daveDetails.state = state.getState(dave);
	daveDetails.isMe = me.userId === dave.userId;
	daveDetails.availableActions = state.getUserActions(me, dave);
	if (dave.isBot && dave.name === GOON_NAME) {
		daveDetails.availableActions.canInfect = false;
	}
	const firstItem = !daveDetails.isMe ? getFirstItemDefinition(dave.name) : null;
	daveDetails.availableActions.firstItem = firstItem
		? {
			item: firstItem.item,
			getLabel: firstItem.getLabel
		}
		: null;
	daveDetails.availableActions.canGetFirstItem = !!firstItem && state.canGet(me, firstItem.item);
	daveDetails.availableActions.firstItemCooldownRemaining = firstItem
		? state.getCooldownRemaining(me, firstItem.item)
		: 0;
	daveDetails.availableActions.hasBaby = !daveDetails.isMe && state.getAmt(dave, BABY_ITEM) > 0;
	daveDetails.availableActions.canReceiveBaby = daveDetails.availableActions.hasBaby && !dave.isBot && inRange(me, dave);
	daveDetails.availableActions.canEatTaco = daveDetails.isMe && state.getAmt(me, TACO_ITEM) > 0;
	daveDetails.availableActions.canIntroduceDaveTangent = !daveDetails.isMe
		&& dave.isBot
		&& dave.name === DAVE_TANGENT_NAME
		&& !state.hasTag(me, "DT")
		&& inRange(me, dave);
	daveDetails.availableActions.canClaimGoonRaffle = !daveDetails.isMe
		&& dave.isBot
		&& dave.name === GOON_NAME
		&& !hasClaimedGoonRaffle(me, dave.userId)
		&& inRange(me, dave);
	daveDetails.availableActions.tacoRangeBoostRemaining = Number.isFinite(me?.tacoRangeBoostUntil)
		? Math.max(0, me.tacoRangeBoostUntil - Date.now())
		: 0;
	const daveRaveDebug = getDaveRaveDebug(me, allDaves);
	daveDetails.availableActions.davesInArea = daveRaveDebug.eligibleDaves.length;
	daveDetails.availableActions.daveRaveEligibleDaves = daveRaveDebug.eligibleDaves;
	daveDetails.availableActions.daveRaveExcludedDaves = daveRaveDebug.excludedDaves;
	daveDetails.availableActions.daveRaveCooldownRemaining = getDaveRaveCooldownRemaining(me);
	daveDetails.availableActions.canStartDaveRave = daveDetails.isMe && canStartDaveRave(me, allDaves);
	daveDetails.linkedDaves = daveDetails.isMe ? getLinkedDaveSummaries(dave, allDaves) : [];

	daveDetails.mapData = getMapData(me, dave);

	return daveDetails;
}

export function removeFragment(dave) {
	if (dave.fragmentsCollected) {
		dave.fragmentsCollected.shift();
	}

}
