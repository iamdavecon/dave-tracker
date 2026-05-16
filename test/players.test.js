import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeDave, removeFragment } from '../utils/players.js';

test('summarizeDave calculates leaderboard scores and keeps tags', () => {
	const summary = summarizeDave({
		userId: 'dave-1',
		name: 'Leaderboard Dave',
		state: 'resonant',
		infectedUsers: ['a', 'b'],
		fragmentsCollected: ['f1', 'f2', 'f3'],
		nodeCount: 2,
		tags: ['mayor', 'dod']
	});

	assert.deepEqual(summary, {
		userId: 'dave-1',
		name: 'Leaderboard Dave',
		score: 28,
		teamVirus: 2,
		teamAntivirus: 13,
		state: 'RESONANT',
		tags: ['mayor', 'dod']
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

test('removeFragment consumes the oldest collected fragment', () => {
	const dave = { fragmentsCollected: ['first', 'second'] };

	removeFragment(dave);

	assert.deepEqual(dave.fragmentsCollected, ['second']);
});
