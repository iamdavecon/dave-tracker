import * as state from "../public/utils/state.js";
import { recordFragmentCollected } from "../public/utils/id.js";
import { haversineDistance, rangesOverlap } from "../public/utils/distance.js";
import { getMapData } from "../public/utils/map.js";
import {
	canAttemptPlaceFragmentChallenge,
	canReceiveHackerJeopardyBaby,
	getPlaceChallengeQuestion,
	getPlaceFragmentChallengeForAction,
	getPlaceFragmentChallengeForEmoji,
	HACKER_JEOPARDY_BABY_COOLDOWN_KEY,
	isCorrectPlaceFragmentAnswer
} from "../public/utils/placeChallenges.js";
import { getItemsForSource } from "../public/utils/itemUI.js";
import {
	canAttemptTacoGame,
	getTacoGameQuestion,
	isCorrectTacoGameAnswer,
	TACO_GAME_REWARD_COUNT,
	TACO_ITEM
} from "../public/utils/tacoGame.js";
import { removeFragment } from './players.js';
import { markActive } from './activity.js';
import { getRedeyeTag, isRedeyeHotdogTime } from "./redeye.js";

const HOTDOG_ITEM = "🌭";
const DRINK_ITEM = "🍺";
const COCKTAIL_ITEM = "🍸";
const DRINK_ITEMS = new Set([DRINK_ITEM, COCKTAIL_ITEM, "🍷", "🥂", "🍹", "🍾", "🫖"]);
const PEPPER_ITEM = "🌶️";
const BABY_ITEM = "👶";
const BABY_LOSS_DRINK_CHANCE = 0.2;
const PLASTIC_BABY_PASS_CHANCE = 0.5;
const PLASTIC_BABY_PASS_EXPIRATION = 5 * 60 * 1000;
const LINECON_TAG = "linecon";
const TOO_MANY_ITEM_THRESHOLD = 7;

function hasFragment(dave) {
	return (dave?.fragmentsCollected?.length ?? 0) > 0;
}

function getNewPlace(dave) {
	return {
		id : crypto.randomUUID(),
		lat : dave.lat,
		lng : dave.lng,
		name : dave.name,
		owner : dave.userId,
	}
}

function firstEmoji(value = "") {
	return [...value].find(char => /\p{Extended_Pictographic}/u.test(char));
}

function isDrinkItem(item) {
	return DRINK_ITEMS.has(item);
}

function grantFragment(dave) {
	if (!Array.isArray(dave.fragmentsCollected)) {
		dave.fragmentsCollected = [];
	}

	dave.fragmentsCollected.push(crypto.randomUUID());
	recordFragmentCollected(dave);
}

function grantItemReward(dave, item, count = 1) {
	if (!dave[item]) {
		dave[item] = { count: 0, lastTime: Date.now() };
	}

	dave[item].count += count;
	dave[item].lastTime = Date.now();
	return dave[item].count;
}

function getPlaceItemRule(place, item) {
	const source = firstEmoji(place?.name);
	if (!source) {
		return null;
	}

	return getItemsForSource(source).find(rule => rule.item === item) ?? null;
}

function maybeLoseBabyAfterDrink(dave, logEvent, random = Math.random) {
	if (state.getAmt(dave, BABY_ITEM) < 1 || random() >= BABY_LOSS_DRINK_CHANCE) {
		return false;
	}

	dave[BABY_ITEM].count -= 1;
	dave.babiesLost = (dave.babiesLost ?? 0) + 1;
	logEvent(`Where's your baby, ${dave.name}?`, {
		userId: dave.userId
	});
	return true;
}

function grantChallengeReward(dave, reward, logEvent = () => {}, random = Math.random) {
	if (reward?.type === "item") {
		const item = reward.item;
		const count = grantItemReward(dave, item);
		if (isDrinkItem(item) && count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(dave, "GDIK");
		}
		if (isDrinkItem(item)) {
			maybeLoseBabyAfterDrink(dave, logEvent, random);
		}
		if (item === HOTDOG_ITEM && isRedeyeHotdogTime()) {
			state.addTag(dave, getRedeyeTag());
		}
		if (item === HOTDOG_ITEM && count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(dave, "Timmy");
		}
		return reward.label ?? "an item";
	}

	grantFragment(dave);
	return reward?.label ?? "a fragment";
}

function shouldInvokePlasticBabyPass(dave, random = Math.random, canRespond = true) {
	return canRespond && state.getAmt(dave, BABY_ITEM) === 0 && random() < PLASTIC_BABY_PASS_CHANCE;
}

