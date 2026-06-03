import test from 'node:test';
import assert from 'node:assert/strict';

import { registerHandlers } from '../utils/items.js';

function createHarness(userId = 'source') {
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

test('getItemFromUser grants peppers from nearby pepper-named users', () => {
	const { socket, handlers, io, ioEvents } = createHarness();
	const pepper = '🌶️';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: '🌶️ Pepper Dave',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, io);
	handlers.getItemFromUser('source', 'target', pepper);

	assert.equal(daves.source[pepper].count, 1);
	assert.deepEqual(ioEvents, [{ event: 'update', payload: undefined }]);
});

test('getItemFromUser rejects spoofed sources and non-pepper targets', () => {
	const { socket, handlers, io } = createHarness();
	const pepper = '🌶️';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: 'Plain Dave',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, io);
	handlers.getItemFromUser('other', 'target', pepper);
	handlers.getItemFromUser('source', 'target', pepper);

	assert.equal(daves.source[pepper], undefined);
});

test('collecting too many peppers from users grants the peppercon tag', () => {
	const { socket, handlers, io } = createHarness();
	const pepper = '🌶️';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87,
			[pepper]: {
				count: 6,
				lastTime: Date.now() - 11 * 60 * 1000
			}
		},
		target: {
			userId: 'target',
			name: '🌶️ Pepper Dave',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, io);
	handlers.getItemFromUser('source', 'target', pepper);

	assert.equal(daves.source[pepper].count, 7);
	assert.deepEqual(daves.source.tags, ['peppercon']);
});

test('eatTaco spends a taco and starts a temporary range boost', () => {
	const { socket, handlers, io, ioEvents } = createHarness();
	const taco = '🌮';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			[taco]: {
				count: 2,
				lastTime: Date.now()
			}
		}
	};

	registerHandlers(socket, daves, io);
	handlers.eatTaco('source');

	assert.equal(daves.source[taco].count, 1);
	assert.ok(daves.source.tacoRangeBoostUntil > Date.now());
	assert.deepEqual(ioEvents, [{ event: 'update', payload: undefined }]);
});

test('eatTaco rejects spoofed sources and empty taco inventory', () => {
	const { socket, handlers, ioEvents } = createHarness();
	const taco = '🌮';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			[taco]: {
				count: 0,
				lastTime: Date.now()
			}
		}
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) });
	handlers.eatTaco('other');
	handlers.eatTaco('source');

	assert.equal(daves.source[taco].count, 0);
	assert.equal(daves.source.tacoRangeBoostUntil, undefined);
	assert.deepEqual(ioEvents, []);
});
