import test from 'node:test';
import assert from 'node:assert/strict';

import { applyItemHandle, registerHandlers } from '../utils/items.js';

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

test('getItemFromUser grants the first item from nearby item-named users', () => {
	const { socket, handlers, io, ioEvents } = createHarness();
	const taco = '🌮';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: '🌮 Taco Dave',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, io);
	handlers.getItemFromUser('source', 'target', taco);

	assert.equal(daves.source[taco].count, 1);
	assert.deepEqual(ioEvents, [{ event: 'update', payload: undefined }]);
});

test('getItemFromUser rejects spoofed sources and non-item-first targets', () => {
	const { socket, handlers, io } = createHarness();
	const taco = '🌮';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: '👶 🌮 Dave',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, io);
	handlers.getItemFromUser('other', 'target', taco);
	handlers.getItemFromUser('source', 'target', taco);

	assert.equal(daves.source[taco], undefined);
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

test('getting a hotdog from a user between 2 AM and 4 AM grants the redeye tag', (t) => {
	const redeyeTime = new Date(2026, 0, 1, 2, 30).getTime();
	t.mock.method(Date, 'now', () => redeyeTime);

	const { socket, handlers, io } = createHarness();
	const hotdog = '🌭';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: '🌭 Hotdog Dave',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, io);
	handlers.getItemFromUser('source', 'target', hotdog);

	assert.equal(daves.source[hotdog].count, 1);
	assert.deepEqual(daves.source.tags, ['redeye']);
});

test('receive baby transfer moves a baby only after a successful minigame', () => {
	const { socket, handlers, io, ioEvents } = createHarness();
	const baby = '👶';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: 'Target',
			lat: 41,
			lng: -87,
			[baby]: {
				count: 2,
				lastTime: Date.now()
			}
		}
	};
	let startResult;
	let finishResult;

	registerHandlers(socket, daves, io);
	handlers.startReceiveBaby('source', 'target', (result) => {
		startResult = result;
	});
	handlers.finishReceiveBaby('source', true, (result) => {
		finishResult = result;
	});

	assert.deepEqual(startResult, { ok: true });
	assert.deepEqual(finishResult, { ok: true, won: true, transferred: true });
	assert.equal(daves.source[baby].count, 1);
	assert.equal(daves.source.babiesReceived, 1);
	assert.equal(daves.source.babiesLost, undefined);
	assert.equal(daves.source.pendingBabyTransfer, undefined);
	assert.equal(daves.target[baby].count, 1);
	assert.deepEqual(ioEvents, [{ event: 'update', payload: undefined }]);
});

test('receive baby transfer loss clears pending transfer without moving baby', () => {
	const { socket, handlers, io } = createHarness();
	const baby = '👶';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: 'Target',
			lat: 41,
			lng: -87,
			[baby]: {
				count: 1,
				lastTime: Date.now()
			}
		}
	};
	let finishResult;

	registerHandlers(socket, daves, io);
	handlers.startReceiveBaby('source', 'target', () => {});
	handlers.finishReceiveBaby('source', false, (result) => {
		finishResult = result;
	});

	assert.deepEqual(finishResult, { ok: true, won: false, transferred: false });
	assert.equal(daves.source[baby], undefined);
	assert.equal(daves.source.babiesReceived, undefined);
	assert.equal(daves.source.babiesLost, 1);
	assert.equal(daves.source.pendingBabyTransfer, undefined);
	assert.equal(daves.target[baby].count, 1);
});

test('receive baby transfer rejects unavailable babies', () => {
	const { socket, handlers, io } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: 'Target',
			lat: 41,
			lng: -87
		}
	};
	let result;

	registerHandlers(socket, daves, io);
	handlers.startReceiveBaby('source', 'target', (payload) => {
		result = payload;
	});

	assert.deepEqual(result, { ok: false, error: 'baby unavailable' });
	assert.equal(daves.source.pendingBabyTransfer, undefined);
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

test('applyItemHandle adds or replaces the first emoji in a handle', () => {
	const taco = '🌮';
	const hotdog = '🌭';

	assert.equal(applyItemHandle('Dave', taco), '🌮Dave');
	assert.equal(applyItemHandle('🌶️ Pepper Dave', hotdog), '🌭 Pepper Dave');
	assert.equal(applyItemHandle('Dave 🍸 Later', taco), 'Dave 🌮 Later');
});

test('becomeItem updates the source handle for owned items', () => {
	const { socket, handlers, io, ioEvents } = createHarness();
	const taco = '🌮';
	const daves = {
		source: {
			userId: 'source',
			name: 'Dave',
			[taco]: {
				count: 1,
				lastTime: Date.now()
			}
		}
	};
	let result;

	registerHandlers(socket, daves, io);
	handlers.becomeItem('source', taco, (payload) => {
		result = payload;
	});

	assert.deepEqual(result, { ok: true, name: '🌮Dave' });
	assert.equal(daves.source.name, '🌮Dave');
	assert.deepEqual(ioEvents, [{ event: 'update', payload: undefined }]);
});

test('becomeItem rejects spoofed, unknown, and empty item requests', () => {
	const { socket, handlers, ioEvents } = createHarness();
	const taco = '🌮';
	const daves = {
		source: {
			userId: 'source',
			name: 'Dave',
			[taco]: {
				count: 0,
				lastTime: Date.now()
			}
		}
	};
	const results = [];

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) });
	handlers.becomeItem('other', taco, (payload) => results.push(payload));
	handlers.becomeItem('source', 'not-an-item', (payload) => results.push(payload));
	handlers.becomeItem('source', taco, (payload) => results.push(payload));

	assert.deepEqual(results, [
		{ ok: false, error: 'source mismatch' },
		{ ok: false, error: 'item unavailable' },
		{ ok: false, error: 'item unavailable' }
	]);
	assert.equal(daves.source.name, 'Dave');
	assert.deepEqual(ioEvents, []);
});
