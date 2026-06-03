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

test('dropDavePoint lets DOPE and DAVEPRIME users ignore nearby node restriction', () => {
	for (const daveState of ['dope', 'daveprime']) {
		const { socket, handlers, io } = createHarness();
		const daves = {
			source: {
				userId: 'source',
				name: 'Source',
				state: daveState,
				lat: 41,
				lng: -87,
				fragmentsCollected: ['fragment'],
				tags: []
			}
		};
		const places = {
			existing: { id: 'existing', lat: 41, lng: -87, name: 'Existing' }
		};

		registerHandlers(socket, daves, places, io);
		handlers.dropDavePoint('source');

		assert.equal(Object.keys(places).length, 2);
		assert.deepEqual(daves.source.fragmentsCollected, []);
	}
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

test('doonUpgradePlace lets doon users upgrade a place once per hour', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'immune',
			tags: ['doon'],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		near: { id: 'near', lat: 41, lng: -87, name: 'Near', level: 1 }
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));
	handlers.doonUpgradePlace('source', 'near');
	handlers.doonUpgradePlace('source', 'near');

	assert.equal(places.near.level, 2);
	assert.equal(Number.isFinite(daves.source.lastDoonPlaceUpgradeTime), true);
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('doonUpgradePlace rejects forged, non-doon, out-of-range, and cooling down attempts', () => {
	const { socket, handlers, io } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'immune',
			tags: [],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		near: { id: 'near', lat: 41, lng: -87, name: 'Near', level: 1 },
		far: { id: 'far', lat: 42, lng: -88, name: 'Far', level: 1 },
		maxed: { id: 'maxed', lat: 41, lng: -87, name: 'Maxed', level: 3 }
	};

	registerHandlers(socket, daves, places, io);
	handlers.doonUpgradePlace('other', 'near');
	handlers.doonUpgradePlace('source', 'near');
	daves.source.tags.push('doon');
	handlers.doonUpgradePlace('source', 'far');
	handlers.doonUpgradePlace('source', 'maxed');
	daves.source.lastDoonPlaceUpgradeTime = Date.now();
	handlers.doonUpgradePlace('source', 'near');

	assert.equal(places.near.level, 1);
	assert.equal(places.far.level, 1);
	assert.equal(places.maxed.level, 3);
});

