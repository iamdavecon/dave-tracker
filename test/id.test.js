import test from 'node:test';
import assert from 'node:assert/strict';

import { getFragmentFrom } from '../public/utils/id.js';

test('getFragmentFrom only grants one fragment per target dave', () => {
	const source = { fragmentsCollected: [] };
	const target = { userId: 'target' };

	assert.equal(getFragmentFrom(source, target), true);
	assert.equal(getFragmentFrom(source, target), false);
	assert.deepEqual(source.fragmentsCollected, ['target']);
});
