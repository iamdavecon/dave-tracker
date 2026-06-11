import test from 'node:test';
import assert from 'node:assert/strict';

import { BOT_NAMES, DAVE_TANGENT_NAME, GOON_NAME, getBotLifetimeMs, getDefaultBotName, hasDaveTangent, spawnBot, updateBots } from '../utils/bots.js';

test('spawnBot creates short-lived bots without future-dating updatedAt', () => {
	const before = Date.now();
	const bot = spawnBot({ lat: 41, lng: -87 }, { name: 'CIVILIAN' });
	const after = Date.now();

	assert.equal(bot.isBot, true);
	assert.equal(bot.name, 'CIVILIAN');
	assert.ok(bot.updatedAt >= before);
	assert.ok(bot.updatedAt <= after);
	assert.equal(getBotLifetimeMs(), 2 * 60 * 1000);
});

test('spawnBot supports a DaveTangent variant and detects only live bot instances', () => {
	const bot = spawnBot({ lat: 41, lng: -87 }, { name: DAVE_TANGENT_NAME });

	assert.equal(bot.name, DAVE_TANGENT_NAME);
	assert.equal(hasDaveTangent({ [bot.userId]: bot }), true);
	assert.equal(hasDaveTangent({ realDave: { name: DAVE_TANGENT_NAME } }), false);
});

test('default bot names sometimes spawn as GOON or a random civilian name', () => {
	assert.equal(BOT_NAMES.length, 64);
	assert.equal(getDefaultBotName(() => 0), GOON_NAME);
	assert.equal(getDefaultBotName(() => 0.99), 'Wren');
	assert.equal(getDefaultBotName(() => 0.11), 'Brook');
});

test('updateBots moves bots without refreshing updatedAt', () => {
	const bot = spawnBot({ lat: 41, lng: -87 }, { name: 'CIVILIAN' });
	const updatedAt = bot.updatedAt;

	bot.targetLat = bot.lat + 0.001;
	bot.targetLng = bot.lng + 0.001;

	updateBots({ [bot.userId]: bot });

	assert.equal(bot.updatedAt, updatedAt);
});
