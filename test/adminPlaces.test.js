import test from 'node:test';
import assert from 'node:assert/strict';

import { parseLandmarkInput } from '../public/utils/adminPlaces.js';

test('parseLandmarkInput builds a place from pasted lat lon name', () => {
	const result = parseLandmarkInput(
		'36.133736733141575, -115.16348139665487, 🍸 Peppermill',
		() => 'place-1'
	);

	assert.deepEqual(result, {
		place: {
			id: 'place-1',
			lat: 36.133736733141575,
			lng: -115.16348139665487,
			name: '🍸 Peppermill'
		}
	});
});

test('parseLandmarkInput allows commas inside the landmark name', () => {
	const result = parseLandmarkInput(
		'36.1, -115.2, Peppermill, Fireside Lounge',
		() => 'place-2'
	);

	assert.equal(result.place.name, 'Peppermill, Fireside Lounge');
});

test('parseLandmarkInput rejects invalid coordinates and missing names', () => {
	assert.equal(parseLandmarkInput('nope').error, 'Landmark must be formatted as lat, lon, name.');
	assert.equal(parseLandmarkInput('91, -115, Bad').error, 'Landmark latitude must be a number between -90 and 90.');
	assert.equal(parseLandmarkInput('36, -181, Bad').error, 'Landmark longitude must be a number between -180 and 180.');
	assert.equal(parseLandmarkInput('36, -115, ').error, 'Landmark must be formatted as lat, lon, name.');
});

