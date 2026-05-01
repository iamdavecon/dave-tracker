import { getFragmentFrom } from '../public/utils/id.js';
import { stabilize, ascendUser, addTag } from '../public/utils/state.js';
import { getUsers } from './storage.js';

export function registerHandlers(socket, daves, io) {
	socket.on("stabilize", (sourceId, targetId) => {
		console.log("stabilizing: " + sourceId + " => " + targetId);
		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}

		const success = (getFragmentFrom(me, target) && stabilize(target));
		console.log("result: " + success);

		socket.emit("stabilizeResult", {
			success 
		});

		io.emit("update", { daves });
	});

	socket.on("ascend", (sourceId, targetId) => {
		console.log("ascending: " + sourceId + " => " + targetId);
		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}

		const success = (getFragmentFrom(me, target) && ascendUser(target));
		console.log("result: " + success);

		io.emit("update", { daves });
	});

	socket.on("daveputize", (sourceId, targetId) => {
		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}

		const success = addTag(target, "doon");

		io.emit("update", { daves });
	});

}

