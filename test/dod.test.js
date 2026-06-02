import test from 'node:test';
import assert from 'node:assert/strict';

import { addCommendations, COMMENDATION_THRESHOLD, getCommendations } from '../public/utils/dod.js';

test('DoD commendations require credentials and accumulate safely', () => {
	const dave = {
		userId: 'source',
		tags: []
	};

	const result = addCommendations(dave, 2);

	assert.deepEqual(result, {
		awarded: false,
		promoted: false,
		total: 0
	});
	assert.equal(getCommendations(dave), 0);
	assert.deepEqual(dave.tags, []);
});

test('DoD commendations grant general at the promotion threshold', () => {
	const dave = {
		userId: 'source',
		dodLevel: 1,
		dodCommendations: COMMENDATION_THRESHOLD - 1,
		tags: ['dod']
	};

	const result = addCommendations(dave, 1);

	assert.deepEqual(result, {
		awarded: true,
		promoted: true,
		total: COMMENDATION_THRESHOLD
	});
	assert.equal(dave.dodCommendations, COMMENDATION_THRESHOLD);
	assert.deepEqual(dave.tags, ['dod', 'general']);
});

test('DoD commendations do not repeatedly promote existing generals', () => {
	const dave = {
		userId: 'source',
		dodLevel: 1,
		dodCommendations: COMMENDATION_THRESHOLD,
		tags: ['dod', 'general']
	};

	const result = addCommendations(dave, 3);

	assert.deepEqual(result, {
		awarded: true,
		promoted: false,
		total: COMMENDATION_THRESHOLD + 3
	});
	assert.deepEqual(dave.tags, ['dod', 'general']);
});
