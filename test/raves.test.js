import test from 'node:test';
import assert from 'node:assert/strict';

import { registerHandlers } from '../utils/raves.js';

function createHarness(userId = 'source') {
	const handlers = {};
	const socketEvents = [];
	const ioEvents = [];
	const logs = [];
	const socket = {
		userId,
		on(event, handler) {
			handlers[event] = handler;
		},
		emit(event, payload) {
			socketEvents.push({ event, payload });
		}
	};
	const io = {
		emit(event, payload) {
			ioEvents.push({ event, payload });
		}
	};

	return { socket, handlers, socketEvents, io, ioEvents, logs };
}

function createRaveDaves(count = 11) {
	const daves = {};

	for (let i = 0; i < count; i++) {
		const userId = i === 0 ? 'source' : `dave-${i}`;
		daves[userId] = {
			userId,
			name: `Dave ${i}`,
			lat: 41,
			lng: -87
		};
	}

	return daves;
}

test('startDaveRave increments the counter when more than ten daves are in range', () => {
	const { socket, handlers, socketEvents, io, ioEvents, logs } = createHarness();
	const daves = createRaveDaves();

	registerHandlers(socket, daves, io, (message, options) => logs.push({ message, options }));
	handlers.startDaveRave('source');

	assert.equal(daves.source.daveravesStarted, 1);
	assert.equal(Number.isFinite(daves.source.lastDaveRaveTime), true);
	assert.deepEqual(socketEvents, [{
		event: 'daveRaveResult',
		payload: {
			ok: true,
			daveravesStarted: 1,
			davesInArea: 11
		}
	}]);
	assert.equal(ioEvents.map(event => event.event).includes('daveRave'), true);
	assert.equal(ioEvents.map(event => event.event).includes('update'), true);
	assert.equal(logs.length, 1);
});

test('startDaveRave rejects forged, underpopulated, and cooling down starts', () => {
	const { socket, handlers, socketEvents, io } = createHarness();
	const daves = createRaveDaves(10);

	registerHandlers(socket, daves, io);
	handlers.startDaveRave('other');
	handlers.startDaveRave('source');

	assert.equal(daves.source.daveravesStarted, undefined);
	assert.deepEqual(socketEvents, [{
		event: 'daveRaveResult',
		payload: {
			ok: false,
			davesInArea: 10
		}
	}]);

	const readyDaves = createRaveDaves(11);
	readyDaves.source.lastDaveRaveTime = Date.now();
	const cooldownHarness = createHarness();
	registerHandlers(cooldownHarness.socket, readyDaves, cooldownHarness.io);
	cooldownHarness.handlers.startDaveRave('source');

	assert.equal(readyDaves.source.daveravesStarted, undefined);
	assert.equal(cooldownHarness.socketEvents[0].event, 'daveRaveResult');
	assert.equal(cooldownHarness.socketEvents[0].payload.ok, false);
	assert.equal(cooldownHarness.socketEvents[0].payload.davesInArea, 11);
});
