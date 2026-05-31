import test from 'node:test';
import assert from 'node:assert/strict';

import { registerHandlers } from '../utils/ascension.js';

test('ascendAtNode consumes a fragment and advances when the node is high enough', () => {
	const handlers = {};
	const ioEvents = [];
	const logs = [];
	const socket = {
		userId: 'source',
		on(event, handler) {
			handlers[event] = handler;
		}
	};
	const daves = {
		source: {
			userId: 'source',
			name: 'Source',
			state: 'unstable',
			fragmentsCollected: ['fragment']
		}
	};
	const places = {
		node: { id: 'node', name: 'Node', level: 1 }
	};

	registerHandlers(socket, daves, places, { emit: (...args) => ioEvents.push(args) }, (message) => logs.push(message));

	assert.equal(handlers.ascend, undefined);
	handlers.ascendAtNode('source', 'node');

	assert.equal(daves.source.state, 'immune');
	assert.deepEqual(daves.source.fragmentsCollected, []);
	assert.equal(ioEvents.length, 1);
	assert.equal(logs.length, 1);
});

test('ascendAtNode rejects forged source ids and insufficient nodes', () => {
	const handlers = {};
	const socket = {
		userId: 'source',
		on(event, handler) {
			handlers[event] = handler;
		}
	};
	const daves = {
		source: { userId: 'source', state: 'immune', fragmentsCollected: ['fragment'] },
		other: { userId: 'other', state: 'unstable', fragmentsCollected: ['fragment'] }
	};
	const places = {
		low: { id: 'low', name: 'Low', level: 1 }
	};

	registerHandlers(socket, daves, places, { emit: () => {} });

	handlers.ascendAtNode('other', 'low');
	assert.equal(daves.other.state, 'unstable');

	handlers.ascendAtNode('source', 'low');
	assert.equal(daves.source.state, 'immune');
	assert.deepEqual(daves.source.fragmentsCollected, ['fragment']);
});
