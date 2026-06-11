import test from 'node:test';
import assert from 'node:assert/strict';

import { resetAllCooldowns, resetDaveCooldowns } from '../utils/cooldowns.js';

test('resetDaveCooldowns clears named cooldowns and item timestamps', () => {
	const dave = {
		userId: 'dave',
		updatedAt: Date.now(),
		lastDaveRaveTime: Date.now(),
		lastDoonPlaceUpgradeTime: Date.now(),
		lastHackerJeopardyBabyTime: Date.now(),
		lastTacoCalibrationTime: Date.now(),
		pendingPlasticBabyPassTime: Date.now(),
		'beer': { count: 2, lastTime: Date.now() },
		'taco': { count: 1, lastTime: Date.now() }
	};

	const resetCount = resetDaveCooldowns(dave);

	assert.equal(resetCount, 6);
	assert.equal(dave.lastDaveRaveTime, 0);
	assert.equal(dave.lastDoonPlaceUpgradeTime, 0);
	assert.equal(dave.lastHackerJeopardyBabyTime, 0);
	assert.equal(dave.lastTacoCalibrationTime, 0);
	assert.equal(dave.beer.count, 2);
	assert.equal(dave.beer.lastTime, 0);
	assert.equal(dave.taco.count, 1);
	assert.equal(dave.taco.lastTime, 0);
	assert.notEqual(dave.updatedAt, 0);
	assert.notEqual(dave.pendingPlasticBabyPassTime, 0);
});

test('resetAllCooldowns returns the total number of cleared cooldowns', () => {
	const resetCount = resetAllCooldowns({
		one: {
			lastDaveRaveTime: Date.now()
		},
		two: {
			lastVetconTime: Date.now(),
			item: { count: 1, lastTime: Date.now() }
		}
	});

	assert.equal(resetCount, 3);
});
