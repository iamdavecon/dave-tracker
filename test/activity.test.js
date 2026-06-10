import test from 'node:test';
import assert from 'node:assert/strict';

import { applyLocationActivity, hasLocationChanged, markActive } from '../utils/activity.js';

test('markActive updates updatedAt for explicit actions', () => {
	const dave = { updatedAt: 1 };

	markActive(dave, 1234);

	assert.equal(dave.updatedAt, 1234);
});

test('applyLocationActivity does not refresh updatedAt for unchanged locations', () => {
	const dave = { lat: 36.1215, lng: -115.1739, updatedAt: 100 };

	const changed = applyLocationActivity(dave, { lat: 36.1215, lng: -115.1739 }, 200);

	assert.equal(changed, false);
	assert.equal(dave.updatedAt, 100);
});

test('applyLocationActivity ignores small GPS drift for activity', () => {
	const dave = { lat: 36.1215, lng: -115.1739, updatedAt: 100 };

	const changed = applyLocationActivity(dave, { lat: 36.12151, lng: -115.1739 }, 200);

	assert.equal(changed, false);
	assert.equal(dave.updatedAt, 100);
});

test('applyLocationActivity refreshes updatedAt after meaningful movement', () => {
	const dave = { lat: 36.1215, lng: -115.1739, updatedAt: 100 };

	const changed = applyLocationActivity(dave, { lat: 36.122, lng: -115.1739 }, 200);

	assert.equal(changed, true);
	assert.equal(dave.updatedAt, 200);
});

test('hasLocationChanged treats missing coordinates as movement', () => {
	assert.equal(hasLocationChanged({}, 36.1215, -115.1739), true);
});
