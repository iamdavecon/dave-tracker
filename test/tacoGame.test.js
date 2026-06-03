import test from 'node:test';
import assert from 'node:assert/strict';

import {
	canAttemptTacoGame,
	getTacoGameCooldownRemaining,
	isCorrectTacoGameAnswer
} from '../public/utils/tacoGame.js';

test('taco game accepts exact answers and rejects wrong answers', () => {
	assert.equal(isCorrectTacoGameAnswer('shell-integrity', 'Meat or beans'), true);
	assert.equal(isCorrectTacoGameAnswer('shell-integrity', 'meat or beans'), true);
	assert.equal(isCorrectTacoGameAnswer('shell-integrity', 'Salsa'), false);
	assert.equal(isCorrectTacoGameAnswer('missing', 'Meat or beans'), false);
});

test('taco game cooldown blocks repeat attempts', () => {
	const dave = {
		lastTacoCalibrationTime: Date.now()
	};

	assert.equal(canAttemptTacoGame(dave), false);
	assert.ok(getTacoGameCooldownRemaining(dave) > 0);

	dave.lastTacoCalibrationTime = Date.now() - 6 * 60 * 1000;
	assert.equal(canAttemptTacoGame(dave), true);
	assert.equal(getTacoGameCooldownRemaining(dave), 0);
});
