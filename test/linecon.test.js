import test from 'node:test';
import assert from 'node:assert/strict';

import { applyLineconBump, BEACH_BALL_ITEM } from '../utils/linecon.js';

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

test('applyLineconBump grants a beach ball every twenty bump streak', () => {
	const dave = {
		userId: 'source',
		name: 'Source',
		lineconBumps: 49,
		tags: []
	};

	const twenty = applyLineconBump(dave, 20);
	const twentyOne = applyLineconBump(dave, 21);

	assert.equal(twenty.bumps, 50);
	assert.equal(twenty.awardedBeachBall, true);
	assert.equal(twenty.beachBalls, 1);
	assert.equal(dave[BEACH_BALL_ITEM].count, 1);
	assert.equal(twentyOne.bumps, 51);
	assert.equal(twentyOne.awardedBeachBall, false);
	assert.equal(twentyOne.beachBalls, 1);
});

test('applyLineconBump does not grant beach balls from total bumps alone', () => {
	const dave = {
		userId: 'source',
		name: 'Source',
		lineconBumps: 99,
		tags: []
	};

	const result = applyLineconBump(dave, 19);

	assert.equal(result.bumps, 100);
	assert.equal(result.awardedBeachBall, false);
	assert.equal(result.beachBalls, 0);
	assert.equal(dave[BEACH_BALL_ITEM], undefined);
});
