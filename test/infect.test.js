import test from 'node:test';
import assert from 'node:assert/strict';

import { infectTarget, registerHandlers } from '../utils/infect.js';

test('infectTarget infects an unstable target once and notifies them', () => {
	const notifications = [];
	const targetSocket = {
		emit(event, payload) {
			notifications.push({ event, payload });
		}
	};
	const me = { userId: 'source', infectedUsers: [] };
	const target = {
		userId: 'target',
		state: 'unstable',
		infectedBy: [],
		sockets: new Set([targetSocket])
	};

	assert.equal(infectTarget(me, target), true);
	assert.equal(target.state, 'infected');
	assert.deepEqual(me.infectedUsers, ['target']);
	assert.deepEqual(target.infectedBy, ['source']);
	assert.deepEqual(notifications, [
		{ event: 'notifyInfected', payload: { by: 'source' } }
	]);

	assert.equal(infectTarget(me, target), false);
	assert.deepEqual(me.infectedUsers, ['target']);
	assert.deepEqual(target.infectedBy, ['source']);
});

test('infectTarget renames infected bots to Dave', () => {
	const me = { userId: 'source', infectedUsers: [] };
	const target = {
		userId: 'bot-target',
		name: 'Casey',
		isBot: true,
		state: 'unstable',
		infectedBy: []
	};

	assert.equal(infectTarget(me, target), true);
	assert.equal(target.name, 'Dave');
	assert.equal(target.state, 'infected');
});

test('infect socket handler emits results, logs successful infections, and broadcasts updates', () => {
	const handlers = {};
	const emittedToSocket = [];
	const emittedToAll = [];
	const logEntries = [];
	const socket = {
		userId: 'source',
		on(event, handler) {
			handlers[event] = handler;
		},
		emit(event, payload) {
			emittedToSocket.push({ event, payload });
		}
	};
	const io = {
		emit(event, payload) {
			emittedToAll.push({ event, payload });
		}
	};
	const daves = {
		source: { userId: 'source', name: 'Source Dave', infectedUsers: [], lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target Dave', state: 'unstable', lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, io, (message, options) => {
		logEntries.push({ message, options });
	});

	handlers.infect('source', 'target');

	assert.deepEqual(emittedToSocket, [
		{ event: 'infectResult', payload: { success: true } }
	]);
	assert.equal(emittedToAll.length, 1);
	assert.equal(emittedToAll[0].event, 'update');
	assert.equal(logEntries.length, 1);
	assert.match(logEntries[0].message, /Source Dave transmitted/);
	assert.deepEqual(logEntries[0].options, { userId: 'source' });
});

test('infect socket handler rejects forged and out-of-range attempts', () => {
	const handlers = {};
	const emittedToSocket = [];
	const socket = {
		userId: 'source',
		on(event, handler) {
			handlers[event] = handler;
		},
		emit(event, payload) {
			emittedToSocket.push({ event, payload });
		}
	};
	const daves = {
		source: { userId: 'source', name: 'Source Dave', infectedUsers: [], lat: 41, lng: -87 },
		other: { userId: 'other', name: 'Other Dave', infectedUsers: [], lat: 41, lng: -87 },
		target: { userId: 'target', name: 'Target Dave', state: 'unstable', lat: 42, lng: -88 }
	};

	registerHandlers(socket, daves, { emit: () => {} });

	handlers.infect('other', 'target');
	assert.equal(daves.target.state, 'unstable');
	assert.deepEqual(emittedToSocket, []);

	handlers.infect('source', 'target');
	assert.equal(daves.target.state, 'unstable');
	assert.deepEqual(emittedToSocket, [
		{ event: 'infectResult', payload: { success: false } }
	]);
});

test('infect socket handler rejects GOON targets', () => {
	const handlers = {};
	const emittedToSocket = [];
	const socket = {
		userId: 'source',
		on(event, handler) {
			handlers[event] = handler;
		},
		emit(event, payload) {
			emittedToSocket.push({ event, payload });
		}
	};
	const daves = {
		source: { userId: 'source', name: 'Source Dave', infectedUsers: [], lat: 41, lng: -87 },
		goon: { userId: 'goon', name: 'GOON', isBot: true, state: 'unstable', lat: 41, lng: -87 }
	};

	registerHandlers(socket, daves, { emit: () => {} });

	handlers.infect('source', 'goon');

	assert.equal(daves.goon.state, 'unstable');
	assert.deepEqual(daves.source.infectedUsers, []);
	assert.deepEqual(emittedToSocket, [
		{ event: 'infectResult', payload: { success: false } }
	]);
});
