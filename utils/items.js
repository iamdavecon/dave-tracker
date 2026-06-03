import * as state from "../public/utils/state.js";
import { inRange } from "../public/utils/distance.js";

const PEPPER_ITEM = "🌶️";
const PEPPER_RE = /🌶️?/u;
const TACO_ITEM = "🌮";
const TACO_RANGE_BOOST_DURATION = 5 * 60 * 1000;
const TOO_MANY_ITEM_THRESHOLD = 7;

function spendItem(dave, item) {
	if (!dave?.[item] || !Number.isFinite(dave[item].count) || dave[item].count < 1) {
		return false;
	}

	dave[item].count -= 1;
	return true;
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
		io.emit("update");
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
		io.emit("update");
	});
}
