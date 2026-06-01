import * as state from "../public/utils/state.js";
import { getMapData } from "../public/utils/map.js"
import { inRange } from "../public/utils/distance.js";

const PEPPER_ITEM = "🌶️";
const PEPPER_RE = /🌶️?/u;
const DAVE_RAVE_MIN_PLAYERS = 11;
export const DAVE_RAVE_COOLDOWN = 60 * 60 * 1000;

function getDisplayTags(dave, places = {}) {
	const tags = Array.isArray(dave.tags)
		? dave.tags.filter(tag => !state.isTerritoryTag(tag))
		: [];
	const rank = state.getTerritoryRank(state.getTerritoryScore(dave, places));

	if (rank) {
		tags.unshift(rank.tag);
	}

	return tags;
}

export function summarizeDave(dave, places = {}) {
	let score = 0;
	let teamVirus = 0;
	let teamAntivirus = 0;

	if (dave.infectedUsers) {
		teamVirus += dave.infectedUsers.length; 
	}
	if (dave.fragmentsCollected) {
		teamAntivirus += dave.fragmentsCollected.length;
	}
	if (dave.nodeCount) {
		teamAntivirus += (dave.nodeCount * 5);
	}
	score = teamVirus + (teamAntivirus * 2); 
	if (dave.daveravesStarted) {
		score += (dave.daveravesStarted * 10);
	}

	let daveDetails = {
		userId: dave.userId,
		name: dave.name,  
		score: score,
		teamVirus: teamVirus,
		teamAntivirus: teamAntivirus,
		state: state.getState(dave).toUpperCase(),
		tags: getDisplayTags(dave, places)
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
	if (!me || !Number.isFinite(me.lat) || !Number.isFinite(me.lng)) {
		return 0;
	}

	return Object.values(allDaves).filter((dave) => {
		if (!dave || dave.isBot || !Number.isFinite(dave.lat) || !Number.isFinite(dave.lng)) {
			return false;
		}

		return dave.userId === me.userId || inRange(me, dave);
	}).length;
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
	daveDetails.availableActions.hasPepper = !daveDetails.isMe && PEPPER_RE.test(dave.name ?? "");
	daveDetails.availableActions.canGetPepper = daveDetails.availableActions.hasPepper && state.canGet(me, PEPPER_ITEM);
	daveDetails.availableActions.pepperCooldownRemaining = daveDetails.availableActions.hasPepper
		? state.getCooldownRemaining(me, PEPPER_ITEM)
		: 0;
	daveDetails.availableActions.davesInArea = countDavesInArea(me, allDaves);
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
