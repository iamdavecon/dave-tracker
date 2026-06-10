import * as state from "../public/utils/state.js";
import { inRange } from "../public/utils/distance.js";
import { markActive } from "./activity.js";

const PEPPER_ITEM = "🌶️";
const PEPPER_RE = /🌶️?/u;
const TACO_ITEM = "🌮";
const BABY_ITEM = "👶";
const TACO_RANGE_BOOST_DURATION = 5 * 60 * 1000;
const BABY_TRANSFER_EXPIRATION = 5 * 60 * 1000;
const TOO_MANY_ITEM_THRESHOLD = 7;

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

export function registerHandlers(socket, daves, io) {
	socket.on("getItemFromUser", (sourceId, targetId, item) => {
		if (sourceId !== socket.userId || item !== PEPPER_ITEM) {
			return;
		}

		const source = daves[sourceId];
		const target = daves[targetId];
		if (!source || !target || sourceId === targetId || !inRange(source, target) || !PEPPER_RE.test(target.name ?? "")) {
			return;
		}

		const count = state.add(source, item);
		if (count >= TOO_MANY_ITEM_THRESHOLD) {
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
}
