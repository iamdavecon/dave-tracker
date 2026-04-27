import { haversineDistance } from '../public/utils/distance.js';


function canInfect(state) {
	return state !== "IMMUNE" 
		&& state !== "PATCHED"
		&& state !== "INFECTED";
}

/**
 * Handles the infection process for the given user and other users.
 * 
 * @param {Object} me - The current user who is spreading infection.
 * @param {Object} daves - The collection of all users.
 * @param {Object} userSockets - The socket map for each user.
 * @param {Object} io - The Socket.IO server instance.
 * @returns {Array} - List of users infected by the current user.
 */
export function infect(me, daves, userSockets, io) {
	const INFECT_RADIUS = 50; // meters 

	let infectedTargets = [];

	for (const [id, u] of Object.entries(daves)) {
		if (id === me.userId) continue;
		if (!u.lat || !u.lon) continue;

		const dist = haversineDistance(
			{ lat: me.lat, lon: me.lon },
			{ lat: u.lat, lon: u.lon }
		);

		// Only infect viable daves
		if (dist <= INFECT_RADIUS && canInfect(u.state)) {
			// Infector (current user)
			if (!me.infectedUsers) {
				me.infectedUsers = [];
			}
			if (!me.infectedUsers.includes(id)) {
				me.infectedUsers.push(id);
				infectedTargets.push(id);
			}

			// Infectee (target user)
			u.state = "INFECTED";
			if (u.infectedBy && !u.infectedBy.includes(me.userId)) {
				u.infectedBy.push(me.userId);
			}

			// Notify infected user via socket
			const targetSocket = userSockets[id];
			if (targetSocket) {
				io.to(targetSocket).emit("notifyInfected", { by: me.icon });
			}
		}
	}

	return infectedTargets;
}

