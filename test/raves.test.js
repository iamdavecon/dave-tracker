import test from 'node:test';
import assert from 'node:assert/strict';

import { DAVE_RAVE_MIN_PLAYERS } from '../public/utils/raves.js';
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

function createRaveDaves(count = 10) {
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

test('Dave Rave threshold is shared at ten Daves', () => {
	assert.equal(DAVE_RAVE_MIN_PLAYERS, 10);
});

test('startDaveRave increments the counter when ten daves are in range', () => {
	const { socket, handlers, socketEvents, io, ioEvents, logs } = createHarness();
	const daves = createRaveDaves();

	registerHandlers(socket, daves, io, (message, options) => logs.push({ message, options }));
	handlers.startDaveRave('source');

	assert.equal(daves.source.daveravesStarted, 1);
	assert.equal(Number.isFinite(daves.source.lastDaveRaveTime), true);
	assert.equal(socketEvents[0].event, 'daveRaveResult');
	assert.equal(socketEvents[0].payload.ok, true);
	assert.equal(socketEvents[0].payload.daveravesStarted, 1);
	assert.equal(socketEvents[0].payload.davesInArea, 10);
	assert.equal(socketEvents[0].payload.debug.requiredDaves, 10);
	assert.equal(socketEvents[0].payload.debug.radiusMeters, 250);
	assert.equal(socketEvents[0].payload.debug.sourceId, 'source');
	assert.equal(socketEvents[0].payload.debug.sourceName, 'Dave 0');
	assert.equal(socketEvents[0].payload.debug.sourceLat, 41);
	assert.equal(socketEvents[0].payload.debug.sourceLng, -87);
	assert.equal(socketEvents[0].payload.debug.eligibleDaves.length, 10);
	assert.equal(socketEvents[0].payload.debug.eligibleDaves[0].distanceMeters, 0);
	assert.equal(ioEvents.map(event => event.event).includes('daveRave'), true);
	assert.equal(ioEvents.map(event => event.event).includes('update'), true);
	assert.equal(logs.length, 1);
});

test('startDaveRave uses the same merged Dave count as the player page', () => {
	const { socket, handlers, socketEvents, io } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		}
	};

	for (let i = 0; i < 9; i++) {
		daves[`near-${i}`] = {
			userId: `near-${i}`,
			name: `Near ${i}`,
			lat: 41,
			lng: -87,
			updatedAt: 0
		};
	}

	registerHandlers(socket, daves, io);
	handlers.startDaveRave('source');

	assert.equal(daves.source.daveravesStarted, 1);
	assert.equal(socketEvents[0].event, 'daveRaveResult');
	assert.equal(socketEvents[0].payload.ok, true);
	assert.equal(socketEvents[0].payload.daveravesStarted, 1);
	assert.equal(socketEvents[0].payload.davesInArea, 10);
	assert.equal(socketEvents[0].payload.debug.requiredDaves, 10);
	assert.equal(socketEvents[0].payload.debug.radiusMeters, 250);
	assert.equal(socketEvents[0].payload.debug.sourceName, 'Source');
	assert.equal(socketEvents[0].payload.debug.eligibleDaves.length, 10);
});

test('startDaveRave rejects forged, underpopulated, and cooling down starts', () => {
	const { socket, handlers, socketEvents, io } = createHarness();
	const daves = createRaveDaves(9);

	registerHandlers(socket, daves, io);
	handlers.startDaveRave('other');
	handlers.startDaveRave('source');

	assert.equal(daves.source.daveravesStarted, undefined);
	assert.equal(socketEvents[0].event, 'daveRaveResult');
	assert.equal(socketEvents[0].payload.ok, false);
	assert.equal(socketEvents[0].payload.reason, 'not-enough-daves');
	assert.equal(socketEvents[0].payload.davesInArea, 9);
	assert.equal(socketEvents[0].payload.cooldownRemaining, 0);
	assert.equal(socketEvents[0].payload.debug.requiredDaves, 10);
	assert.equal(socketEvents[0].payload.debug.radiusMeters, 250);
	assert.equal(socketEvents[0].payload.debug.sourceName, 'Dave 0');
	assert.equal(socketEvents[0].payload.debug.eligibleDaves.length, 9);

	const readyDaves = createRaveDaves(10);
	readyDaves.source.lastDaveRaveTime = Date.now();
	const cooldownHarness = createHarness();
	registerHandlers(cooldownHarness.socket, readyDaves, cooldownHarness.io);
	cooldownHarness.handlers.startDaveRave('source');

	assert.equal(readyDaves.source.daveravesStarted, undefined);
	assert.equal(cooldownHarness.socketEvents[0].event, 'daveRaveResult');
	assert.equal(cooldownHarness.socketEvents[0].payload.ok, false);
	assert.equal(cooldownHarness.socketEvents[0].payload.reason, 'cooldown');
	assert.equal(cooldownHarness.socketEvents[0].payload.davesInArea, 10);
	assert.equal(cooldownHarness.socketEvents[0].payload.debug.requiredDaves, 10);
	assert.equal(cooldownHarness.socketEvents[0].payload.debug.radiusMeters, 250);
	assert.equal(cooldownHarness.socketEvents[0].payload.debug.eligibleDaves.length, 10);
	assert.ok(cooldownHarness.socketEvents[0].payload.cooldownRemaining > 0);
});
