import test from 'node:test';
import assert from 'node:assert/strict';

import { BABY_ITEM } from '../public/utils/babies.js';
import { getNearestPlaceInRange, isTooNear, registerHandlers } from '../utils/places.js';

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

test('nearest in-range place is exposed even when node creation can bypass proximity', () => {
	const source = {
		userId: 'source',
		name: 'Source',
		state: 'immune',
		lat: 41,
		lng: -87,
		fragmentsCollected: ['fragment']
	};
	const places = {
		far: { lat: 41, lng: -86.999, name: 'Far Node' },
		near: { lat: 41, lng: -87, name: 'Near Node' }
	};

	assert.deepEqual(getNearestPlaceInRange(source, places), {
		id: 'near',
		name: 'Near Node',
		distanceMeters: 0
	});
	assert.equal(isTooNear(source, places), true);

	source.state = 'daveprime';
	assert.equal(isTooNear(source, places), false);
	assert.equal(getNearestPlaceInRange(source, places)?.id, 'near');
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
	assert.equal(daves.source.davePointUpgradeCount, undefined);

	handlers.upgradeDavePoint('source', 'far');
	assert.equal(places.far.level, 1);
	assert.equal(daves.source.davePointUpgradeCount, undefined);

	handlers.upgradeDavePoint('source', 'maxed');
	assert.equal(places.maxed.level, 3);
	assert.deepEqual(daves.source.fragmentsCollected, ['fragment']);
	assert.equal(daves.source.davePointUpgradeCount, undefined);

	handlers.upgradeDavePoint('source', 'near');
	assert.equal(places.near.level, 2);
	assert.deepEqual(daves.source.fragmentsCollected, []);
	assert.equal(daves.source.davePointUpgradeCount, 1);
});

test('place interaction works when player and place radii overlap', () => {
	const { socket, handlers, io } = createHarness();
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'immune',
			lat: 41,
			lng: -87,
			fragmentsCollected: ['fragment']
		}
	};
	const places = {
		overlap: { id: 'overlap', lat: 41, lng: -86.9985, name: 'Overlap', level: 2 }
	};

	registerHandlers(socket, daves, places, io);
	handlers.upgradeDavePoint('source', 'overlap');

	assert.equal(places.overlap.level, 3);
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

test('finishDrinkGame grants a drink at in-range cocktail locations', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const drink = '🍺';
	let result;
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
		bar: {
			id: 'bar',
			name: '🍸 Corner Bar',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));
	handlers.finishDrinkGame('source', 'bar', true, (payload) => {
		result = payload;
	});

	assert.equal(daves.source[drink].count, 1);
	assert.deepEqual(result, { ok: true, won: true, granted: true });
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('getting a drink can lose a baby and logs the loss', () => {
	const { socket, handlers, io, logs } = createHarness();
	const drink = '🍺';
	const baby = '👶';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87,
			[baby]: {
				count: 1,
				lastTime: Date.now()
			}
		}
	};
	const places = {
		bar: {
			id: 'bar',
			name: '🍸 Corner Bar',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }), () => {}, () => 0.19);
	handlers.finishDrinkGame('source', 'bar', true);

	assert.equal(daves.source[drink].count, 1);
	assert.equal(daves.source[baby].count, 0);
	assert.equal(daves.source.babiesLost, 1);
	assert.equal(logs.some(({ message }) => message === "Where's your baby, Source?"), true);
});

test('getting a drink does not lose a baby when the chance misses or cooldown blocks the drink', () => {
	const { socket, handlers, io, logs } = createHarness();
	const drink = '🍺';
	const baby = '👶';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: [],
			lat: 41,
			lng: -87,
			[baby]: {
				count: 2,
				lastTime: Date.now()
			}
		}
	};
	const places = {
		bar: {
			id: 'bar',
			name: '🍸 Corner Bar',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }), () => {}, () => 0.2);
	handlers.finishDrinkGame('source', 'bar', true);
	handlers.finishDrinkGame('source', 'bar', true);

	assert.equal(daves.source[drink].count, 1);
	assert.equal(daves.source[baby].count, 2);
	assert.equal(daves.source.babiesLost, undefined);
	assert.equal(logs.some(({ message }) => message === "Where's your baby, Source?"), false);
});