function hasPendingPlasticBabyPass(dave) {
	return Number.isFinite(dave?.pendingPlasticBabyPassTime)
		&& Date.now() - dave.pendingPlasticBabyPassTime <= PLASTIC_BABY_PASS_EXPIRATION;
}

export function registerHandlers(socket, daves, savedPlaces, io, logEvent = () => {}, awardDodCommendations = () => {}, random = Math.random) {
	socket.on("dropDavePoint", (sourceId) => {
		//console.log("dropDavePoint");
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		if (!dave || !hasFragment(dave) || !Number.isFinite(dave.lat) || !Number.isFinite(dave.lng) || isTooNear(dave, savedPlaces)) {
			return;
		}

		removeFragment(dave);
		dave.nodeCount = (dave.nodeCount ?? 0) + 1;
		const newPlace = getNewPlace(dave);
		//console.log("dropped: " + JSON.stringify(newPlace, null, 2));
		//console.log("from: " + JSON.stringify(dave, null, 2));
		savedPlaces[newPlace.id] = newPlace;
		state.syncTerritoryRank(dave, savedPlaces);
		markActive(dave);
		logEvent(`${dave.name} established a new node.`, {
			userId: dave.userId,
			placeId: newPlace.id,
			important: true
		});
		awardDodCommendations(dave, 2, "node establishment", {
			placeId: newPlace.id
		});
		io.emit("update");
	});

	socket.on("upgradeDavePoint", (sourceId, placeId) => {
		//console.log("upgrade");
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (!dave || !place || !rangesOverlap(dave, place) || !state.getPlaceActions(dave, place).canUpgrade) {
			return;
		}

		removeFragment(dave);
		place.level = (place.level ?? 0) + 1;
		dave.davePointUpgradeCount = state.getDavePointUpgradeCount(dave) + 1;
		state.syncTerritoryRank(dave, savedPlaces);
		markActive(dave);
		logEvent(`${dave.name} upgraded ${place.name} to level ${place.level}.`, {
			userId: dave.userId,
			placeId,
			important: true
		});
		awardDodCommendations(dave, 2, "node upgrade", {
			placeId
		});
		io.emit("update");
	});

	socket.on("doonUpgradePlace", (sourceId, placeId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (!dave || !place || !rangesOverlap(dave, place) || !state.canDoonUpgradePlace(dave, place)) {
			return;
		}

		place.level = (place.level ?? 0) + 1;
		dave.lastDoonPlaceUpgradeTime = Date.now();
		state.syncTerritoryRank(dave, savedPlaces);
		markActive(dave);
		logEvent(`${dave.name} doonified ${place.name} to level ${place.level}.`, {
			userId: dave.userId,
			placeId,
			important: true
		});
		io.emit("update");
	});

	socket.on("setPlaceName", (sourceId, placeId, newName) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (dave && place && place.owner == sourceId) {
			const oldName = place.name;
			place.name = newName;	
			markActive(dave);
			logEvent(`${dave.name} renamed ${oldName} to ${place.name}.`, {
				userId: dave.userId,
				placeId
			});
		}
	});

	socket.on("downgradeDavePoint", (sourceId, placeId) => {
		console.log("downgradeDavePoint");
	});

	socket.on("visitDavePoint", (sourceId, placeId) => {
		console.log("visitDavePoint");
	});

	socket.on("joinLinecon", (sourceId, placeId, callback = () => {}) => {
		if (sourceId !== socket.userId) {
			callback({ ok: false, error: "source mismatch" });
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (!dave || !place || !rangesOverlap(dave, place) || state.hasTag(dave, LINECON_TAG) || !place.name?.includes("☠")) {
			callback({ ok: false, error: "linecon unavailable" });
			return;
		}

		if (state.addTag(dave, LINECON_TAG)) {
			markActive(dave);
			logEvent(`${dave.name} joined linecon.`, {
				userId: dave.userId,
				placeId
			});
			io.emit("update");
			callback({ ok: true, joined: true });
		}
	});

	socket.on("circusCircusParking", (sourceId, placeId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (!dave || !place || !rangesOverlap(dave, place) || !place.name?.includes("Circus Circus")) {
			return;
		}
		if (!state.canGet(dave, DRINK_ITEM)) {
			return;
		}

		const drinkCountBefore = state.getAmt(dave, DRINK_ITEM);
		const count = state.add(dave, DRINK_ITEM);
		if (count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(dave, "GDIK");
		}
		if (count > drinkCountBefore) {
			maybeLoseBabyAfterDrink(dave, logEvent, random);
		}
		markActive(dave);

		logEvent(`${dave.name} just parked on the sidewalk.`, {
			userId: dave.userId,
			placeId
		});
		io.emit("update");
	});

	socket.on("claimPlaceFragmentChallenge", (sourceId, placeId, action, questionId, answer, callback) => {
		const respond = typeof callback === "function" ? callback : () => {};
		if (sourceId !== socket.userId) {
			respond({ ok: false, error: "source mismatch" });
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		const challenge = getPlaceFragmentChallengeForAction(action);
		if (!dave || !place || !challenge || !rangesOverlap(dave, place)) {
			respond({ ok: false, error: "challenge unavailable" });
			return;
		}
		if (getPlaceFragmentChallengeForEmoji(firstEmoji(place.name))?.action !== challenge.action) {
			respond({ ok: false, error: "challenge mismatch" });
			return;
		}
		const question = getPlaceChallengeQuestion(action, questionId);
		if (!question || !canAttemptPlaceFragmentChallenge(dave, challenge)) {
			respond({ ok: false, error: "challenge unavailable" });
			return;
		}
		const isCorrect = isCorrectPlaceFragmentAnswer(action, answer, questionId);
		if (action === "hackerJeopardy") {
			dave[challenge.cooldownKey] = Date.now();
		}
		if (!isCorrect) {
			if (action === "hackerJeopardy") {
				markActive(dave);
				io.emit("update");
			}
			respond({ ok: false, correct: false });
			return;
		}

		const rewardLabel = grantChallengeReward(dave, question.reward ?? challenge.reward, logEvent, random);
		if (action !== "hackerJeopardy") {
			dave[challenge.cooldownKey] = Date.now();
		}
		logEvent(`${dave.name} completed ${challenge.label} at ${place.name} and recovered ${rewardLabel}.`, {
			userId: dave.userId,
			placeId
		});
		markActive(dave);
		io.emit("update");
		respond({ ok: true, correct: true });
	});

	socket.on("claimHackerJeopardyBaby", (sourceId, placeId, callback) => {
		const respond = typeof callback === "function" ? callback : () => {};
		if (sourceId !== socket.userId) {
			respond({ ok: false, error: "source mismatch" });
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		const challenge = getPlaceFragmentChallengeForAction("hackerJeopardy");
		if (!dave || !place || !challenge || !rangesOverlap(dave, place)) {
			respond({ ok: false, error: "baby unavailable" });
			return;
		}
		const isHackerJeopardyPlace = getPlaceFragmentChallengeForEmoji(firstEmoji(place.name))?.action === "hackerJeopardy"
			|| /hacker\s*jeopardy/i.test(place.name ?? "");
		if (!isHackerJeopardyPlace) {
			respond({ ok: false, error: "baby unavailable" });
			return;
		}
		if (!canReceiveHackerJeopardyBaby(dave)) {
			respond({ ok: false, error: "baby cooldown active" });
			return;
		}

		dave[HACKER_JEOPARDY_BABY_COOLDOWN_KEY] = Date.now();
		dave.pendingPlasticBabyPassTime = Date.now();

		markActive(dave);
		io.emit("update");
		respond({ ok: true, plasticBabyPass: true, granted: false });
	});

	socket.on("finishPlasticBabyPass", (sourceId, won, callback) => {
		const respond = typeof callback === "function" ? callback : () => {};
		if (sourceId !== socket.userId) {
			respond({ ok: false, error: "source mismatch" });
			return;
		}

		const dave = daves[sourceId];
		if (!hasPendingPlasticBabyPass(dave)) {
			respond({ ok: false, error: "plastic baby pass unavailable" });
			return;
		}

		delete dave.pendingPlasticBabyPassTime;
		if (!won) {
			dave.babiesLost = (dave.babiesLost ?? 0) + 1;
			markActive(dave);
			io.emit("update");
			respond({ ok: true, won: false, granted: false });
			return;
		}

		grantItemReward(dave, BABY_ITEM);
		logEvent(`${dave.name} secured a plastic baby with chopsticks.`, {
			userId: dave.userId
		});
		markActive(dave);
		io.emit("update");
		respond({ ok: true, won: true, granted: true });
	});

	socket.on("claimTacoGame", (sourceId, placeId, questionId, answer) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (!dave || !place || firstEmoji(place.name) !== TACO_ITEM || !rangesOverlap(dave, place)) {
			return;
		}
		if (!getTacoGameQuestion(questionId) || !canAttemptTacoGame(dave)) {
			return;
		}
		const isCorrect = isCorrectTacoGameAnswer(questionId, answer);
		dave.lastTacoCalibrationTime = Date.now();
		if (!isCorrect) {
			markActive(dave);
			io.emit("update");
			return;
		}

		grantItemReward(dave, TACO_ITEM, TACO_GAME_REWARD_COUNT);
		logEvent(`${dave.name} completed Taco Calibration at ${place.name} and earned ${TACO_GAME_REWARD_COUNT} tacos.`, {
			userId: dave.userId,
			placeId
		});
		markActive(dave);
		io.emit("update");
	});

	socket.on("finishDrinkGame", (sourceId, placeId, won, callback) => {
		const respond = typeof callback === "function" ? callback : () => {};
		if (sourceId !== socket.userId) {
			respond({ ok: false, error: "source mismatch" });
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (!dave || !place || firstEmoji(place.name) !== COCKTAIL_ITEM || !rangesOverlap(dave, place)) {
			respond({ ok: false, error: "drink game unavailable" });
			return;
		}
		if (!won) {
			respond({ ok: true, won: false, granted: false });
			return;
		}
		if (!state.canGet(dave, DRINK_ITEM)) {
			respond({ ok: false, error: "drink cooldown active" });
			return;
		}

		const drinkCountBefore = state.getAmt(dave, DRINK_ITEM);
		const count = state.add(dave, DRINK_ITEM);
		if (count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(dave, "GDIK");
		}
		if (count > drinkCountBefore) {
			maybeLoseBabyAfterDrink(dave, logEvent, random);
		}
		logEvent(`${dave.name} caught a drink at ${place.name}.`, {
			userId: dave.userId,
			placeId
		});
		markActive(dave);
		io.emit("update");
		respond({ ok: true, won: true, granted: true });
	});

	socket.on("getItem", (sourceId, placeIdOrItem, maybeItem) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		if (!dave) {
			return;
		}
		const hasPlaceContext = typeof maybeItem === "string";
		const placeId = hasPlaceContext ? placeIdOrItem : null;
		const item = hasPlaceContext ? maybeItem : placeIdOrItem;
		let rewardCount = 1;

		if (hasPlaceContext) {
			const place = savedPlaces[placeId];
			const rule = getPlaceItemRule(place, item);
			if (!place || !rule || !rangesOverlap(dave, place)) {
				return;
			}
			rewardCount = rule.rewardCount ?? 1;
		}

		const itemCountBefore = state.getAmt(dave, item);
		const count = state.add(dave, item, rewardCount); 
		//console.log("GETITEM: " + item + " => " + count);
		if (item == HOTDOG_ITEM && count > itemCountBefore && isRedeyeHotdogTime()) {
			state.addTag(dave, getRedeyeTag());
		}
		if (item == HOTDOG_ITEM && count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(dave, "Timmy");
		}
		if (isDrinkItem(item) && count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(dave, "GDIK");
		}
		if (isDrinkItem(item) && count > itemCountBefore) {
			maybeLoseBabyAfterDrink(dave, logEvent, random);
		}
		if (item == PEPPER_ITEM && count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(dave, "peppercon");
		}
		markActive(dave);
	});

};

export function getInteraction(me, place) {
	const mapData = getMapData(me, place);
	mapData.inRange = me && place ? rangesOverlap(me, place) : false;

	let placeDetails = {
		...place,
		mapData,
		availableActions : state.getPlaceActions(me, place),
	}
	return placeDetails;
}

export function isTooNear(me, savedPlaces) {
	if (state.canBypassNodeDistanceRestriction(me)) {
		return false;
	}

	return getNearestPlaceInRange(me, savedPlaces) !== null;
}

export function getNearestPlaceInRange(me, savedPlaces) {
	if (!me || !Number.isFinite(me.lat) || !Number.isFinite(me.lng)) {
		return null;
	}

	let nearest = null;

	for (const [placeId, place] of Object.entries(savedPlaces)) {
		//console.log("\tconsidering : " + place.name + " is " + inRange(place, me));
		if (place && rangesOverlap(me, place)) {
			const distanceMeters = haversineDistance(me, place);
			if (!nearest || distanceMeters < nearest.distanceMeters) {
				nearest = {
					id: place.id ?? placeId,
					name: place.name,
					distanceMeters
				};
			}
		}
	}

	return nearest;
}
