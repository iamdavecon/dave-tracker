import * as state from "../public/utils/state.js";
import { inRange } from "../public/utils/distance.js";
import { getFirstItemDefinition } from "../public/utils/itemUI.js";
import { markActive } from "./activity.js";
import { getRedeyeTag, isRedeyeHotdogTime } from "./redeye.js";

const PEPPER_ITEM = "🌶️";
const TACO_ITEM = "🌮";
const HOTDOG_ITEM = "🌭";
const DRINK_ITEM = "🍸";
const BABY_ITEM = "👶";
const VALID_HANDLE_ITEMS = new Set([TACO_ITEM, HOTDOG_ITEM, DRINK_ITEM, PEPPER_ITEM]);
const TACO_RANGE_BOOST_DURATION = 5 * 60 * 1000;
const BABY_TRANSFER_EXPIRATION = 5 * 60 * 1000;
const TOO_MANY_ITEM_THRESHOLD = 7;
const FIRST_EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*/u;

function spendItem(dave, item) {
	if (!dave?.[item] || !Number.isFinite(dave[item].count) || dave[item].count < 1) {
		return false;
	}

	dave[item].count -= 1;
	return true;
}

function grantItem(dave, item) {
	if (!dave[item]) {
		dave[item] = { count: 0, lastTime: Date.now() };
	}

	dave[item].count += 1;
	dave[item].lastTime = Date.now();
	return dave[item].count;
}

function hasPendingBabyTransfer(dave) {
	return dave?.pendingBabyTransfer
		&& typeof dave.pendingBabyTransfer.targetId === "string"
		&& Number.isFinite(dave.pendingBabyTransfer.time)
		&& Date.now() - dave.pendingBabyTransfer.time <= BABY_TRANSFER_EXPIRATION;
}

export function applyItemHandle(name, item) {
	const currentName = typeof name === "string" && name.trim() ? name : "Dave";

	if (FIRST_EMOJI_RE.test(currentName)) {
		return currentName.replace(FIRST_EMOJI_RE, item);
	}

	return `${item}${currentName}`;
}

export function registerHandlers(socket, daves, io) {
	socket.on("getItemFromUser", (sourceId, targetId, item) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const source = daves[sourceId];
		const target = daves[targetId];
		const targetItem = getFirstItemDefinition(target?.name);
		if (!source || !target || sourceId === targetId || !inRange(source, target) || targetItem?.item !== item) {
			return;
		}

		const itemCountBefore = state.getAmt(source, item);
		const count = state.add(source, item);
		if (item === HOTDOG_ITEM && count > itemCountBefore && isRedeyeHotdogTime()) {
			state.addTag(source, getRedeyeTag());
		}
		if (item === HOTDOG_ITEM && count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(source, "Timmy");
		}
		if (item === DRINK_ITEM && count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(source, "GDIK");
		}
		if (item === PEPPER_ITEM && count >= TOO_MANY_ITEM_THRESHOLD) {
			state.addTag(source, "peppercon");
		}
		markActive(source);
		io.emit("update");
	});

	socket.on("startReceiveBaby", (sourceId, targetId, callback) => {
		const respond = typeof callback === "function" ? callback : () => {};
		if (sourceId !== socket.userId) {
			respond({ ok: false, error: "source mismatch" });
			return;
		}

		const source = daves[sourceId];
		const target = daves[targetId];
		if (!source || !target || sourceId === targetId || target.isBot || !inRange(source, target) || state.getAmt(target, BABY_ITEM) < 1) {
			respond({ ok: false, error: "baby unavailable" });
			return;
		}

		source.pendingBabyTransfer = {
			targetId,
			time: Date.now()
		};
		markActive(source);
		respond({ ok: true });
	});

	socket.on("finishReceiveBaby", (sourceId, won, callback) => {
		const respond = typeof callback === "function" ? callback : () => {};
		if (sourceId !== socket.userId) {
			respond({ ok: false, error: "source mismatch" });
			return;
		}

		const source = daves[sourceId];
		if (!hasPendingBabyTransfer(source)) {
			respond({ ok: false, error: "baby transfer unavailable" });
			return;
		}

		const { targetId } = source.pendingBabyTransfer;
		const target = daves[targetId];
		delete source.pendingBabyTransfer;

		if (!won) {
			source.babiesLost = (source.babiesLost ?? 0) + 1;
			markActive(source);
			io.emit("update");
			respond({ ok: true, won: false, transferred: false });
			return;
		}

		if (!target || !inRange(source, target) || !spendItem(target, BABY_ITEM)) {
			respond({ ok: false, error: "baby unavailable" });
			return;
		}

		grantItem(source, BABY_ITEM);
		source.babiesReceived = (source.babiesReceived ?? 0) + 1;
		markActive(source);
		io.emit("update");
		respond({ ok: true, won: true, transferred: true });
	});

	socket.on("eatTaco", (sourceId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const source = daves[sourceId];
		if (!source || !spendItem(source, TACO_ITEM)) {
			return;
		}

		source.tacoRangeBoostUntil = Date.now() + TACO_RANGE_BOOST_DURATION;
		markActive(source);
		io.emit("update");
	});

	socket.on("becomeItem", (sourceId, item, callback = () => {}) => {
		const respond = typeof callback === "function" ? callback : () => {};
		if (sourceId !== socket.userId) {
			respond({ ok: false, error: "source mismatch" });
			return;
		}

		const source = daves[sourceId];
		if (!source || !VALID_HANDLE_ITEMS.has(item) || state.getAmt(source, item) < 1) {
			respond({ ok: false, error: "item unavailable" });
			return;
		}

		source.name = applyItemHandle(source.name, item);
		markActive(source);
		io.emit("update");
		respond({ ok: true, name: source.name });
	});
}
