import * as state from "../public/utils/state.js";

export function registerHandlers(socket, daves, io) {
	socket.on("getItem", (sourceId, item) => {
		const dave = daves[sourceId];
		if (dave) {
			if (state.add(dave, item)) {
				console.log("GET: " + item);
			}
		}
	});
}