test('joinLinecon grants the linecon tag at skull locations', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		skull: {
			id: 'skull',
			name: '☠️ DEF CON South Entrance',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));
	handlers.joinLinecon('source', 'skull');

	assert.deepEqual(daves.source.tags, ['linecon']);
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('joinLinecon rejects forged, repeated, non-skull, and out-of-range joins', () => {
	const { socket, handlers, io } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		plain: {
			id: 'plain',
			name: 'Plain Place',
			lat: 41,
			lng: -87
		},
		farSkull: {
			id: 'farSkull',
			name: '☠️ Far Line',
			lat: 42,
			lng: -88
		},
		skull: {
			id: 'skull',
			name: '☠️ Near Line',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.joinLinecon('other', 'skull');
	handlers.joinLinecon('source', 'plain');
	handlers.joinLinecon('source', 'farSkull');
	assert.deepEqual(daves.source.tags, []);

	handlers.joinLinecon('source', 'skull');
	handlers.joinLinecon('source', 'skull');
	assert.deepEqual(daves.source.tags, ['linecon']);
});

test('circusCircusParking grants a drink at Circus Circus locations', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const drink = '🍺';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		circus: {
			id: 'circus',
			name: 'Circus Circus',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));
	handlers.circusCircusParking('source', 'circus');

	assert.equal(daves.source[drink].count, 1);
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('circusCircusParking uses the standard drink cooldown', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const drink = '🍺';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		circus: {
			id: 'circus',
			name: 'Circus Circus',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));
	handlers.circusCircusParking('source', 'circus');
	handlers.circusCircusParking('source', 'circus');

	assert.equal(daves.source[drink].count, 1);
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('circusCircusParking rejects forged, non-circus, and out-of-range drink grants', () => {
	const { socket, handlers, io } = createHarness();
	const drink = '🍺';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		plain: {
			id: 'plain',
			name: 'Plain Place',
			lat: 41,
			lng: -87
		},
		farCircus: {
			id: 'farCircus',
			name: 'Circus Circus',
			lat: 42,
			lng: -88
		},
		circus: {
			id: 'circus',
			name: 'Circus Circus',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.circusCircusParking('other', 'circus');
	handlers.circusCircusParking('source', 'plain');
	handlers.circusCircusParking('source', 'farCircus');

	assert.equal(daves.source[drink], undefined);
});

test('claimPlaceFragmentChallenge grants drinks only for alcohol-related Hacker Jeopardy answers', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const drink = '🍺';
	const baby = '👶';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		}
	};
	const places = {
		jeopardy: {
			id: 'jeopardy',
			name: '🙅 Hacker Jeopardy',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'malort', 'What is Malort?');

	assert.equal(daves.source[drink].count, 1);
	assert.equal(daves.source[baby].count, 1);
	assert.equal(Number.isFinite(daves.source.lastHackerJeopardyTime), true);
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('claimPlaceFragmentChallenge grants question-specific Hacker Jeopardy rewards', () => {
	const { socket, handlers, io } = createHarness();
	const hotdog = '🌭';
	const baby = '👶';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			fragmentsCollected: [],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		jeopardy: {
			id: 'jeopardy',
			name: '🙅 Hacker Jeopardy',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'beef-thief', 'Who is beef thief?');
	daves.source.lastHackerJeopardyTime = Date.now() - 61 * 60 * 1000;
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is rubber duck debugging?');

	assert.equal(daves.source[hotdog].count, 1);
	assert.equal(daves.source[baby].count, 2);
	assert.equal(daves.source.fragmentsCollected.length, 1);
	assert.equal(daves.source['🍺'], undefined);
});

test('claimPlaceFragmentChallenge grants fragments for correct hardware and vetcon answers', () => {
	const { socket, handlers, io } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		}
	};
	const places = {
		hardware: {
			id: 'hardware',
			name: '⚙️ Hardware Hacking',
			lat: 41,
			lng: -87
		},
		vets: {
			id: 'vets',
			name: '🎖️ VetCon',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.claimPlaceFragmentChallenge('source', 'hardware', 'hardwareHacking', 'multimeter', 'multi meter');
	daves.source.lastHardwareHackingTime = Date.now() - 61 * 60 * 1000;
	handlers.claimPlaceFragmentChallenge('source', 'vets', 'vetcon', '1900', '7:00 PM');

	assert.equal(daves.source.fragmentsCollected.length, 2);
});

test('claimPlaceFragmentChallenge rejects bad source, range, action, answer, and cooldown', () => {
	const { socket, handlers, io } = createHarness();
	const baby = '👶';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			fragmentsCollected: [],
			lat: 41,
			lng: -87
		}
	};
	const places = {
		jeopardy: {
			id: 'jeopardy',
			name: '🙅 Hacker Jeopardy',
			lat: 41,
			lng: -87
		},
		farHardware: {
			id: 'farHardware',
			name: '⚙️ Hardware Hacking',
			lat: 42,
			lng: -88
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.claimPlaceFragmentChallenge('other', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is rubber duck debugging?');
	handlers.claimPlaceFragmentChallenge('source', 'farHardware', 'hardwareHacking', 'multimeter', 'multimeter');
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hardwareHacking', 'multimeter', 'multimeter');
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is ls?');
	assert.deepEqual(daves.source.fragmentsCollected, []);
	assert.equal(daves.source[baby], undefined);
	assert.equal(Number.isFinite(daves.source.lastHackerJeopardyTime), true);

	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is rubber duck debugging?');
	assert.deepEqual(daves.source.fragmentsCollected, []);
	assert.equal(daves.source[baby], undefined);

	daves.source.lastHackerJeopardyTime = Date.now() - 61 * 60 * 1000;
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is rubber duck debugging?');
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is rubber duck debugging?');
	assert.equal(daves.source.fragmentsCollected.length, 1);
	assert.equal(daves.source[baby].count, 1);
	assert.equal(daves.source['🍺'], undefined);
});

test('collecting too many drinks grants the GDIK tag', () => {
	const { socket, handlers, io } = createHarness();
	const drink = '🍺';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			[drink]: {
				count: 6,
				lastTime: Date.now() - 11 * 60 * 1000
			}
		}
	};
	const places = {};

	registerHandlers(socket, daves, places, io);
	handlers.getItem('source', drink);

	assert.equal(daves.source[drink].count, 7);
	assert.deepEqual(daves.source.tags, ['GDIK']);
});

test('collecting too many peppers at a place grants the peppercon tag', () => {
	const { socket, handlers, io } = createHarness();
	const pepper = '🌶️';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			[pepper]: {
				count: 6,
				lastTime: Date.now() - 11 * 60 * 1000
			}
		}
	};
	const places = {};

	registerHandlers(socket, daves, places, io);
	handlers.getItem('source', pepper);

	assert.equal(daves.source[pepper].count, 7);
	assert.deepEqual(daves.source.tags, ['peppercon']);
});

