import test from "node:test";
import assert from "node:assert/strict";

import { SIGNAL_CATALOG } from "../signalCatalog.js";
import {
	SIGNAL_OPTION_COUNT,
	SIGNAL_ROUND_MS,
	awardSignalFragments,
	clearSignalRoundsForTests,
	startSignalRound,
	submitSignalAnswer,
	summarizeSignalRound
} from "../utils/resolveSignal.js";

const place = { id: "node", name: "Test Node" };
const players = [
	{ userId: "starter", name: "Starter Dave" },
	{ userId: "helper", name: "Helper Dave" },
	{ userId: "third", name: "Third Dave" }
];

test("signal catalog contains at least 256 unique answers with usable clues", () => {
	assert.equal(SIGNAL_CATALOG.length, 272);
	assert.equal(new Set(SIGNAL_CATALOG.map(entry => entry.answer)).size, SIGNAL_CATALOG.length);
	assert.equal(SIGNAL_CATALOG.every(entry => entry.clues.length >= 4), true);
});

test("starting a signal gives private clues and only exposes options to the starter", () => {
	clearSignalRoundsForTests();
	const result = startSignalRound("node", place, players[0], players, { now: 1_000, random: () => 0 });
	assert.equal(result.ok, true);

	const starter = summarizeSignalRound("node", "starter", 1_000);
	const helper = summarizeSignalRound("node", "helper", 1_000);
	const spectator = summarizeSignalRound("node", "spectator", 1_000);

	assert.equal(starter.options.length, SIGNAL_OPTION_COUNT);
	assert.equal(new Set(starter.options).size, SIGNAL_OPTION_COUNT);
	assert.equal(starter.clue != null, true);
	assert.equal(helper.clue != null, true);
	assert.deepEqual(helper.options, []);
	assert.equal(spectator.clue, null);
	assert.equal(starter.solution, null);
	assert.equal(starter.deadline, 1_000 + SIGNAL_ROUND_MS);
});

test("a starts-with clue makes at least half the options start with that letter", () => {
	clearSignalRoundsForTests();
	const fourPlayers = [...players, { userId: "fourth", name: "Fourth Dave" }];
	startSignalRound("node", place, fourPlayers[0], fourPlayers, { now: 2_000, random: () => 0 });
	const summaries = fourPlayers.map(player => summarizeSignalRound("node", player.userId, 2_000));
	const letterClue = summaries.find(summary => summary.clue.startsWith("starts with "))?.clue;
	assert.equal(letterClue, "starts with A");
	const matchingOptions = summaries[0].options.filter(answer => answer.startsWith("a"));
	assert.equal(matchingOptions.length >= Math.ceil(SIGNAL_OPTION_COUNT / 2), true);
});

test("a word-length clue makes at least 25 percent of the options share that length", () => {
	clearSignalRoundsForTests();
	const fivePlayers = [...players,
		{ userId: "fourth", name: "Fourth Dave" },
		{ userId: "fifth", name: "Fifth Dave" }
	];
	startSignalRound("node", place, fivePlayers[0], fivePlayers, { now: 3_000, random: () => 0 });
	const summaries = fivePlayers.map(player => summarizeSignalRound("node", player.userId, 3_000));
	const lengthClue = summaries.find(summary => /^\d+ letters/.test(summary.clue))?.clue;
	const requiredLength = Number.parseInt(lengthClue, 10);
	assert.equal(requiredLength, 5);
	const matchingOptions = summaries[0].options.filter(answer => answer.replace(/[^a-z]/gi, "").length === requiredLength);
	assert.equal(matchingOptions.length >= Math.ceil(SIGNAL_OPTION_COUNT * 0.25), true);
});

