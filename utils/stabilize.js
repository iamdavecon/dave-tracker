import { haversineDistance } from '../public/utils/distance.js';


function canStabilize(state) {
	return true;  //TODO?
}

/**
 * Handles the stabilization process for the given user and other users.
 * 
 * @param {Object} me - The current user who is spreading infection.
 * @param {Object} daves - The collection of all users.
 * @param {Object} userSockets - The socket map for each user.
 * @param {Object} io - The Socket.IO server instance.
 * @returns {Array} - List of users infected by the current user.
 */
export function stabilize(me, daves, userSockets, io) {
	const RADIUS = 50; // meters 

	let stabilizedTargets = [];

	for (const [id, u] of Object.entries(daves)) {
		if (id === me.userId) continue;
		if (!u.lat || !u.lon) continue;

		const dist = haversineDistance(
			{ lat: me.lat, lon: me.lon },
			{ lat: u.lat, lon: u.lon }
		);

		// Only infect viable daves
		if (dist <= RADIUS && canStabilize(u.state)) {
			// current user
			if (!me.fragmentsCollected) {
				me.fragmentsCollected = [];
			}
			if (!me.fragmentsCollected.includes(id)) {
				me.fragmentsCollected.push(id);
				stabilizedTargets.push(id);
			} 
		}
	}

	return stabilizedTargets;
}

