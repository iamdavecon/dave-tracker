import test from 'node:test';
import assert from 'node:assert/strict';

import { getItemsForSource } from '../public/utils/itemUI.js';

test('toxic BBQ sources award peppers', () => {
	assert.deepEqual(
		getItemsForSource('🍖').map(item => item.item),
		['🍸', '🌶️']
	);
});

test('pepper sources award peppers directly', () => {
	assert.deepEqual(
		getItemsForSource('🌶️').map(item => item.item),
		['🌶️']
	);
});

test('slots sources award hotdogs and beers', () => {
	assert.deepEqual(
		getItemsForSource('🌭').map(item => ({ item: item.item, getLabel: item.getLabel })),
		[
			{ item: '🌭', getLabel: 'Get a $2 Hotdog' },
			{ item: '🍸', getLabel: 'Get a $2 Beer' }
		]
	);
});

test('cocktail sources award drinks directly', () => {
	assert.deepEqual(
		getItemsForSource('🍸').map(item => ({ item: item.item, getLabel: item.getLabel })),
		[
			{ item: '🍸', getLabel: 'Get a drink' }
		]
	);
});
