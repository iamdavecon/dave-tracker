import test from 'node:test';
import assert from 'node:assert/strict';

import { canStartDaveRave, countDavesInArea, summarizeDave, getInteraction, getLinkedDaveSummaries, removeFragment } from '../utils/players.js';
import { getRange } from '../public/utils/distance.js';
import { hasPlasticBaby } from '../public/utils/playersUI.js';
import { getBabyStats } from '../public/utils/babies.js';
import * as state from '../public/utils/state.js';

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
		score: 30,
		teamVirus: 0,
		teamAntivirus: 1,
		daveravesStarted: 1,
		state: 'RESONANT',
		tags: ['admin', 'dod']
	});
});

test('summarizeDave scores leaderboard influence and control by state', () => {
	const cases = [
		{ state: 'infected', teamVirus: 1, teamAntivirus: 0 },
		{ state: 'corrupted', teamVirus: 2, teamAntivirus: 0 },
		{ state: 'resonant', teamVirus: 0, teamAntivirus: 1 },
		{ state: 'ascended', teamVirus: 0, teamAntivirus: 2 },
		{ state: 'dope', teamVirus: 0, teamAntivirus: 3 },
		{ state: 'immune', teamVirus: 0, teamAntivirus: 0 }
	];

	for (const expected of cases) {
		const summary = summarizeDave({
			userId: `dave-${expected.state}`,
			name: expected.state,
			state: expected.state
		});

		assert.equal(summary.teamVirus, expected.teamVirus);
		assert.equal(summary.teamAntivirus, expected.teamAntivirus);
	}
});

test('summarizeDave handles missing optional scoring fields', () => {
	const summary = summarizeDave({
		userId: 'dave-2',
		name: 'Fresh Dave'
	});

	assert.equal(summary.score, 0);
	assert.equal(summary.teamVirus, 0);
	assert.equal(summary.teamAntivirus, 0);
	assert.equal(summary.daveravesStarted, 0);
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

test('hasPlasticBaby detects baby inventory for online list badges', () => {
	const baby = '👶';

	assert.equal(hasPlasticBaby({ name: 'No Baby Dave' }), false);
	assert.equal(hasPlasticBaby({
		name: 'Baby Dave',
		[baby]: {
			count: 1,
			lastTime: Date.now()
		}
	}), true);
	assert.equal(hasPlasticBaby({
		name: 'Former Baby Dave',
		[baby]: {
			count: 0,
			lastTime: Date.now()
		}
	}), false);
});

test('baby stats link condition includes current, lost, and received babies', () => {
	const baby = '👶';

	assert.deepEqual(getBabyStats({ name: 'No Baby Dave' }, state), {
		count: 0,
		lost: 0,
		received: 0,
		hasActivity: false
	});
	assert.equal(getBabyStats({ [baby]: { count: 1, lastTime: Date.now() } }, state).hasActivity, true);
	assert.equal(getBabyStats({ babiesLost: 1 }, state).hasActivity, true);
	assert.equal(getBabyStats({ babiesReceived: 1 }, state).hasActivity, true);
});

test('getInteraction exposes item pickup for first item emoji users', () => {
	const taco = '🌮';
	const me = {
		userId: 'source',
		name: 'Source',
		lat: 41,
		lng: -87
	};
	const target = {
		userId: 'target',
		name: '🌮 Taco Dave',
		lat: 41,
		lng: -87
	};

	const details = getInteraction(me, target);

	assert.deepEqual(details.availableActions.firstItem, {
		item: taco,
		getLabel: 'Get a Taco'
	});
	assert.equal(details.availableActions.canGetFirstItem, true);
});

test('getInteraction exposes baby receiving for in-range users with babies', () => {
	const baby = '👶';
	const me = {
		userId: 'source',
		name: 'Source',
		lat: 41,
		lng: -87
	};
	const target = {
		userId: 'target',
		name: 'Baby Target',
		lat: 41,
		lng: -87,
		[baby]: {
			count: 1,
			lastTime: Date.now()
		}
	};

	const details = getInteraction(me, target);

	assert.equal(details.availableActions.hasBaby, true);
	assert.equal(details.availableActions.canReceiveBaby, true);
});

test('getInteraction exposes DaveTangent introduction for in-range players without the tag', () => {
	const me = {
		userId: 'source',
		name: 'Source',
		tags: [],
		lat: 41,
		lng: -87
	};
	const daveTangent = {
		userId: 'bot-dt',
		name: 'DaveTangent',
		isBot: true,
		lat: 41,
		lng: -87
	};

	assert.equal(getInteraction(me, daveTangent).availableActions.canIntroduceDaveTangent, true);

	me.tags.push('DT');
	assert.equal(getInteraction(me, daveTangent).availableActions.canIntroduceDaveTangent, false);
	assert.equal(getInteraction({ ...me, tags: [] }, { ...daveTangent, name: 'CIVILIAN' }).availableActions.canIntroduceDaveTangent, false);
});

test('getInteraction blocks GOON infection and exposes one raffle claim', () => {
	const me = {
		userId: 'source',
		name: 'Source',
		lat: 41,
		lng: -87
	};
	const goon = {
		userId: 'bot-goon',
		name: 'GOON',
		isBot: true,
		state: 'unstable',
		lat: 41,
		lng: -87
	};

	const details = getInteraction(me, goon);

	assert.equal(details.availableActions.canInfect, false);
	assert.equal(details.availableActions.canClaimGoonRaffle, true);

	me.claimedGoonRaffles = ['bot-goon'];
	assert.equal(getInteraction(me, goon).availableActions.canClaimGoonRaffle, false);
});

test('getInteraction respects first item pickup cooldown', () => {
	const taco = '🌮';
	const me = {
		userId: 'source',
		name: 'Source',
		[taco]: {
			count: 1,
			lastTime: Date.now()
		}
	};
	const target = {
		userId: 'target',
		name: '🌮 Taco Dave'
	};

	const details = getInteraction(me, target);

	assert.deepEqual(details.availableActions.firstItem, {
		item: taco,
		getLabel: 'Get a Taco'
	});
	assert.equal(details.availableActions.canGetFirstItem, false);
	assert.ok(details.availableActions.firstItemCooldownRemaining > 0);
});

test('getInteraction exposes taco eating only on your own page', () => {
	const taco = '🌮';
	const source = {
		userId: 'source',
		name: 'Source',
		[taco]: {
			count: 1,
			lastTime: Date.now()
		}
	};
	const target = {
		userId: 'target',
		name: 'Target'
	};

	assert.equal(getInteraction(source, source).availableActions.canEatTaco, true);
	assert.equal(getInteraction(source, target).availableActions.canEatTaco, false);
});

test('getRange doubles while a taco boost is active', () => {
	const source = {
		userId: 'source',
		name: 'Source',
		tacoRangeBoostUntil: Date.now() + 60 * 1000
	};

	assert.equal(getRange(source), 100);

	source.tacoRangeBoostUntil = Date.now() - 1;
	assert.equal(getRange(source), 50);
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
