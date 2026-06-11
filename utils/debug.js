import * as state from "../public/utils/state.js";
import { recordFragmentCollected, recordInfectionSpread } from "../public/utils/id.js";
import { isDebugId } from "./debugAccess.js";
import { markActive } from "./activity.js";

function canUseDebugAction(socket, sourceId) {
	return sourceId === socket.userId && isDebugId(socket.userId);
}

function addRandomIds(dave, field, count = 10) {
	if (!Array.isArray(dave[field])) {
		dave[field] = [];
	}

	for (let i = 0; i < count; i++) {
		dave[field].push(crypto.randomUUID());
	}
}

export function registerHandlers(socket, daves, savedPlaces, io) {
	socket.on("increaseRank", (sourceId) => {
		if (!canUseDebugAction(socket, sourceId)) {
			return;
		}

		const me = daves[sourceId];
		if (!me) {
			return;
		}

		state.increaseRank(me);
		markActive(me);
		io.emit("update");
	});

	socket.on("decreaseRank", (sourceId) => {
		if (!canUseDebugAction(socket, sourceId)) {
			return;
		}

		const me = daves[sourceId];
		if (!me) {
			return;
		}

		state.decreaseRank(me);
		markActive(me);
		io.emit("update");
	});

	socket.on("grantRandomFragments", (sourceId, callback) => {
		if (!canUseDebugAction(socket, sourceId)) {
			callback?.({ ok: false, error: "debug user required" });
			return;
		}

		const me = daves[sourceId];
		if (!me) {
			callback?.({ ok: false, error: "user unavailable" });
			return;
		}

		addRandomIds(me, "fragmentsCollected");
		recordFragmentCollected(me, 10);
		markActive(me);
		io.emit("update");
		callback?.({ ok: true });
	});

	socket.on("grantRandomInfectedUsers", (sourceId, callback) => {
		if (!canUseDebugAction(socket, sourceId)) {
			callback?.({ ok: false, error: "debug user required" });
			return;
		}

		const me = daves[sourceId];
		if (!me) {
			callback?.({ ok: false, error: "user unavailable" });
			return;
		}

		addRandomIds(me, "infectedUsers");
		recordInfectionSpread(me, 10);
		markActive(me);
		io.emit("update");
		callback?.({ ok: true });
	});

}
