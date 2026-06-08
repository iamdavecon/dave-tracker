import * as state from "../public/utils/state.js";
import { isDebugId } from "./debugAccess.js";

export function registerHandlers(socket, daves, savedPlaces, io) {
	socket.on("increaseRank", (sourceId) => {
		if (sourceId !== socket.userId || !isDebugId(socket.userId)) {
			return;
		}

		const me = daves[sourceId];
		if (!me) {
			return;
		}

		state.increaseRank(me);
		io.emit("update");
	});

	socket.on("decreaseRank", (sourceId) => {
		if (sourceId !== socket.userId || !isDebugId(socket.userId)) {
			return;
		}

		const me = daves[sourceId];
		if (!me) {
			return;
		}

		state.decreaseRank(me);
		io.emit("update");
	});

}