test('claimTacoGame grants bonus tacos at an in-range taco place', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const taco = '🌮';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		}
	};
	const places = {
		tacoPlace: {
			id: 'tacoPlace',
			name: '🌮 Taco Node',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));
	handlers.claimTacoGame('source', 'tacoPlace', 'shell-integrity', 'Meat or beans');

	assert.equal(daves.source[taco].count, 2);
	assert.ok(daves.source.lastTacoCalibrationTime > 0);
	assert.deepEqual(ioEvents, [{ event: 'update', payload: undefined }]);
	assert.match(logs[0].message, /completed Taco Calibration/);
});

test('claimTacoGame rejects forged, non-taco, out-of-range, wrong, and cooldown attempts', () => {
	const { socket, handlers, ioEvents } = createHarness();
	const taco = '🌮';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		}
	};
	const places = {
		tacoPlace: {
			id: 'tacoPlace',
			name: '🌮 Taco Node',
			lat: 41,
			lng: -87
		},
		hotdogPlace: {
			id: 'hotdogPlace',
			name: '🌭 Hotdog Node',
			lat: 41,
			lng: -87
		},
		farTacoPlace: {
			id: 'farTacoPlace',
			name: '🌮 Far Taco Node',
			lat: 42,
			lng: -88
		}
	};

	registerHandlers(socket, daves, places, { emit: (...args) => ioEvents.push(args) });
	handlers.claimTacoGame('other', 'tacoPlace', 'shell-integrity', 'Meat or beans');
	handlers.claimTacoGame('source', 'hotdogPlace', 'shell-integrity', 'Meat or beans');
	handlers.claimTacoGame('source', 'farTacoPlace', 'shell-integrity', 'Meat or beans');
	handlers.claimTacoGame('source', 'tacoPlace', 'shell-integrity', 'Salsa');
	assert.equal(daves.source[taco], undefined);
	assert.equal(Number.isFinite(daves.source.lastTacoCalibrationTime), true);

	handlers.claimTacoGame('source', 'tacoPlace', 'shell-integrity', 'Meat or beans');
	assert.equal(daves.source[taco], undefined);

	daves.source.lastTacoCalibrationTime = Date.now() - 6 * 60 * 1000;
	handlers.claimTacoGame('source', 'tacoPlace', 'shell-integrity', 'Meat or beans');

	assert.equal(daves.source[taco].count, 2);
	assert.equal(ioEvents.length, 2);
});
