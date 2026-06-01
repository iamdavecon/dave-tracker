import * as state from "../public/utils/state.js";
import { inRange } from "../public/utils/distance.js";

const PEPPER_ITEM = "🌶️";
const PEPPER_RE = /🌶️?/u;
const TOO_MANY_ITEM_THRESHOLD = 7;

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
}
