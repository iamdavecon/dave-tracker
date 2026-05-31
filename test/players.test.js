import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeDave, getLinkedDaveSummaries, removeFragment } from '../utils/players.js';

test('summarizeDave calculates leaderboard scores and keeps tags', () => {
	const summary = summarizeDave({
		userId: 'dave-1',
		name: 'Leaderboard Dave',
		state: 'resonant',
		infectedUsers: ['a', 'b'],
		fragmentsCollected: ['f1', 'f2', 'f3'],
		nodeCount: 2,
		tags: ['standard-user', 'dod']
	}, {
		node1: { owner: 'dave-1' },
		node2: { owner: 'dave-1', level: 2 }
	});

	assert.deepEqual(summary, {
		userId: 'dave-1',
		name: 'Leaderboard Dave',
		score: 28,
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

test('removeFragment consumes the oldest collected fragment', () => {
	const dave = { fragmentsCollected: ['first', 'second'] };

	removeFragment(dave);

	assert.deepEqual(dave.fragmentsCollected, ['second']);
});
