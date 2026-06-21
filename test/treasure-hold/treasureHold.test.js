import test from "node:test";
import assert from "node:assert/strict";

import {
	clearTreasureHoldsForTests,
	createTreasureHold,
	joinTreasureHold,
	rollTreasureHold,
	returnToPort,
	sailOn
} from "../../utils/treasure-hold/treasureHold.js";

const place = { id: "dock", name: "Test Dock" };
const dave = (userId, name = userId) => ({ userId, name, lat: 1, lng: 1 });

function randomForFaces(faces) {
	const faceIndexes = {
		treasure: 0,
		map: 2,
		crew: 3,
		storm: 4,
		skull: 5
	};
	const values = faces.map(face => (faceIndexes[face] + 0.25) / 6);
	return () => values.shift() ?? 0;
}

function twoPlayerGame() {
	clearTreasureHoldsForTests();
	const captain = dave("captain", "Captain");
	const mate = dave("mate", "Mate");
	const { game } = createTreasureHold("dock", place, captain);
	joinTreasureHold(game.id, mate);
	return { game, captain, mate };
}

test("requires two players to begin and closes joining after the first roll", () => {
	clearTreasureHoldsForTests();
	const captain = dave("captain");
	const { game } = createTreasureHold("dock", place, captain);

	assert.match(rollTreasureHold(game, captain.userId).error, /at least 2 players/);
	joinTreasureHold(game.id, dave("mate"));
	assert.equal(rollTreasureHold(game, captain.userId, randomForFaces(Array(6).fill("treasure"))).ok, true);
	assert.match(joinTreasureHold(game.id, dave("late")).error, /already set sail/);
});

test("resolves treasure, maps, cancelled danger, and carried state", () => {
	const { game, captain } = twoPlayerGame();
	const first = rollTreasureHold(game, captain.userId, randomForFaces([
		"treasure", "treasure", "map", "map", "storm", "crew"
	]));

	assert.equal(first.roll.dangerThisRoll, 0);
	assert.equal(game.players.captain.currentLoot, 2);
	assert.equal(game.players.captain.maps, 2);
	assert.equal(game.players.captain.awaitingChoice, true);

	const second = sailOn(game, captain.userId, randomForFaces([
		"map", "treasure", "storm", "skull", "crew", "treasure"
	]));
	assert.equal(second.roll.mapBonuses, 1);
	assert.equal(game.players.captain.currentLoot, 9);
	assert.equal(game.players.captain.maps, 0);
	assert.equal(game.players.captain.danger, 1);
});

test("danger accumulates, busts at six, and clears unbanked loot", () => {
	const { game, captain } = twoPlayerGame();
	rollTreasureHold(game, captain.userId, randomForFaces([
		"treasure", "treasure", "storm", "crew", "map", "map"
	]));
	const result = sailOn(game, captain.userId, randomForFaces([
		"skull", "skull", "storm", "crew", "treasure", "treasure"
	]));

	assert.equal(result.roll.busted, false);
	assert.equal(game.players.captain.danger, 2);
	assert.equal(game.players.captain.active, true);

	const last = sailOn(game, captain.userId, randomForFaces([
		"skull", "crew", "storm", "treasure", "treasure", "map"
	]));
	assert.equal(last.roll.busted, false);
	assert.equal(game.players.captain.danger, 3);

	const bust = sailOn(game, captain.userId, randomForFaces([
		"skull", "skull", "skull", "treasure", "treasure", "treasure"
	]));
	assert.equal(bust.roll.busted, true);
	assert.equal(game.players.captain.danger, 6);
	assert.equal(game.players.captain.currentLoot, 0);
	assert.equal(game.players.captain.active, false);
});

test("crew can never reduce carried danger", () => {
	const { game, captain } = twoPlayerGame();
	game.players.captain.danger = 2;
	const result = rollTreasureHold(game, captain.userId, randomForFaces(Array(6).fill("crew")));

	assert.equal(result.roll.dangerThisRoll, 0);
	assert.equal(game.players.captain.danger, 2);
});

test("defeating the kraken awards ten bonus loot", () => {
	const { game, captain } = twoPlayerGame();
	const result = rollTreasureHold(game, captain.userId, randomForFaces([
		"treasure", "crew", "treasure", "crew", "treasure", "crew"
	]));

	assert.equal(result.roll.krakenDefeated, true);
	assert.equal(game.players.captain.currentLoot, 13);
});

test("returning banks loot and the voyage resets after everyone finishes", () => {
	const { game, captain, mate } = twoPlayerGame();
	rollTreasureHold(game, captain.userId, randomForFaces(Array(6).fill("treasure")));
	const captainReturn = returnToPort(game, captain.userId);
	rollTreasureHold(game, mate.userId, randomForFaces(Array(6).fill("treasure")));
	const mateReturn = returnToPort(game, mate.userId);

	assert.equal(captainReturn.banked, 16);
	assert.equal(captainReturn.transition, null);
	assert.equal(mateReturn.transition.type, "voyageEnded");
	assert.equal(game.round, 2);
	assert.equal(game.players.captain.score, 16);
	assert.equal(game.players.captain.currentLoot, 0);
	assert.equal(game.players.captain.danger, 0);
	assert.equal(game.players.captain.maps, 0);
	assert.equal(game.players.captain.active, true);
});

test("finishes after five voyages and reports tied winners", () => {
	const { game, captain, mate } = twoPlayerGame();
	for (let round = 1; round <= 5; round += 1) {
		for (const player of [captain, mate]) {
			rollTreasureHold(game, player.userId, randomForFaces(Array(6).fill("treasure")));
			const result = returnToPort(game, player.userId);
			if (round === 5 && player === mate) {
				assert.equal(result.transition.type, "finished");
				assert.equal(result.transition.winners.length, 2);
			}
		}
	}

	assert.equal(game.round, 6);
	assert.equal(game.state, "finished");
	assert.equal(game.players.captain.score, 80);
	assert.equal(game.players.mate.score, 80);
});

test("caps the crew at eight players", () => {
	clearTreasureHoldsForTests();
	const { game } = createTreasureHold("dock", place, dave("p1"));
	for (let index = 2; index <= 8; index += 1) {
		assert.equal(joinTreasureHold(game.id, dave(`p${index}`)).ok, true);
	}
	assert.match(joinTreasureHold(game.id, dave("p9")).error, /8 players maximum/);
});
