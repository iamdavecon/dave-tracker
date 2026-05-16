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
	assert.equal(dave.state, 'patched');

	dave.state = 'daveprime';
	assert.equal(state.increaseRank(dave), false);
	assert.equal(dave.state, 'daveprime');

	dave.state = 'voided';
	assert.equal(state.decreaseRank(dave), false);
	assert.equal(dave.state, 'voided');
});

test('infection only changes unstable daves', () => {
	const unstable = { state: 'unstable' };
	const patched = { state: 'patched' };

	assert.equal(state.infect(unstable), true);
	assert.equal(unstable.state, 'infected');

	assert.equal(state.infect(patched), false);
	assert.equal(patched.state, 'patched');
});

test('stabilize patches unstable daves and advances patched daves toward immune', () => {
	const unstable = { state: 'unstable' };
	const patched = { state: 'patched', patches: 1 };

	assert.equal(state.stabilize(unstable), true);
	assert.equal(unstable.state, 'patched');

	assert.equal(state.stabilize(patched), false);
	assert.equal(patched.state, 'immune');
});

test('antivirus installation uses the configured probability bands', (t) => {
	const immuneRoll = { state: 'unstable' };
	t.mock.method(Math, 'random', () => 0.19);
	state.installAntivirus(immuneRoll);
	assert.equal(immuneRoll.state, 'immune');

	Math.random.mock.mockImplementation(() => 0.2);
	const patchedRoll = { state: 'unstable' };
	state.installAntivirus(patchedRoll);
	assert.equal(patchedRoll.state, 'patched');
});

test('ascension and tags drive user actions', () => {
	const source = {
		userId: 'source',
		state: 'ascended',
		fragmentsCollected: [],
		tags: ['mayor', 'doon']
	};
	const target = { userId: 'target', state: 'infected', tags: [] };

	assert.equal(state.canAscend(source, target), true);
	assert.equal(state.canDoonShift(source, target), true);

	const actions = state.getUserActions(source, target);
	assert.equal(actions.canAscend, true);
	assert.equal(actions.canDaveputize, true);
	assert.equal(actions.canDoonShift, true);

	source.fragmentsCollected.push('target');
	assert.equal(state.canAscend(source, target), false);
});

test('place actions require fragments and cap upgrades by player state', () => {
	const patchedDave = { state: 'patched', fragmentsCollected: ['fragment'] };
	const maxedPlace = { level: 2 };
	const upgradeablePlace = { level: 1 };

	assert.equal(state.getPlaceActions(patchedDave, upgradeablePlace).canUpgrade, true);
	assert.equal(state.getPlaceActions(patchedDave, maxedPlace).canUpgrade, false);

	const brokeDave = { state: 'daveprime', fragmentsCollected: [] };
	assert.equal(state.getPlaceActions(brokeDave, upgradeablePlace).canUpgrade, undefined);
});
