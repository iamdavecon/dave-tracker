import test from 'node:test';
import assert from 'node:assert/strict';

import { getAscensionText } from '../public/utils/placesUI.js';

test('getAscensionText hides stable users but allows corrupted users', () => {
	const place = { name: 'Node', level: 1 };

	assert.equal(getAscensionText({
		state: 'stable',
		fragmentsCollected: ['fragment']
	}, place), '');

	assert.equal(getAscensionText({
		state: 'corrupted',
		fragmentsCollected: ['fragment']
	}, place), 'BECOME MORE DAVE');
});

test('getAscensionText waits for the next state threshold', () => {
	assert.equal(getAscensionText({
		state: 'immune',
		fragmentsCollected: ['fragment']
	}, { name: 'Node', level: 2 }), '');

	assert.equal(getAscensionText({
		state: 'immune',
		fragmentsCollected: ['fragment']
	}, { name: 'Node', level: 3 }), 'ENTER RESONANCE');

	assert.equal(getAscensionText({
		state: 'resonant',
		fragmentsCollected: ['fragment']
	}, { name: 'Node', level: 4 }), '');

	assert.equal(getAscensionText({
		state: 'resonant',
		fragmentsCollected: ['fragment']
	}, { name: 'Node', level: 5 }), 'ACHIEVE DAVEHOOD');
});
