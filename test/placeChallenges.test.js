import test from 'node:test';
import assert from 'node:assert/strict';

import {
	formatPlaceChallengePrompt,
	getPlaceChallengeQuestion,
	getPlaceFragmentChallengeForEmoji,
	HACKER_JEOPARDY_QUESTIONS,
	isCorrectPlaceFragmentAnswer,
	shufflePlaceChallengeOptions
} from '../public/utils/placeChallenges.js';

test('place fragment challenges map emoji to actions', () => {
	assert.equal(getPlaceFragmentChallengeForEmoji('🙅').action, 'hackerJeopardy');
	assert.equal(getPlaceFragmentChallengeForEmoji('⚙️').action, 'hardwareHacking');
	assert.equal(getPlaceFragmentChallengeForEmoji('⚙').action, 'hardwareHacking');
	assert.equal(getPlaceFragmentChallengeForEmoji('🎖️').action, 'vetcon');
});

test('place fragment challenge answers are normalized', () => {
	assert.equal(isCorrectPlaceFragmentAnswer('hackerJeopardy', ' What is viscosity? ', 'viscosity'), true);
	assert.equal(isCorrectPlaceFragmentAnswer('hackerJeopardy', '1', 'viscosity'), true);
	assert.equal(isCorrectPlaceFragmentAnswer('hardwareHacking', 'multi   meter'), true);
	assert.equal(isCorrectPlaceFragmentAnswer('vetcon', '7:00 PM'), true);
	assert.equal(isCorrectPlaceFragmentAnswer('vetcon', 'noon'), false);
});

test('hacker jeopardy supports a larger multiple-choice question bank', () => {
	assert.ok(HACKER_JEOPARDY_QUESTIONS.length >= 10);
	assert.equal(getPlaceChallengeQuestion('hackerJeopardy', 'viscosity').answer, 'What is viscosity?');
	assert.equal(HACKER_JEOPARDY_QUESTIONS.some((question) => question.options.includes('What is South America?')), true);
	assert.equal(getPlaceChallengeQuestion('hackerJeopardy', 'malort').answer, 'What is Malort?');
	assert.equal(getPlaceChallengeQuestion('hackerJeopardy', 'beef-thief').answer, 'Who is beef thief?');
	assert.equal(isCorrectPlaceFragmentAnswer('hackerJeopardy', 'Malort', 'malort'), false);
	assert.equal(isCorrectPlaceFragmentAnswer('hackerJeopardy', 'Beef Thief', 'beef-thief'), false);
});

test('hacker jeopardy includes the ACDC BEEF XOR question', () => {
	const question = getPlaceChallengeQuestion('hackerJeopardy', 'acdc-beef-xor');

	assert.equal(question.clue, '0xACDC XOR 0xBEEF');
	assert.equal(question.answer, '0x1233');
	assert.equal(isCorrectPlaceFragmentAnswer('hackerJeopardy', '0x1233', 'acdc-beef-xor'), true);
	assert.equal(isCorrectPlaceFragmentAnswer('hackerJeopardy', '0xCAFE', 'acdc-beef-xor'), false);
});

test('place challenge prompts can render randomized answer order', () => {
	const question = getPlaceChallengeQuestion('hackerJeopardy', 'acdc-beef-xor');
	const originalRandom = Math.random;
	Math.random = () => 0;

	try {
		const options = shufflePlaceChallengeOptions(question);
		const prompt = formatPlaceChallengePrompt({ label: 'Hacker Jeopardy' }, question, options);

		assert.notDeepEqual(options, question.options);
		assert.match(prompt, /1\. 0x1213/);
		assert.match(prompt, /3\. 0xBEEF/);
		assert.match(prompt, /4\. 0x1233/);
	} finally {
		Math.random = originalRandom;
	}
});
