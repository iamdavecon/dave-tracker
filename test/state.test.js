import test from 'node:test';
import assert from 'node:assert/strict';

import * as state from '../public/utils/state.js';

test('defaults unknown or missing states to unstable', () => {
	assert.equal(state.getDefaultState(), 'unstable');
	assert.equal(state.getState({}), 'unstable');
	assert.equal(state.getState({ state: 'missing' }), 'unstable');
});

test('rank changes stop at the top and bottom of the state ladder', () => {
	const dave = { state: 'unstable' };

	assert.equal(state.increaseRank(dave), true);
	assert.equal(dave.state, 'immune');

	dave.state = 'daveprime';
	assert.equal(state.increaseRank(dave), false);
	assert.equal(dave.state, 'daveprime');

	dave.state = 'corrupted';
	assert.equal(state.decreaseRank(dave), false);
	assert.equal(dave.state, 'corrupted');
});

test('infection only changes unstable daves', () => {
	const unstable = { state: 'unstable' };
	const immune = { state: 'immune' };

	assert.equal(state.infect(unstable), true);
	assert.equal(unstable.state, 'infected');

	assert.equal(state.infect(immune), false);
	assert.equal(immune.state, 'immune');
});

test('stabilize makes unstable or infected daves immune', () => {
	const unstable = { state: 'unstable' };
	const infected = { state: 'infected' };
	const immune = { state: 'immune' };

	assert.equal(state.stabilize(unstable), true);
	assert.equal(unstable.state, 'immune');

	assert.equal(state.stabilize(infected), true);
	assert.equal(infected.state, 'immune');

	assert.equal(state.stabilize(immune), false);
	assert.equal(immune.state, 'immune');
});

test('antivirus installation makes unstable daves immune', () => {
	const dave = { state: 'unstable' };

	state.installAntivirus(dave);

	assert.equal(dave.state, 'immune');
});

test('ascension and tags drive user actions', () => {
	const source = {
		userId: 'source',
		state: 'ascended',
		fragmentsCollected: [],
		tags: ['standard-user', 'doon', 'peppercon', 'GDIK']
	};
	const target = { userId: 'target', state: 'infected', tags: [] };

	assert.equal(state.canAscend(source, target), true);
	assert.equal(state.canDoonShift(source, target), true);

	const actions = state.getUserActions(source, target);
	assert.equal(actions.canAscend, true);
	assert.equal(actions.canDaveputize, true);
	assert.equal(actions.canDoonShift, true);
	assert.equal(actions.canGrantTag, false);
	assert.equal(actions.canMakeBadDecision, true);

	source.state = 'daveprime';
	assert.equal(state.getUserActions(source, target).canGrantTag, true);

	source.fragmentsCollected.push('target');
	assert.equal(state.canAscend(source, target), false);
	assert.equal(state.canMakeBadDecision(source, target), false);
});

test('infected and corrupted daves can decrease another user status', () => {
	const source = { userId: 'source', state: 'infected' };
	const corruptedSource = { userId: 'corrupted-source', state: 'corrupted' };
	const target = { userId: 'target', state: 'immune' };
	const maxedTarget = { userId: 'maxed-target', state: 'corrupted' };

	assert.equal(state.canDecreaseStatus(source, target), true);
	assert.equal(state.getUserActions(source, target).canDecreaseStatus, true);
	assert.equal(state.canDecreaseStatus(corruptedSource, target), true);
	assert.equal(state.canDecreaseStatus({ userId: 'stable', state: 'immune' }, target), false);
	assert.equal(state.canDecreaseStatus(source, source), false);
	assert.equal(state.canDecreaseStatus(source, maxedTarget), false);
});

test('territory ranks scale by owned node count and level', () => {
	const dave = { userId: 'source', tags: ['standard-user', 'dod'] };
	const places = {
		one: { owner: 'source' },
		two: { owner: 'source', level: 2 },
		three: { owner: 'other', level: 20 }
	};

	assert.equal(state.getTerritoryScore(dave, places), 3);
	assert.deepEqual(state.syncTerritoryRank(dave, places), {
		tag: 'admin',
		label: 'Admin',
		min: 3
	});
	assert.deepEqual(dave.tags, ['dod', 'admin']);
});

test('place actions require fragments and cap upgrades by player state', () => {
	const immuneDave = { state: 'immune', fragmentsCollected: ['fragment'] };
	const maxedPlace = { level: 3 };
	const upgradeablePlace = { level: 1 };

	assert.equal(state.getPlaceActions(immuneDave, upgradeablePlace).canUpgrade, true);
	assert.equal(state.getPlaceActions(immuneDave, maxedPlace).canUpgrade, false);

	const brokeDave = { state: 'daveprime', fragmentsCollected: [] };
	assert.equal(state.getPlaceActions(brokeDave, upgradeablePlace).canUpgrade, undefined);
});

test('doon place upgrade actions require the doon tag and respect cooldown', () => {
	const dave = { state: 'immune', tags: ['doon'] };

	assert.equal(state.getPlaceActions(dave, { level: 2 }).canDoonUpgrade, true);
	assert.equal(state.getPlaceActions(dave, { level: 3 }).canDoonUpgrade, false);

	dave.lastDoonPlaceUpgradeTime = Date.now();
	assert.equal(state.getPlaceActions(dave, { level: 2 }).canDoonUpgrade, false);
	assert.ok(state.getPlaceActions(dave, { level: 2 }).doonUpgradeCooldownRemaining > 0);

	assert.equal(state.getPlaceActions({ tags: [] }, {}).canDoonUpgrade, false);
});

test('item cooldown remaining uses normalized item keys and formats labels', () => {
	const dave = {
		'🍺': {
			count: 1,
			lastTime: Date.now() - 8 * 60 * 1000
		}
	};

	const remaining = state.getCooldownRemaining(dave, '🍸');

	assert.ok(remaining > 119_000);
	assert.ok(remaining <= 120_000);
	assert.equal(state.formatCooldownRemaining(remaining), '2m 00s');
	assert.equal(state.formatCooldownRemaining(9_500), '10s');
});
