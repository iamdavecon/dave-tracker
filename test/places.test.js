import test from 'node:test';
import assert from 'node:assert/strict';

import { registerHandlers } from '../utils/places.js';

function createHarness(userId = 'source') {
	const handlers = {};
	const ioEvents = [];
	const logs = [];
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

	return { socket, handlers, io, ioEvents, logs };
}

test('dropDavePoint spends a fragment and creates a node only for the connected user', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source Node',
			lat: 41,
			lng: -87,
			fragmentsCollected: ['fragment'],
			tags: []
		}
	};
	const places = {};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));

	handlers.dropDavePoint('source');

	const created = Object.values(places)[0];
	assert.equal(Object.keys(places).length, 1);
	assert.equal(created.owner, 'source');
	assert.deepEqual(daves.source.fragmentsCollected, []);
	assert.equal(daves.source.nodeCount, 1);
	assert.deepEqual(daves.source.tags, ['standard-user']);
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('dropDavePoint refuses free or too-near node creation', () => {
	const { socket, handlers, io } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87,
			fragmentsCollected: []
		}
	};
	const places = {};

	registerHandlers(socket, daves, places, io);
	handlers.dropDavePoint('source');
	assert.equal(Object.keys(places).length, 0);

	daves.source.fragmentsCollected.push('fragment');
	places.existing = { id: 'existing', lat: 41, lng: -87, name: 'Existing' };
	handlers.dropDavePoint('source');
	assert.equal(Object.keys(places).length, 1);
	assert.deepEqual(daves.source.fragmentsCollected, ['fragment']);
});

test('upgradeDavePoint enforces source, range, fragments, and max level', () => {
	const { socket, handlers, io } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'immune',
			lat: 41,
			lng: -87,
			fragmentsCollected: ['fragment']
		},
		other: {
			userId: 'other',
			name: 'Other',
			state: 'daveprime',
			lat: 41,
			lng: -87,
			fragmentsCollected: ['fragment']
		}
	};
	const places = {
		near: { id: 'near', lat: 41, lng: -87, name: 'Near', level: 1 },
		maxed: { id: 'maxed', lat: 41, lng: -87, name: 'Maxed', level: 3 },
		far: { id: 'far', lat: 42, lng: -88, name: 'Far', level: 1 }
	};

	registerHandlers(socket, daves, places, io);

	handlers.upgradeDavePoint('other', 'near');
	assert.equal(places.near.level, 1);

	handlers.upgradeDavePoint('source', 'far');
	assert.equal(places.far.level, 1);

	handlers.upgradeDavePoint('source', 'maxed');
	assert.equal(places.maxed.level, 3);
	assert.deepEqual(daves.source.fragmentsCollected, ['fragment']);

	handlers.upgradeDavePoint('source', 'near');
	assert.equal(places.near.level, 2);
	assert.deepEqual(daves.source.fragmentsCollected, []);
});
