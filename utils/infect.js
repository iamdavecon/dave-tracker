import { infect } from "../public/utils/state.js";
import { getUsers } from './storage.js';
import { notifyUser } from './sockets.js';


/**
 * Handles the infection process for the given user and other users.
 * 
 * @param {Object} me - The current user who is spreading infection.
 * @param {Object} target - The user receiving the infection
 * @returns true if target was infected
 */
export function infectTarget(me, target) {
	const id = target.userId;
	// Infector (current user)
	if (!me.infectedUsers) {
		me.infectedUsers = [];
	}
	if (!me.infectedUsers.includes(id) && infect(target)) {
		me.infectedUsers.push(id);
		if (!target.infectedBy) {
			target.infectedBy = [];
		}
		target.infectedBy.push(me.userId);

		// Notify infected user via socket
		notifyUser(target, "notifyInfected", { by: me.icon });
		return true;
	}
	return false;
}

export function registerHandlers(socket, daves, io) {
	socket.on("infect", (sourceId, targetId) => {
		//console.log("INFECT: " + JSON.stringify(socket, null, 2));
		console.log("recv'd infect: " + sourceId + " => " + targetId);
		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			console.log("missing user");
			return;
		}

		const success = infectTarget(me, target);
		//console.log("infected: " + JSON.stringify(infectedTargets, null, 2));

		socket.emit("infectResult", {
			success
		});

		if (success) {
			io.emit("update", { daves });
		}
	});


}
