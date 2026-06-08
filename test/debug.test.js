import test from 'node:test';
import assert from 'node:assert/strict';

import { isDebugId } from '../utils/debugAccess.js';
import { registerHandlers } from '../utils/debug.js';

const DEBUG_ID = '59a388e8-413a-4d8e-906e-15469bb3b471';

function createHarness(userId) {
	const handlers = {};
	const ioEvents = [];
	const socket = {
		userId,
		on(event, handler) {
			handlers[event] = handler;
		}
	};
	const io = {
		emit(event, payload) {
			ioEvents.push({ event, payload });
		}
	};

	return { socket, handlers, io, ioEvents };
}

test('isDebugId recognizes only source-controlled debug users', () => {
	assert.equal(isDebugId(DEBUG_ID), true);
	assert.equal(isDebugId('not-debug'), false);
	assert.equal(isDebugId(undefined), false);
});

test('debug rank handlers require a debug socket user and matching source', () => {
	const daves = {
		[DEBUG_ID]: { userId: DEBUG_ID, state: 'unstable' },
		regular: { userId: 'regular', state: 'unstable' }
	};

	const regularHarness = createHarness('regular');
	registerHandlers(regularHarness.socket, daves, {}, regularHarness.io);
	regularHarness.handlers.increaseRank('regular');
	assert.equal(daves.regular.state, 'unstable');
	assert.equal(regularHarness.ioEvents.length, 0);

	const debugHarness = createHarness(DEBUG_ID);
	registerHandlers(debugHarness.socket, daves, {}, debugHarness.io);
	debugHarness.handlers.increaseRank('regular');
	assert.equal(daves.regular.state, 'unstable');
	assert.equal(debugHarness.ioEvents.length, 0);

	debugHarness.handlers.increaseRank(DEBUG_ID);
	assert.equal(daves[DEBUG_ID].state, 'immune');
	assert.deepEqual(debugHarness.ioEvents, [{ event: 'update', payload: undefined }]);
});