test("travelogue clues are shared and broad rather than unique answer giveaways", () => {
	const travelogueClues = SIGNAL_CATALOG.flatMap(entry => entry.clues)
		.filter(clue => /travel day|dead-looking ground|old walls|part of the narrative/.test(clue));
	const frequencies = travelogueClues.reduce((counts, clue) => {
		counts[clue] = (counts[clue] ?? 0) + 1;
		return counts;
	}, {});
	assert.equal(Object.keys(frequencies).length, 4);
	assert.equal(Object.values(frequencies).every(count => count >= 6), true);
});

test("hacker-con clues are shared across several plausible answers", () => {
	const hackerClues = SIGNAL_CATALOG.flatMap(entry => entry.clues)
		.filter(clue => /sleep deprivation|airport|interacting with it|start a story|midnight recedes/.test(clue));
	const frequencies = hackerClues.reduce((counts, clue) => {
		counts[clue] = (counts[clue] ?? 0) + 1;
		return counts;
	}, {});
	assert.equal(Object.keys(frequencies).length, 5);
	assert.equal(Object.values(frequencies).every(count => count >= 5), true);
});

test("only the starter can answer and a correct selection resolves the round", () => {
	clearSignalRoundsForTests();
	startSignalRound("node", place, players[0], players, { now: 5_000, random: () => 0 });
	const starter = summarizeSignalRound("node", "starter", 5_000);
	const solution = SIGNAL_CATALOG[0].answer;

	assert.equal(submitSignalAnswer("node", "helper", starter.options[0], 6_000).ok, false);
	const result = submitSignalAnswer("node", "starter", solution, 6_000);
	assert.equal(result.ok, true);
	assert.equal(result.correct, true);
	assert.equal(summarizeSignalRound("node", "helper", 6_000).solution, solution);
});

test("a round times out after two minutes and permits a new start", () => {
	clearSignalRoundsForTests();
	startSignalRound("node", place, players[0], players, { now: 10_000, random: () => 0 });
	const expired = summarizeSignalRound("node", "starter", 10_000 + SIGNAL_ROUND_MS);
	assert.equal(expired.status, "timeout");
	assert.equal(expired.active, false);
	assert.equal(expired.stats.wrong, 1);

	const restarted = startSignalRound("node", place, players[1], players, {
		now: 10_001 + SIGNAL_ROUND_MS,
		random: () => 0.5
	});
	assert.equal(restarted.ok, true);
	assert.equal(restarted.round.startedBy, "helper");
});

test("every fifth right answer awards one fragment to every round player", () => {
	clearSignalRoundsForTests();
	let fifthResult;
	for (let roundNumber = 0; roundNumber < 5; roundNumber += 1) {
		startSignalRound("node", place, players[0], players, {
			now: 20_000 + roundNumber * 2_000,
			random: () => 0
		});
		fifthResult = submitSignalAnswer("node", "starter", SIGNAL_CATALOG[0].answer, 21_000 + roundNumber * 2_000);
	}

	assert.equal(fifthResult.round.fragmentRewardEarned, true);
	assert.deepEqual(summarizeSignalRound("node", "starter", 30_000).stats, {
		right: 5,
		wrong: 0,
		untilFragment: 5
	});

	const daves = Object.fromEntries(players.map(player => [player.userId, {
		...player,
		fragmentsCollected: []
	}]));
	const awarded = awardSignalFragments(fifthResult.round, daves);
	assert.equal(awarded.length, players.length);
	assert.equal(players.every(player => daves[player.userId].fragmentsCollected.length === 1), true);
	assert.deepEqual(awardSignalFragments(fifthResult.round, daves), []);
});

test("a submitted miss increments the wrong-answer record", () => {
	clearSignalRoundsForTests();
	startSignalRound("node", place, players[0], players, { now: 40_000, random: () => 0 });
	const summary = summarizeSignalRound("node", "starter", 40_000);
	const wrongOption = summary.options.find(answer => answer !== SIGNAL_CATALOG[0].answer);
	submitSignalAnswer("node", "starter", wrongOption, 41_000);
	assert.deepEqual(summarizeSignalRound("node", "starter", 41_000).stats, {
		right: 0,
		wrong: 1,
		untilFragment: 5
	});
});
