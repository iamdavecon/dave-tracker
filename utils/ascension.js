import { ascendUser , maxState } from "../public/utils/state.js";

export function registerHandlers(socket, daves, savedPlaces, io, logEvent = () => {}) {
	socket.on("ascend", (userId, placeId) => {
		const dave = daves[userId];
		const place = savedPlaces[placeId];
		if (!dave || !place) {
			return;
		}

		if (!ascendUser(dave)) {
			return;
		}
		const level = maxState(dave);

		logEvent(`${dave.name} ascended at ${place.name} to level ${level}.`, {
			userId: dave.userId,
			placeId
		});
	});
}
