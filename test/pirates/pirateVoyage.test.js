import test from 'node:test';
import assert from 'node:assert/strict';

import {
	clearPirateVoyagesForTests,
	launchPirateVoyage,
	joinPirateVoyage,
	getPlaceVoyageSummary,
	stopPirateVoyage,
	rollPirateDice,
	submitPirateRound
} from '../../utils/pirates/pirateVoyage.js';

const place = {
	id: 'dock',
	name: 'Test Dock'
};

function dave(userId, name) {
	return { userId, name, lat: 1, lng: 1 };
}

function randomFor(faces) {
	const queue = [...faces];
	return () => ((queue.shift() ?? 1) - 0.5) / 6;
}

test('voyage summaries identify the starter and only the starter can stop it', () => {
	clearPirateVoyagesForTests();
	const starter = dave('starter', 'Starter Dave');
	const rival = dave('rival', 'Rival Dave');
	launchPirateVoyage('dock', place, starter);
	joinPirateVoyage('dock', place, rival);

	assert.equal(getPlaceVoyageSummary('dock', starter.userId).isStarter, true);
	assert.equal(getPlaceVoyageSummary('dock', rival.userId).isStarter, false);
	assert.equal(stopPirateVoyage('dock', rival).ok, false);
	assert.equal(getPlaceVoyageSummary('dock', starter.userId).active, true);

	const stopped = stopPirateVoyage('dock', starter);
	assert.equal(stopped.ok, true);
	assert.equal(getPlaceVoyageSummary('dock', starter.userId).exists, false);
});

test('the starter takes the first turn and other players are blocked', () => {
	clearPirateVoyagesForTests();
	const starter = dave('starter', 'Starter Dave');
	const rival = dave('rival', 'Rival Dave');
	const { voyage } = launchPirateVoyage('dock', place, starter);
	joinPirateVoyage('dock', place, rival);

	const blocked = rollPirateDice(voyage, rival.userId, randomFor([6, 5, 4, 2, 3]));

	assert.equal(blocked.ok, false);
	assert.match(blocked.error, /Waiting for Starter Dave/);
	assert.equal(getPlaceVoyageSummary('dock', starter.userId).currentPlayerId, starter.userId);
});

test('ship, captain, and crew lock automatically from one roll', () => {
	clearPirateVoyagesForTests();
	const captain = dave('captain', 'Captain Dave');
	const { voyage } = launchPirateVoyage('dock', place, captain);

	const result = rollPirateDice(voyage, captain.userId, randomFor([4, 5, 6, 2, 3]));

	assert.equal(result.ok, true);
	assert.deepEqual(voyage.players.captain.turn.dice, [4, 5, 6, 2, 3]);
	assert.deepEqual(voyage.players.captain.turn.locked, {
		ship: 2,
		captain: 1,
		crew: 0
	});
	assert.equal(voyage.players.captain.turn.rollsRemaining, 2);
});

test('completed turns may reroll both cargo dice before scoring', () => {
	clearPirateVoyagesForTests();
	const captain = dave('captain', 'Captain Dave');
	const { voyage } = launchPirateVoyage('dock', place, captain);

	rollPirateDice(voyage, captain.userId, randomFor([6, 5, 4, 1, 1]));
	rollPirateDice(voyage, captain.userId, randomFor([6, 6]));
	const result = submitPirateRound(voyage, captain.userId);

	assert.equal(result.ok, true);
	assert.equal(result.complete, true);
	assert.equal(result.score, 12);
	assert.deepEqual(voyage.players.captain.history[0].cargoDice, [6, 6]);
	assert.equal(voyage.players.captain.booty, 12);
});

test('running out of rolls before securing the crew scores zero', () => {
	clearPirateVoyagesForTests();
	const captain = dave('captain', 'Captain Dave');
	const { voyage } = launchPirateVoyage('dock', place, captain);

	rollPirateDice(voyage, captain.userId, randomFor([6, 1, 1, 1, 1]));
	rollPirateDice(voyage, captain.userId, randomFor([5, 1, 1, 1]));
	rollPirateDice(voyage, captain.userId, randomFor([1, 1, 1]));
	const result = submitPirateRound(voyage, captain.userId);

	assert.equal(result.ok, true);
	assert.equal(result.complete, false);
	assert.equal(result.score, 0);
	assert.equal(voyage.players.captain.booty, 0);
	assert.deepEqual(voyage.players.captain.history[0].locked, {
		ship: 0,
		captain: 1,
		crew: null
	});
});

test('starter score locks the remaining players to that roll count', () => {
	clearPirateVoyagesForTests();
	const starter = dave('starter', 'Starter Dave');
	const rival = dave('rival', 'Rival Dave');
	const { voyage } = launchPirateVoyage('dock', place, starter);
	joinPirateVoyage('dock', place, rival);

	rollPirateDice(voyage, starter.userId, randomFor([6, 5, 4, 6, 2]));
	const starterScore = submitPirateRound(voyage, starter.userId);
	rollPirateDice(voyage, rival.userId, randomFor([6, 1, 1, 1, 1]));
	const extraRoll = rollPirateDice(voyage, rival.userId, randomFor([5, 4, 6, 6]));

	assert.equal(starterScore.score, 8);
	assert.equal(voyage.round.rollLimit, 1);
	assert.equal(extraRoll.ok, false);
	assert.match(extraRoll.error, /No rolls remain/);
	assert.equal(voyage.players.rival.turn.rollsTaken, 1);
	assert.equal(getPlaceVoyageSummary('dock', rival.userId).you.turn.rollsRemaining, 0);
});

test('highest previous score starts the next round', () => {
	clearPirateVoyagesForTests();
	const starter = dave('starter', 'Starter Dave');
	const rival = dave('rival', 'Rival Dave');
	const { voyage } = launchPirateVoyage('dock', place, starter);
	joinPirateVoyage('dock', place, rival);

	rollPirateDice(voyage, starter.userId, randomFor([6, 5, 4, 1, 1]));
	submitPirateRound(voyage, starter.userId);
	rollPirateDice(voyage, rival.userId, randomFor([6, 5, 4, 6, 6]));
	submitPirateRound(voyage, rival.userId);

	assert.equal(voyage.round.starterId, rival.userId);
	assert.equal(voyage.round.currentIndex, 0);
	assert.deepEqual(voyage.round.order, [rival.userId, starter.userId]);
	assert.deepEqual(voyage.players.starter.turn.dice, []);
	assert.deepEqual(voyage.players.rival.turn.dice, []);
	assert.equal(getPlaceVoyageSummary('dock', starter.userId).currentPlayerId, rival.userId);
});
