import { getFragmentFrom } from '../public/utils/id.js';
import {
	stabilize,
	ascendUser,
	addTag,
	canAscend,
	canBePatched,
	canDoonShift,
	decreaseRank,
	grantDavePrime,
	hasPatchAbility,
	hasTag,
	isDavePrime
} from '../public/utils/state.js';
import { inRange } from '../public/utils/distance.js';
import { getUsers } from './storage.js';

export function registerHandlers(socket, daves, io, logEvent = () => {}) {
	socket.on("stabilize", (sourceId, targetId) => {
		//console.log("stabilizing: " + sourceId + " => " + targetId);
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}
		if (!hasPatchAbility(me) || !canBePatched(target) || !inRange(me, target)) {
			socket.emit("stabilizeResult", {
				success: false,
				recoveredFragment: false
			});
			return;
		}

		const success = stabilize(target);
		const recoveredFragment = success && getFragmentFrom(me, target);
		//console.log("result: " + success);

		socket.emit("stabilizeResult", {
			success,
			recoveredFragment
		});

		if (success) {
			logEvent(recoveredFragment
				? `${me.name} stabilized ${target.name} and recovered a fragment.`
				: `${me.name} stabilized ${target.name}.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

	socket.on("ascendPlayer", (sourceId, targetId) => {
		//console.log("ascending: " + sourceId + " => " + targetId);
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}
		if (!canAscend(me, target) || !inRange(me, target)) {
			return;
		}

		const success = ascendUser(target);
		const recoveredFragment = success && getFragmentFrom(me, target);
		//console.log("result: " + success);

		if (success) {
			logEvent(recoveredFragment
				? `${me.name} helped ${target.name} ascend and recovered a fragment.`
				: `${me.name} helped ${target.name} ascend.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

	socket.on("daveputize", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target) {
			return;
		}
		if (!hasTag(me, "mayor") || hasTag(target, "doon") || !inRange(me, target)) {
			return;
		}

		const success = addTag(target, "doon");

		if (success) {
			logEvent(`${me.name} daveputized ${target.name}.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

	socket.on("doonShift", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target || !canDoonShift(me, target) || !inRange(me, target)) {
			return;
		}

		const previousState = target.state;
		const success = decreaseRank(target);

		if (success) {
			logEvent(`${me.name} pushed ${target.name} from ${previousState.toUpperCase()} to ${target.state.toUpperCase()}.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

	socket.on("grantDavePrime", (sourceId, targetId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		const target = localDaves[targetId];
		if (!me || !target || !isDavePrime(me) || !inRange(me, target)) {
			return;
		}

		const success = grantDavePrime(target);

		if (success) {
			logEvent(`${me.name} granted DAVEPRIME clearance to ${target.name}.`, {
				userId: me.userId
			});
		}

		io.emit("update", { daves });
	});

}
