import { ascendUser , maxState } from "../public/utils/state.js";

export function registerHandlers(socket, daves, savedPlaces, io) {
	socket.on("ascend", (userId, placeId) => {
		const dave = daves[userId];
		if (!ascendUser(dave)) {
			return;
		}
		const level = maxState(dave);

		console.log("ascend " + userId + " => " + placeId);
	});
}

