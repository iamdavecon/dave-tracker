import test from 'node:test';
import assert from 'node:assert/strict';

import { getRecognizedTags, getTagMetadata, getTagPlayerLabel, getTagTitle } from '../public/utils/tags.js';

test('recognized tags expose shared metadata for compact and player rendering', () => {
	assert.deepEqual(getTagMetadata('Timmy'), {
		emoji: '\u{1f32d}',
		label: 'Timmy'
	});
	assert.equal(getTagTitle('dod'), 'Department of Davefence');
	assert.equal(getTagPlayerLabel('peppercon'), '\u{1f336}\ufe0fPepperCon');
	assert.equal(getTagPlayerLabel('DT'), 'DT Dave Tangent');
});

test('unknown tags fall back to the tag text', () => {
	assert.equal(getTagMetadata('mystery'), null);
	assert.equal(getTagTitle('mystery'), 'mystery');
	assert.equal(getTagPlayerLabel('mystery'), 'mystery');
});

test('recognized tags are available as grantable dropdown options', () => {
	const tags = getRecognizedTags();

	assert.ok(tags.some(tag => tag.tag === 'general' && tag.label === 'General'));
	assert.ok(tags.some(tag => tag.tag === 'Timmy' && tag.emoji === '\u{1f32d}'));
	assert.ok(tags.some(tag => tag.tag === 'DT' && tag.label === 'Dave Tangent'));
});
