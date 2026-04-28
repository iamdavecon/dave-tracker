import { stabilize } from '../public/utils/state.js';
import { getUsers } from './storage.js';


/**
 * Handles the stabilization process for the given user and other users.
 * 
 * @param {Object} me - The current user 
 * @param {Object} target - The other player.
 * @returns true if target was stabilized
 */
export function stabilizeTarget(me, target) {
	const id = targe.userId;

	if (!me.fragmentsCollected) {
		me.fragmentsCollected = [];
	}
	// Only infect viable daves
	if (!me.fragmentsCollected.includes(id) && stabilize(target)) {
		me.fragmentsCollected.push(id);
		return true;
	} 

	return false;
}

export function registerHandlers(socket, daves, io) {
	socket.on("stabilize", (sourceId, targetId) => {
		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}

		const success = stabilizeTarget(me, daves, userSockets, io);

		socket.emit("stabilizeResult", {
			success 
		});

		io.emit("update", { daves });
	});
}

