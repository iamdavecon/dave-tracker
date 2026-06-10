import test from 'node:test';
import assert from 'node:assert/strict';

import { getRecognizedTags, getTagEmoji, getTagMetadata, getTagPlayerLabel, getTagTitle } from '../public/utils/tags.js';

test('recognized tags expose shared metadata for compact and player rendering', () => {
	assert.deepEqual(getTagMetadata('Timmy'), {
		label: '\u{1f32d} Timmy'
	});
	assert.equal(getTagEmoji('Timmy'), '\u{1f32d}');
	assert.equal(getTagTitle('dod'), 'Department of Davefence');
	assert.equal(getTagPlayerLabel('peppercon'), '\u{1f336}\ufe0fPepperCon');
	assert.equal(getTagPlayerLabel('peppercon', { emoji: false }), 'PepperCon');
	assert.equal(getTagPlayerLabel('dod', { emoji: false }), 'DoD');
	assert.equal(getTagEmoji('redeye'), '\u{1f441}\ufe0f');
	assert.equal(getTagPlayerLabel('DT'), 'Met DT');
});

test('unknown tags fall back to the tag text', () => {
	assert.equal(getTagMetadata('mystery'), null);
	assert.equal(getTagTitle('mystery'), 'mystery');
	assert.equal(getTagPlayerLabel('mystery'), 'mystery');
});

test('recognized tags are available as grantable dropdown options', () => {
	const tags = getRecognizedTags();

	assert.ok(tags.some(tag => tag.tag === 'general' && tag.label === '\u{1f396}\ufe0f General'));
	assert.ok(tags.some(tag => tag.tag === 'Timmy' && tag.label === '\u{1f32d} Timmy'));
	assert.ok(tags.some(tag => tag.tag === 'redeye' && tag.label === '\u{1f441}\ufe0f Redeye'));
	assert.ok(tags.some(tag => tag.tag === 'DT' && tag.label === 'Met DT'));
});
