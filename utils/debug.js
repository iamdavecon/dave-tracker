import * as state from "../public/utils/state.js";

export function registerHandlers(socket, daves, savedPlaces, io) {
	socket.on("increaseRank", (sourceId) => {
		const me = daves[sourceId];
		state.increaseRank(me);
		io.emit("update");
	});

	socket.on("decreaseRank", (sourceId) => {
		const me = daves[sourceId];
		state.decreaseRank(me);
		io.emit("update");
	});

}

