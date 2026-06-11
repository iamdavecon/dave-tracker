import test from 'node:test';
import assert from 'node:assert/strict';

import { isPersistableUser } from '../utils/storage.js';
import { createTestDaves, TEST_DAVE_IDS } from '../utils/testDaves.js';

test('test daves are source-defined and excluded from persistence', () => {
	const testDaves = createTestDaves(123);

	assert.equal(Object.keys(testDaves).length, TEST_DAVE_IDS.length);

	for (const id of TEST_DAVE_IDS) {
		assert.equal(testDaves[id].userId, id);
		assert.equal(testDaves[id].isTest, true);
		assert.equal(testDaves[id].updatedAt, 123);
		assert.equal(isPersistableUser(testDaves[id]), false);
	}

	assert.equal(isPersistableUser({ userId: 'real-dave' }), true);
	assert.equal(isPersistableUser({ userId: 'bot-dave', isBot: true }), false);
});
