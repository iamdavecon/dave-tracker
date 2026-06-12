import test from 'node:test';
import assert from 'node:assert/strict';

import { registerHandlers } from '../utils/stabilize.js';

const DEBUG_ID = '59a388e8-413a-4d8e-906e-15469bb3b471';

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

test('stabilize can award DoD commendations and grant general', () => {
	const { socket, handlers } = createSocket('source');
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'immune',
			dodLevel: 1,
			dodCommendations: 8,
			tags: ['dod'],
			fragmentsCollected: [],
			lat: 41,
			lng: -87
		},
		target: { userId: 'target', name: 'Target', state: 'unstable', lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, {}, { emit: () => {} }, () => {}, (dave, points) => {
		dave.dodCommendations = (dave.dodCommendations ?? 0) + points;
		if (dave.dodCommendations >= 10) {
			dave.tags.push('general');
		}
	});
	handlers.stabilize('source', 'target');

	assert.equal(daves.source.dodCommendations, 10);
	assert.deepEqual(daves.source.tags, ['dod', 'general']);
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

test('ascendPlayer rejects bot targets', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const daves = {
		source: { userId: 'source', name: 'Source', state: 'ascended', fragmentsCollected: [], lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', state: 'infected', isBot: true, lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: () => {} }, (message) => logs.push(message));
	handlers.ascendPlayer('source', 'target');

	assert.equal(daves.target.state, 'infected');
	assert.deepEqual(daves.source.fragmentsCollected, []);
	assert.equal(logs.length, 0);
});

test('badDecision requires peppercon and GDIK, ascends target, and grants a fragment', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const ioEvents = [];
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'ascended',
			tags: ['peppercon', 'GDIK'],
			fragmentsCollected: [],
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: 'Target',
			state: 'infected',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));
	handlers.badDecision('source', 'target');

	assert.equal(daves.target.state, 'unstable');
	assert.equal(daves.source.fragmentsCollected.length, 2);
	assert.equal(daves.source.fragmentsCollected[0], 'target');
	assert.equal(daves.source.badDecisionsMade, 1);
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);
});

test('badDecision grants the bad-decision tag after 3 successful bad decisions', () => {
	const { socket, handlers } = createSocket('source');
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'ascended',
			tags: ['peppercon', 'GDIK'],
			fragmentsCollected: [],
			lat: 41,
			lng: -87,
			badDecisionsMade: 2
		},
		target: {
			userId: 'target',
			name: 'Target',
			state: 'infected',
			lat: 41,
			lng: -87
		}
	};

	registerHandlers(socket, daves, { emit: () => {} });
	handlers.badDecision('source', 'target');

	assert.equal(daves.source.badDecisionsMade, 3);
	assert.equal(daves.source.tags.includes('bad-decision'), true);
});

test('badDecision rejects forged, missing-tag, ineligible, and out-of-range attempts', () => {
	const { socket, handlers } = createSocket('source');
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'ascended',
			tags: ['peppercon'],
			fragmentsCollected: [],
			lat: 41,
			lng: -87
		},
		target: {
			userId: 'target',
			name: 'Target',
			state: 'infected',
			lat: 41,
			lng: -87
		},
		far: {
			userId: 'far',
			name: 'Far',
			state: 'infected',
			lat: 42,
			lng: -88
		}
	};

	registerHandlers(socket, daves, { emit: () => {} });
	handlers.badDecision('other', 'target');
	handlers.badDecision('source', 'target');
	daves.source.tags.push('GDIK');
	daves.source.fragmentsCollected.push('target');
	handlers.badDecision('source', 'target');
	daves.source.fragmentsCollected = [];
	handlers.badDecision('source', 'far');

	assert.equal(daves.target.state, 'infected');
	assert.equal(daves.far.state, 'infected');
	assert.deepEqual(daves.source.fragmentsCollected, []);
});

test('decreaseStatus lets infected users lower another in-range user status', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const ioEvents = [];
	const daves = {
		source: { userId: 'source', name: 'Source', state: 'infected', fragmentsCollected: [], lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', state: 'immune', lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));
	handlers.decreaseStatus('source', 'target');

	assert.equal(daves.target.state, 'unstable');
	assert.equal(daves.source.fragmentsCollected.length, 2);
	assert.equal(daves.source.fragmentsCollected[0], 'target');
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);

	daves.target.state = 'immune';
	handlers.decreaseStatus('source', 'target');

	assert.equal(daves.target.state, 'immune');
	assert.equal(daves.source.fragmentsCollected.length, 2);
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);

	daves.source.fragmentsCollected.shift();
	handlers.decreaseStatus('source', 'target');

	assert.equal(daves.target.state, 'unstable');
	assert.equal(daves.source.fragmentsCollected.length, 3);
	assert.equal(daves.source.fragmentsCollected.includes('target'), true);
	assert.equal(logs.length, 2);
	assert.equal(ioEvents.length, 2);
});

test('doonShift corrupts infected hosts once and grants two fragments', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const ioEvents = [];
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'immune',
			tags: ['doon'],
			fragmentsCollected: [],
			lat: 41,
			lng: -87
		},
		target: { userId: 'target', name: 'Target', state: 'infected', lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));
	handlers.doonShift('source', 'target');

	assert.equal(daves.target.state, 'corrupted');
	assert.equal(daves.source.fragmentsCollected.length, 2);
	assert.equal(daves.source.fragmentsCollected[0], 'target');
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);

	daves.target.state = 'infected';
	handlers.doonShift('source', 'target');

	assert.equal(daves.target.state, 'infected');
	assert.equal(daves.source.fragmentsCollected.length, 2);
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);

	daves.source.fragmentsCollected.shift();
	handlers.doonShift('source', 'target');

	assert.equal(daves.target.state, 'corrupted');
	assert.equal(daves.source.fragmentsCollected.length, 3);
	assert.equal(daves.source.fragmentsCollected.includes('target'), true);
	assert.equal(logs.length, 2);
	assert.equal(ioEvents.length, 2);
});

