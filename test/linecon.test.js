import test from 'node:test';
import assert from 'node:assert/strict';

import { applyLineconBump } from '../utils/linecon.js';

test('applyLineconBump tracks server best streak without granting below threshold', () => {
	const dave = {
		userId: 'source',
		name: 'Source',
		tags: []
	};

	const result = applyLineconBump(dave, 50);

	assert.equal(result.bumps, 1);
	assert.equal(result.bestStreak, 50);
	assert.equal(result.earnedBallMaster, false);
	assert.deepEqual(dave.tags, []);
});

test('applyLineconBump grants BALL MASTER when best streak exceeds fifty', () => {
	const dave = {
		userId: 'source',
		name: 'Source',
		lineconBumps: 4,
		tags: []
	};

	const result = applyLineconBump(dave, 51);

	assert.equal(result.bumps, 5);
	assert.equal(result.bestStreak, 51);
	assert.equal(result.earnedBallMaster, true);
	assert.deepEqual(dave.tags, ['ball-master']);
});

test('applyLineconBump does not duplicate BALL MASTER', () => {
	const dave = {
		userId: 'source',
		name: 'Source',
		lineconBestStreak: 51,
		tags: ['ball-master']
	};

	const result = applyLineconBump(dave, 52);

	assert.equal(result.bestStreak, 52);
	assert.equal(result.earnedBallMaster, false);
	assert.deepEqual(dave.tags, ['ball-master']);
});
