import { DAVE_RAVE_MIN_PLAYERS, DAVE_RAVE_RADIUS_METERS } from "../public/utils/raves.js";
import { canStartDaveRave, getDaveRaveDebug, getDaveRaveCooldownRemaining } from "./players.js";
import { getUsers } from "./storage.js";
import { markActive } from "./activity.js";

export function registerHandlers(socket, daves, io, logEvent = () => {}, awardDodCommendations = () => {}) {
	socket.on("startDaveRave", (sourceId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const dave = daves[sourceId] || localDaves[sourceId];
		const raveDebug = getDaveRaveDebug(dave, localDaves);
		const davesInArea = raveDebug.eligibleDaves.length;
		const cooldownRemaining = getDaveRaveCooldownRemaining(dave);
		const debug = {
			requiredDaves: DAVE_RAVE_MIN_PLAYERS,
			radiusMeters: DAVE_RAVE_RADIUS_METERS,
			sourceId,
			sourceName: dave?.name ?? null,
			sourceLat: Number.isFinite(dave?.lat) ? dave.lat : null,
			sourceLng: Number.isFinite(dave?.lng) ? dave.lng : null,
			eligibleDaves: raveDebug.eligibleDaves,
			excludedDaves: raveDebug.excludedDaves
		};
		const reason = !dave
			? "unavailable"
			: cooldownRemaining > 0
				? "cooldown"
				: "not-enough-daves";
		if (!dave || !canStartDaveRave(dave, localDaves)) {
			socket.emit("daveRaveResult", {
				ok: false,
				reason,
				davesInArea,
				cooldownRemaining,
				debug
			});
			return;
		}

		dave.daveravesStarted = (dave.daveravesStarted ?? 0) + 1;
		dave.lastDaveRaveTime = Date.now();
		markActive(dave);
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
			davesInArea,
			debug
		});
		io.emit("daveRave", {
			userId: dave.userId,
			name: dave.name,
			daveravesStarted: dave.daveravesStarted
		});
		io.emit("update");
	});
}
