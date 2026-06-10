import test from 'node:test';
import assert from 'node:assert/strict';

import { getItemDefinition, getItemsForSource } from '../public/utils/itemUI.js';

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
		getItemsForSource('🌭').map(item => ({ item: item.item, getLabel: item.getLabel, rewardCount: item.rewardCount })),
		[
			{ item: '🌭', getLabel: 'Get some $2 Hotdogs', rewardCount: 2 },
			{ item: '🍸', getLabel: 'Get some $2 Beers', rewardCount: 2 }
		]
	);
});

test('hotdog player action uses the default non-slots label', () => {
	assert.equal(getItemDefinition('🌭').getLabel, 'Get a hotdog');
});

test('cocktail sources award drinks directly', () => {
	assert.deepEqual(
		getItemsForSource('🍸').map(item => ({ item: item.item, getLabel: item.getLabel, rewardCount: item.rewardCount })),
		[
			{ item: '🍸', getLabel: 'Get a drink', rewardCount: 1 }
		]
	);
});
