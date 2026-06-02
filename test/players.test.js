import test from 'node:test';
import assert from 'node:assert/strict';

import { canStartDaveRave, countDavesInArea, summarizeDave, getInteraction, getLinkedDaveSummaries, removeFragment } from '../utils/players.js';

test('summarizeDave calculates leaderboard scores and keeps tags', () => {
	const summary = summarizeDave({
		userId: 'dave-1',
		name: 'Leaderboard Dave',
		state: 'resonant',
		infectedUsers: ['a', 'b'],
		fragmentsCollected: ['f1', 'f2', 'f3'],
		nodeCount: 2,
		daveravesStarted: 1,
		linkedDaves: ['dave-2', 'dave-3'],
		'ðŸŒ­': { count: 3, lastTime: Date.now() },
		'ðŸº': { count: 1, lastTime: Date.now() },
		tags: ['standard-user', 'dod']
	}, {
		node1: { owner: 'dave-1' },
		node2: { owner: 'dave-1', level: 2 }
	});

	assert.deepEqual(summary, {
		userId: 'dave-1',
		name: 'Leaderboard Dave',
		score: 56,
		teamVirus: 2,
		teamAntivirus: 13,
		state: 'RESONANT',
		tags: ['admin', 'dod']
	});
});

test('summarizeDave handles missing optional scoring fields', () => {
	const summary = summarizeDave({
		userId: 'dave-2',
		name: 'Fresh Dave'
	});

	assert.equal(summary.score, 0);
	assert.equal(summary.teamVirus, 0);
	assert.equal(summary.teamAntivirus, 0);
	assert.equal(summary.state, 'UNSTABLE');
	assert.deepEqual(summary.tags, []);
});

test('getLinkedDaveSummaries returns linked users in saved order', () => {
	const summary = getLinkedDaveSummaries(
		{ linkedDaves: ['target', 'missing', 'other'] },
		{
			target: { userId: 'target', name: 'Target Dave', state: 'immune' },
			other: { userId: 'other', name: 'Other Dave', state: 'voided' }
		}
	);

	assert.deepEqual(summary, [
		{ userId: 'target', name: 'Target Dave', state: 'IMMUNE' },
		{ userId: 'other', name: 'Other Dave', state: 'UNSTABLE' }
	]);
});

test('getInteraction exposes pepper pickup for pepper-named users', () => {
	const me = {
		userId: 'source',
		name: 'Source',
		lat: 41,
		lng: -87
	};
	const target = {
		userId: 'target',
		name: '🌶️ Pepper Dave',
		lat: 41,
		lng: -87
	};

	const details = getInteraction(me, target);

	assert.equal(details.availableActions.hasPepper, true);
	assert.equal(details.availableActions.canGetPepper, true);
});

test('getInteraction respects pepper pickup cooldown', () => {
	const pepper = '🌶️';
	const me = {
		userId: 'source',
		name: 'Source',
		[pepper]: {
			count: 1,
			lastTime: Date.now()
		}
	};
	const target = {
		userId: 'target',
		name: '🌶 Pepper Dave'
	};

	const details = getInteraction(me, target);

	assert.equal(details.availableActions.hasPepper, true);
	assert.equal(details.availableActions.canGetPepper, false);
	assert.ok(details.availableActions.pepperCooldownRemaining > 0);
});

test('countDavesInArea counts non-bot daves in range and enables Dave Raves at ten players', () => {
	const source = {
		userId: 'source',
		name: 'Source',
		lat: 41,
		lng: -87
	};
	const daves = { source };

	for (let i = 0; i < 9; i++) {
		daves[`near-${i}`] = {
			userId: `near-${i}`,
			name: `Near ${i}`,
			lat: 41,
			lng: -87
		};
	}
	daves.bot = {
		userId: 'bot',
		name: 'Bot',
		isBot: true,
		lat: 41,
		lng: -87
	};
	daves.far = {
		userId: 'far',
		name: 'Far',
		lat: 42,
		lng: -88
	};

	assert.equal(countDavesInArea(source, daves), 10);
	assert.equal(canStartDaveRave(source, daves), true);

	source.lastDaveRaveTime = Date.now();
	assert.equal(canStartDaveRave(source, daves), false);
	delete source.lastDaveRaveTime;

	delete daves['near-8'];
	assert.equal(countDavesInArea(source, daves), 9);
	assert.equal(canStartDaveRave(source, daves), false);
});

test('countDavesInArea uses the fixed Dave Rave crowd radius', () => {
	const source = {
		userId: 'source',
		name: 'Source',
		state: 'immune',
		lat: 41,
		lng: -87
	};
	const daves = { source };

	for (let i = 0; i < 9; i++) {
		daves[`near-${i}`] = {
			userId: `near-${i}`,
			name: `Near ${i}`,
			lat: 41,
			lng: -87 + 0.0025
		};
	}

	assert.equal(countDavesInArea(source, daves), 10);
	assert.equal(canStartDaveRave(source, daves), true);
});

test('getInteraction exposes Dave Rave availability only on your own page', () => {
	const source = {
		userId: 'source',
		name: 'Source',
		lat: 41,
		lng: -87
	};
	const target = {
		userId: 'target',
		name: 'Target',
		lat: 41,
		lng: -87
	};
	const daves = { source, target };

	for (let i = 0; i < 9; i++) {
		daves[`near-${i}`] = {
			userId: `near-${i}`,
			name: `Near ${i}`,
			lat: 41,
			lng: -87
		};
	}

	assert.equal(getInteraction(source, source, daves).availableActions.canStartDaveRave, true);
	assert.equal(getInteraction(source, target, daves).availableActions.canStartDaveRave, false);

	source.lastDaveRaveTime = Date.now();
	const details = getInteraction(source, source, daves);
	assert.equal(details.availableActions.canStartDaveRave, false);
	assert.ok(details.availableActions.daveRaveCooldownRemaining > 0);
});

test('removeFragment consumes the oldest collected fragment', () => {
	const dave = { fragmentsCollected: ['first', 'second'] };

	removeFragment(dave);

	assert.deepEqual(dave.fragmentsCollected, ['second']);
});
