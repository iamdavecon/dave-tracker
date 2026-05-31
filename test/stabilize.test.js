import test from 'node:test';
import assert from 'node:assert/strict';

import { registerHandlers } from '../utils/stabilize.js';

function createSocket(userId) {
	const handlers = {};
	const emitted = [];
	return {
		socket: {
			userId,
			on(event, handler) {
				handlers[event] = handler;
			},
			emit(event, payload) {
				emitted.push({ event, payload });
			}
		},
		handlers,
		emitted
	};
}

test('stabilize only awards a fragment after a successful stabilization', () => {
	const { socket, handlers, emitted } = createSocket('source');
	const ioEvents = [];
	const daves = {
		source: { userId: 'source', name: 'Source', state: 'immune', fragmentsCollected: [], lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', state: 'immune', lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) });

	handlers.stabilize('source', 'target');

	assert.deepEqual(daves.source.fragmentsCollected, []);
	assert.deepEqual(emitted, [
		{ event: 'stabilizeResult', payload: { success: false, recoveredFragment: false } }
	]);
	assert.deepEqual(ioEvents, []);
});

test('stabilize rejects forged source ids', () => {
	const { socket, handlers, emitted } = createSocket('source');
	const daves = {
		source: { userId: 'source', name: 'Source', state: 'immune', fragmentsCollected: [], lat: 41, lng: -87 },
		other: { userId: 'other', name: 'Other', state: 'immune', fragmentsCollected: [], lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', state: 'unstable', lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: () => {} });
	handlers.stabilize('other', 'target');

	assert.equal(daves.target.state, 'unstable');
	assert.deepEqual(daves.other.fragmentsCollected, []);
	assert.deepEqual(emitted, []);
});

test('ascendPlayer is distinct from node ascension and enforces player eligibility', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const daves = {
		source: { userId: 'source', name: 'Source', state: 'ascended', fragmentsCollected: [], lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', state: 'infected', lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: () => {} }, (message) => logs.push(message));

	assert.equal(handlers.ascend, undefined);
	handlers.ascendPlayer('source', 'target');

	assert.equal(daves.target.state, 'unstable');
	assert.deepEqual(daves.source.fragmentsCollected, ['target']);
	assert.equal(logs.length, 1);
});
