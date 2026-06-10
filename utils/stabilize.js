import { getFragmentFrom } from '../public/utils/id.js';
import {
	stabilize,
	ascendUser,
	addTag,
	canAscend,
	canBePatched,
	canDecreaseStatus,
	canDoonShift,
	canMakeBadDecision,
	decreaseRank,
	grantDavePrime,
	hasPatchAbility,
	hasTag,
	hasTerritoryRank,
	isDavePrime,
	syncTerritoryRank
} from '../public/utils/state.js';
import { inRange } from '../public/utils/distance.js';
import { getUsers } from './storage.js';
import { DAVE_TANGENT_NAME, GOON_NAME } from './bots.js';
import { BLACK_BADGE_RAFFLE_ITEM } from './players.js';
import { markActive } from './activity.js';

function normalizeGrantedTag(tag) {
	return String(tag ?? "").trim().slice(0, 40);
}

function grantBonusFragment(dave) {
	if (!Array.isArray(dave.fragmentsCollected)) {
		dave.fragmentsCollected = [];
	}

	dave.fragmentsCollected.push(crypto.randomUUID());
}

function grantBlackBadgeRaffleTicket(dave, goonId) {
	if (!Array.isArray(dave.claimedGoonRaffles)) {
		dave.claimedGoonRaffles = [];
	}
	if (dave.claimedGoonRaffles.includes(goonId)) {
		return false;
	}
	if (!dave[BLACK_BADGE_RAFFLE_ITEM]) {
		dave[BLACK_BADGE_RAFFLE_ITEM] = { count: 0, lastTime: 0 };
	}

	dave[BLACK_BADGE_RAFFLE_ITEM].count += 1;
	dave[BLACK_BADGE_RAFFLE_ITEM].lastTime = Date.now();
	dave.claimedGoonRaffles.push(goonId);
	return true;
}

function grantCorruptHostFragments(source, target) {
	const recoveredFragment = getFragmentFrom(source, target);
	if (!recoveredFragment) {
		return false;
	}

	grantBonusFragment(source);
	return true;
}