test('decreaseStatus rejects forged, stable, self, maxed, and out-of-range attempts', () => {
	const { socket, handlers } = createSocket('source');
	const ioEvents = [];
	const daves = {
		source: { userId: 'source', name: 'Source', state: 'infected', lat: 41, lng: -87 },
		stable: { userId: 'stable', name: 'Stable', state: 'immune', lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', state: 'immune', lat: 41, lng: -87 },
		maxed: { userId: 'maxed', name: 'Maxed', state: 'corrupted', lat: 41, lng: -87 },
		far: { userId: 'far', name: 'Far', state: 'immune', lat: 42, lng: -88 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) });
	handlers.decreaseStatus('other', 'target');
	daves.source.state = 'immune';
	handlers.decreaseStatus('source', 'target');
	daves.source.state = 'infected';
	handlers.decreaseStatus('source', 'source');
	handlers.decreaseStatus('source', 'maxed');
	handlers.decreaseStatus('source', 'far');

	assert.equal(daves.source.state, 'infected');
	assert.equal(daves.target.state, 'immune');
	assert.equal(daves.maxed.state, 'corrupted');
	assert.equal(daves.far.state, 'immune');
	assert.deepEqual(ioEvents, []);
});

test('grantTag lets DavePrime grant a tag to an in-range user', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const ioEvents = [];
	const daves = {
		source: { userId: 'source', name: 'Source', state: 'daveprime', lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', tags: [], lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));
	handlers.grantTag('source', 'target', ' general ');

	assert.deepEqual(daves.target.tags, ['general']);
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);
});

test('grantTag lets debug users grant a tag outside normal range', () => {
	const { socket, handlers } = createSocket(DEBUG_ID);
	const logs = [];
	const ioEvents = [];
	const daves = {
		[DEBUG_ID]: { userId: DEBUG_ID, name: 'Debug', state: 'immune', lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', tags: [], lat: 42, lng: -88 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));
	handlers.grantTag(DEBUG_ID, 'target', 'general');

	assert.deepEqual(daves.target.tags, ['general']);
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);
});

test('grantTag rejects forged, non-prime, bot, out-of-range, empty, and duplicate grants', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const ioEvents = [];
	const daves = {
		source: { userId: 'source', name: 'Source', state: 'immune', lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target', tags: [], lat: 41, lng: -87 },
		far: { userId: 'far', name: 'Far', tags: [], lat: 42, lng: -88 },
		bot: { userId: 'bot', name: 'Bot', isBot: true, tags: [], lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));
	handlers.grantTag('other', 'target', 'general');
	handlers.grantTag('source', 'target', 'general');
	daves.source.state = 'daveprime';
	handlers.grantTag('source', 'target', '   ');
	handlers.grantTag('source', 'far', 'general');
	handlers.grantTag('source', 'bot', 'general');
	handlers.grantTag('source', 'target', 'general');
	handlers.grantTag('source', 'target', 'general');

	assert.deepEqual(daves.target.tags, ['general']);
	assert.deepEqual(daves.far.tags, []);
	assert.deepEqual(daves.bot.tags, []);
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);
});

test('introduceDaveTangent grants the source player the DT tag once', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const ioEvents = [];
	const daves = {
		source: { userId: 'source', name: 'Source', tags: [], lat: 41, lng: -87 },
		tangent: { userId: 'tangent', name: 'DaveTangent', isBot: true, lat: 41, lng: -87 },
		civilian: { userId: 'civilian', name: 'CIVILIAN', isBot: true, lat: 41, lng: -87 },
		farTangent: { userId: 'farTangent', name: 'DaveTangent', isBot: true, lat: 42, lng: -88 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));
	handlers.introduceDaveTangent('other', 'tangent');
	handlers.introduceDaveTangent('source', 'civilian');
	handlers.introduceDaveTangent('source', 'farTangent');
	handlers.introduceDaveTangent('source', 'tangent');
	handlers.introduceDaveTangent('source', 'tangent');

	assert.deepEqual(daves.source.tags, ['DT']);
	assert.equal(logs.length, 1);
	assert.equal(ioEvents.length, 1);
});

test('claimGoonRaffle grants one black badge raffle ticket per GOON', () => {
	const { socket, handlers } = createSocket('source');
	const logs = [];
	const ioEvents = [];
	const daves = {
		source: { userId: 'source', name: 'Source', lat: 41, lng: -87 },
		goon: { userId: 'goon', name: 'GOON', isBot: true, lat: 41, lng: -87 },
		otherGoon: { userId: 'otherGoon', name: 'GOON', isBot: true, lat: 41, lng: -87 },
		civilian: { userId: 'civilian', name: 'CIVILIAN', isBot: true, lat: 41, lng: -87 },
		farGoon: { userId: 'farGoon', name: 'GOON', isBot: true, lat: 42, lng: -88 }
	};

	registerHandlers(socket, daves, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));
	handlers.claimGoonRaffle('other', 'goon');
	handlers.claimGoonRaffle('source', 'civilian');
	handlers.claimGoonRaffle('source', 'farGoon');
	handlers.claimGoonRaffle('source', 'goon');
	handlers.claimGoonRaffle('source', 'goon');
	handlers.claimGoonRaffle('source', 'otherGoon');

	assert.deepEqual(daves.source.claimedGoonRaffles, ['goon', 'otherGoon']);
	assert.deepEqual(daves.source["Black Badge Raffle Tickets"].count, 2);
	assert.equal(logs.length, 2);
	assert.equal(ioEvents.length, 2);
});
