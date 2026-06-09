import { ascendUser, getAscensionRequiredLevel, maxState } from "../public/utils/state.js";
import { removeFragment } from './players.js';

export function registerHandlers(socket, daves, savedPlaces, io, logEvent = () => {}) {
	socket.on("ascendAtNode", (userId, placeId) => {
		if (userId !== socket.userId) {
			return;
		}

		const dave = daves[userId];
		const place = savedPlaces[placeId];
		if (!dave || !place) {
			return;
		}

		const requiredLevel = getAscensionRequiredLevel(dave);
		if ((dave.fragmentsCollected?.length ?? 0) < 1 || requiredLevel == null || (place.level ?? 0) < requiredLevel) {
			return;
		}

		if (!ascendUser(dave)) {
			return;
		}
		removeFragment(dave);
		const level = maxState(dave);

		logEvent(`${dave.name} ascended at ${place.name} to level ${level}.`, {
			userId: dave.userId,
			placeId,
			important: true
		});
		io.emit("update", { daves });
	});
}