export function registerHandlers(socket, daves, savedPlaces = {}, io, logEvent = () => {}, awardDodCommendations = () => {}) {
	if (savedPlaces && typeof savedPlaces.emit === "function") {
		logEvent = typeof io === "function" ? io : logEvent;
		io = savedPlaces;
		savedPlaces = {};
	}

	socket.on("stabilize", (sourceId, targetId) => {
		//console.log("stabilizing: " + sourceId + " => " + targetId);
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}
		if (!hasPatchAbility(me) || !canBePatched(target) || !inRange(me, target)) {
			socket.emit("stabilizeResult", {
				success: false,
				recoveredFragment: false
			});
			return;
		}

		const success = stabilize(target);
		const recoveredFragment = success && getFragmentFrom(me, target);
		//console.log("result: " + success);

		socket.emit("stabilizeResult", {
			success,
			recoveredFragment
		});

		if (success) {
			markActive(me);
			logEvent(recoveredFragment
				? `${me.name} stabilized ${target.name} and recovered a fragment.`
				: `${me.name} stabilized ${target.name}.`, {
				userId: me.userId
			});
			awardDodCommendations(me, 2, "field stabilization");
		}

		io.emit("update", { daves });
	});

	socket.on("ascendPlayer", (sourceId, targetId) => {
		//console.log("ascending: " + sourceId + " => " + targetId);
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}
		if (!canAscend(me, target) || !inRange(me, target)) {
			return;
		}

		const success = ascendUser(target);
		const recoveredFragment = success && getFragmentFrom(me, target);
		//console.log("result: " + success);

		if (success) {
			markActive(me);
			logEvent(recoveredFragment
				? `${me.name} helped ${target.name} ascend and recovered a fragment.`
				: `${me.name} helped ${target.name} ascend.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

	socket.on("badDecision", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target || !canMakeBadDecision(me, target) || !inRange(me, target)) {
			return;
		}

		const success = ascendUser(target);
		const recoveredFragment = success && getFragmentFrom(me, target);

		if (success) {
			me.badDecisionsMade = (me.badDecisionsMade ?? 0) + 1;
			if (recoveredFragment) {
				grantBonusFragment(me);
			}
			if (me.badDecisionsMade >= 3) {
				addTag(me, "bad-decision");
			}
			markActive(me);

			logEvent(recoveredFragment
				? `${me.name} made a bad decision with ${target.name} and recovered 2 fragments.`
				: `${me.name} made a bad decision with ${target.name}.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

	socket.on("daveputize", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}
		syncTerritoryRank(me, savedPlaces);
		if (!hasTerritoryRank(me) || hasTag(target, "doon") || !inRange(me, target)) {
			return;
		}

		const success = addTag(target, "doon");

		if (success) {
			markActive(me);
			logEvent(`${me.name} daveputized ${target.name}.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

	socket.on("doonShift", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target || !canDoonShift(me, target) || !inRange(me, target)) {
			return;
		}

		const previousState = target.state;
		const success = decreaseRank(target);

		if (success) {
			const recoveredFragments = grantCorruptHostFragments(me, target);
			markActive(me);
			logEvent(recoveredFragments
				? `${me.name} pushed ${target.name} from ${previousState.toUpperCase()} to ${target.state.toUpperCase()} and recovered 2 fragments.`
				: `${me.name} pushed ${target.name} from ${previousState.toUpperCase()} to ${target.state.toUpperCase()}.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

	socket.on("decreaseStatus", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target || !canDecreaseStatus(me, target) || !inRange(me, target)) {
			return;
		}

		const previousState = target.state;
		const success = decreaseRank(target);

		if (success) {
			const recoveredFragments = grantCorruptHostFragments(me, target);
			markActive(me);
			logEvent(recoveredFragments
				? `${me.name} decreased ${target.name} from ${previousState.toUpperCase()} to ${target.state.toUpperCase()} and recovered 2 fragments.`
				: `${me.name} decreased ${target.name} from ${previousState.toUpperCase()} to ${target.state.toUpperCase()}.`, {
				userId: me.userId
			});
			io.emit("update", { daves });
		}
	});

	socket.on("grantDavePrime", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target || !isDavePrime(me) || !inRange(me, target)) {
			return;
		}

		const success = grantDavePrime(target);

		if (success) {
			markActive(me);
			logEvent(`${me.name} granted DAVEPRIME clearance to ${target.name}.`, {
				userId: me.userId,
				important: true
			});
		}

		io.emit("update", { daves });
	});

	socket.on("grantTag", (sourceId, targetId, tag) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		const normalizedTag = normalizeGrantedTag(tag);
		if (!me || !target || target.isBot || !isDavePrime(me) || !normalizedTag || !inRange(me, target)) {
			return;
		}

		const success = addTag(target, normalizedTag);

		if (success) {
			markActive(me);
			logEvent(`${me.name} granted ${normalizedTag} to ${target.name}.`, {
				userId: me.userId
			});
			io.emit("update", { daves });
		}
	});

	socket.on("introduceDaveTangent", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target || !target.isBot || target.name !== DAVE_TANGENT_NAME || !inRange(me, target)) {
			return;
		}

		const success = addTag(me, "DT");

		if (success) {
			markActive(me);
			logEvent(`${me.name} introduced themselves to ${DAVE_TANGENT_NAME}.`, {
				userId: me.userId
			});
			io.emit("update", { daves });
		}
	});

	socket.on("claimGoonRaffle", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target || !target.isBot || target.name !== GOON_NAME || !inRange(me, target)) {
			return;
		}

		const success = grantBlackBadgeRaffleTicket(me, target.userId);

		if (success) {
			markActive(me);
			logEvent(`${me.name} accepted a black badge raffle ticket from ${GOON_NAME}.`, {
				userId: me.userId
			});
			io.emit("update", { daves });
		}
	});

}