test('finishDrinkGame rejects losses, forged, non-cocktail, out-of-range, and cooldown attempts', () => {
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
		bar: {
			id: 'bar',
			name: '🍸 Corner Bar',
			lat: 41,
			lng: -87
		},
		plain: {
			id: 'plain',
			name: 'Plain Place',
			lat: 41,
			lng: -87
		},
		farBar: {
			id: 'farBar',
			name: '🍸 Far Bar',
			lat: 42,
			lng: -88
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.finishDrinkGame('source', 'bar', false);
	handlers.finishDrinkGame('other', 'bar', true);
	handlers.finishDrinkGame('source', 'plain', true);
	handlers.finishDrinkGame('source', 'farBar', true);
	assert.equal(daves.source[drink], undefined);

	handlers.finishDrinkGame('source', 'bar', true);
	handlers.finishDrinkGame('source', 'bar', true);
	assert.equal(daves.source[drink].count, 1);
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
	assert.equal(daves.source[baby], undefined);
	assert.equal(Number.isFinite(daves.source.lastHackerJeopardyTime), true);
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('claimHackerJeopardyBaby can trigger the plastic baby pass for first Hacker Jeopardy baby', () => {
	const { socket, handlers, io } = createHarness();
	const baby = '👶';
	let result;
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

	registerHandlers(socket, daves, places, io, () => {}, () => {}, () => 0.49);
	handlers.claimHackerJeopardyBaby('source', 'jeopardy', (payload) => {
		result = payload;
	});

	assert.equal(daves.source[baby], undefined);
	assert.equal(Number.isFinite(daves.source.pendingPlasticBabyPassTime), true);
	assert.equal(Number.isFinite(daves.source.lastHackerJeopardyBabyTime), true);
	assert.deepEqual(result, { ok: true, plasticBabyPass: true, granted: false });
});

test('finishPlasticBabyPass grants or drops a pending plastic baby pass', () => {
	const baby = '👶';
	const createJeopardyHarness = () => {
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
			jeopardy: {
				id: 'jeopardy',
				name: '🙅 Hacker Jeopardy',
				lat: 41,
				lng: -87
			}
		};
		registerHandlers(socket, daves, places, io, () => {}, () => {}, () => 0);
		handlers.claimHackerJeopardyBaby('source', 'jeopardy', () => {});
		return { handlers, dave: daves.source };
	};

	const winHarness = createJeopardyHarness();
	let winResult;
	winHarness.handlers.finishPlasticBabyPass('source', true, (payload) => {
		winResult = payload;
	});

	const dropHarness = createJeopardyHarness();
	let dropResult;
	dropHarness.handlers.finishPlasticBabyPass('source', false, (payload) => {
		dropResult = payload;
	});

	assert.equal(winHarness.dave[baby].count, 1);
	assert.equal(winHarness.dave.babiesLost, undefined);
	assert.equal(winHarness.dave.pendingPlasticBabyPassTime, undefined);
	assert.equal(dropHarness.dave[baby], undefined);
	assert.equal(dropHarness.dave.babiesLost, 1);
	assert.equal(dropHarness.dave.pendingPlasticBabyPassTime, undefined);
	assert.deepEqual(winResult, { ok: true, won: true, granted: true });
	assert.deepEqual(dropResult, { ok: true, won: false, granted: false });
});

test('claimHackerJeopardyBaby always starts the baby minigame', () => {
	const baby = '👶';
	const createJeopardyHarness = (dave) => {
		const { socket, handlers, io } = createHarness();
		const places = {
			jeopardy: {
				id: 'jeopardy',
				name: '🙅 Hacker Jeopardy',
				lat: 41,
				lng: -87
			}
		};
		registerHandlers(socket, { source: dave }, places, io, () => {}, () => {}, () => 1);
		return handlers;
	};

	const noBabyDave = {
		userId: 'source',
		name: 'Source',
		lat: 41,
		lng: -87
	};
	let noBabyResult;
	createJeopardyHarness(noBabyDave)
		.claimHackerJeopardyBaby('source', 'jeopardy', (payload) => {
			noBabyResult = payload;
		});

	const existingBabyDave = {
		userId: 'source',
		name: 'Source',
		lat: 41,
		lng: -87,
		[baby]: {
			count: 1,
			lastTime: Date.now()
		}
	};
	let existingBabyResult;
	createJeopardyHarness(existingBabyDave)
		.claimHackerJeopardyBaby('source', 'jeopardy', (payload) => {
			existingBabyResult = payload;
		});

	assert.equal(noBabyDave[baby], undefined);
	assert.equal(Number.isFinite(noBabyDave.pendingPlasticBabyPassTime), true);
	assert.equal(existingBabyDave[baby].count, 1);
	assert.equal(Number.isFinite(existingBabyDave.pendingPlasticBabyPassTime), true);
	assert.deepEqual(noBabyResult, { ok: true, plasticBabyPass: true, granted: false });
	assert.deepEqual(existingBabyResult, { ok: true, plasticBabyPass: true, granted: false });
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
	daves.source.lastHackerJeopardyTime = Date.now() - 11 * 60 * 1000;
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is rubber duck debugging?');

	assert.equal(daves.source[hotdog].count, 1);
	assert.equal(daves.source[baby], undefined);
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

test('finishSolderingGame grants an SAO at in-range HHV locations', () => {
	const { socket, handlers, io, ioEvents, logs } = createHarness();
	const sao = '𓇲';
	let result;
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			lat: 41,
			lng: -87
		}
	};
	const places = {
		hhv: {
			id: 'hhv',
			name: 'HHV Soldering Lab',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io, (message, options) => logs.push({ message, options }));
	handlers.finishSolderingGame('source', 'hhv', true, (payload) => {
		result = payload;
	});

	assert.equal(daves.source[sao].count, 1);
	assert.equal(daves.source.fragmentsCollected, undefined);
	assert.equal(Number.isFinite(daves.source.lastHardwareHackingTime), true);
	assert.deepEqual(result, { ok: true, won: true, granted: true, saoCount: 1 });
	assert.equal(ioEvents.length, 1);
	assert.match(logs[0].message, /completed HHV soldering/);
});

test('finishSolderingGame ignores incomplete games and rejects forged, non-HHV, out-of-range, and cooldown attempts', () => {
	const { socket, handlers, io } = createHarness();
	const sao = '𓇲';
	let incompleteResult;
	let forgedResult;
	let mismatchResult;
	let farResult;
	let cooldownResult;
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
		hhv: {
			id: 'hhv',
			name: 'HHV Soldering Lab',
			lat: 41,
			lng: -87
		},
		plain: {
			id: 'plain',
			name: 'Plain Place',
			lat: 41,
			lng: -87
		},
		farHhv: {
			id: 'farHhv',
			name: 'Hardware Hacking Village',
			lat: 42,
			lng: -88
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.finishSolderingGame('source', 'hhv', false, (payload) => {
		incompleteResult = payload;
	});
	handlers.finishSolderingGame('other', 'hhv', true, (payload) => {
		forgedResult = payload;
	});
	handlers.finishSolderingGame('source', 'plain', true, (payload) => {
		mismatchResult = payload;
	});
	handlers.finishSolderingGame('source', 'farHhv', true, (payload) => {
		farResult = payload;
	});
	assert.deepEqual(daves.source.fragmentsCollected, []);
	assert.equal(daves.source[sao], undefined);

	handlers.finishSolderingGame('source', 'hhv', true);
	handlers.finishSolderingGame('source', 'hhv', true, (payload) => {
		cooldownResult = payload;
	});

	assert.equal(daves.source.fragmentsCollected.length, 0);
	assert.equal(daves.source[sao].count, 1);
	assert.deepEqual(incompleteResult, { ok: true, won: false, granted: false });
	assert.deepEqual(forgedResult, { ok: false, error: 'source mismatch' });
	assert.deepEqual(mismatchResult, { ok: false, error: 'soldering unavailable' });
	assert.deepEqual(farResult, { ok: false, error: 'soldering unavailable' });
	assert.deepEqual(cooldownResult, { ok: false, error: 'soldering cooldown active' });
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

	daves.source.lastHackerJeopardyTime = Date.now() - 11 * 60 * 1000;
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is rubber duck debugging?');
	handlers.claimPlaceFragmentChallenge('source', 'jeopardy', 'hackerJeopardy', 'rubber-duck', 'What is rubber duck debugging?');
	assert.equal(daves.source.fragmentsCollected.length, 1);
	assert.equal(daves.source[baby], undefined);
	assert.equal(daves.source['🍺'], undefined);
});

test('claimHackerJeopardyBaby has its own one hour cooldown', () => {
	const { socket, handlers, io } = createHarness();
	const baby = BABY_ITEM;
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
			name: 'ðŸ™… Hacker Jeopardy',
			lat: 41,
			lng: -87
		},
		hardware: {
			id: 'hardware',
			name: 'âš™ï¸ Hardware Hacking',
			lat: 41,
			lng: -87
		}
	};
	let firstResult;
	let cooldownResult;
	let mismatchResult;

	registerHandlers(socket, daves, places, io, () => {}, () => {}, () => 1);
	handlers.claimHackerJeopardyBaby('source', 'jeopardy', (payload) => {
		firstResult = payload;
	});
	handlers.claimHackerJeopardyBaby('source', 'jeopardy', (payload) => {
		cooldownResult = payload;
	});
	daves.source.lastHackerJeopardyBabyTime = Date.now() - 61 * 60 * 1000;
	handlers.claimHackerJeopardyBaby('source', 'hardware', (payload) => {
		mismatchResult = payload;
	});

	assert.equal(daves.source[baby], undefined);
	assert.equal(Number.isFinite(daves.source.pendingPlasticBabyPassTime), true);
	assert.deepEqual(firstResult, { ok: true, plasticBabyPass: true, granted: false });
	assert.deepEqual(cooldownResult, { ok: false, error: 'baby cooldown active' });
	assert.deepEqual(mismatchResult, { ok: false, error: 'baby unavailable' });
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

test('getting a hotdog at a place between 2 AM and 4 AM grants the redeye tag', (t) => {
	const redeyeTime = new Date(2026, 0, 1, 3, 59).getTime();
	t.mock.method(Date, 'now', () => redeyeTime);

	const { socket, handlers, io } = createHarness();
	const hotdog = '🌭';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: []
		}
	};
	const places = {};

	registerHandlers(socket, daves, places, io);
	handlers.getItem('source', hotdog);

	assert.equal(daves.source[hotdog].count, 1);
	assert.deepEqual(daves.source.tags, ['redeye']);
});

test('getting $2 hotdogs at a hotdog place grants two hotdogs', () => {
	const { socket, handlers, io } = createHarness();
	const hotdog = '🌭';
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
		hotdogPlace: {
			id: 'hotdogPlace',
			name: '🌭 Slots A Fun',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.getItem('source', 'hotdogPlace', hotdog);

	assert.equal(daves.source[hotdog].count, 2);
});

test('getting $2 beers at a hotdog place grants two beers', () => {
	const { socket, handlers, io } = createHarness();
	const beer = '🍺';
	const cocktail = '🍸';
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
		hotdogPlace: {
			id: 'hotdogPlace',
			name: '🌭 Slots A Fun',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.getItem('source', 'hotdogPlace', cocktail);

	assert.equal(daves.source[beer].count, 2);
});

test('place item claims require the requested item to belong to the place source', () => {
	const { socket, handlers, io } = createHarness();
	const hotdog = '🌭';
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
		tacoPlace: {
			id: 'tacoPlace',
			name: '🌮 Taco Node',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, places, io);
	handlers.getItem('source', 'tacoPlace', hotdog);

	assert.equal(daves.source[hotdog], undefined);
});

test('getting a hotdog at 4 AM does not grant the redeye tag', (t) => {
	const afterRedeyeTime = new Date(2026, 0, 1, 4, 0).getTime();
	t.mock.method(Date, 'now', () => afterRedeyeTime);

	const { socket, handlers, io } = createHarness();
	const hotdog = '🌭';
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			tags: []
		}
	};
	const places = {};

	registerHandlers(socket, daves, places, io);
	handlers.getItem('source', hotdog);

	assert.equal(daves.source[hotdog].count, 1);
	assert.deepEqual(daves.source.tags, []);
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
