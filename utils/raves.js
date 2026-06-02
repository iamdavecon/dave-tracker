import { canStartDaveRave, countDavesInArea, getDaveRaveCooldownRemaining } from "./players.js";

export function registerHandlers(socket, daves, io, logEvent = () => {}, awardDodCommendations = () => {}) {
	socket.on("startDaveRave", (sourceId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		if (!dave || !canStartDaveRave(dave, daves)) {
			socket.emit("daveRaveResult", {
				ok: false,
				davesInArea: countDavesInArea(dave, daves),
				cooldownRemaining: getDaveRaveCooldownRemaining(dave)
			});
			return;
		}

		dave.daveravesStarted = (dave.daveravesStarted ?? 0) + 1;
		dave.lastDaveRaveTime = Date.now();
		logEvent(`${dave.name} started a Dave Rave.`, {
			userId: dave.userId,
			important: true
		});
		awardDodCommendations(dave, 3, "Dave Rave command", {
			important: true
		});
		socket.emit("daveRaveResult", {
			ok: true,
			daveravesStarted: dave.daveravesStarted,
			davesInArea: countDavesInArea(dave, daves)
		});
		io.emit("daveRave", {
			userId: dave.userId,
			name: dave.name,
			daveravesStarted: dave.daveravesStarted
		});
		io.emit("update");
	});
}
