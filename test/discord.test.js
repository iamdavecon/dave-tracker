import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	formatDiscordLogMessage,
	getDiscordWebhookUrl,
	postDiscordMessage,
	postImportantLogToDiscord,
	shouldPostToDiscord
} from '../utils/discord.js';

test('discord webhook url can be overridden by the environment', () => {
	assert.equal(getDiscordWebhookUrl({ DISCORD_WEBHOOK_URL: 'https://example.test/webhook' }), 'https://example.test/webhook');
});

test('discord webhook url falls back to a local file', () => {
	const dir = mkdtempSync(join(tmpdir(), 'dave-tracker-'));
	const file = join(dir, 'discord-webhook.txt');

	writeFileSync(file, 'https://example.test/file-webhook\n');

	assert.equal(getDiscordWebhookUrl({}, file), 'https://example.test/file-webhook');
});

test('only important log events are posted to Discord', () => {
	const entry = { message: 'Source established a new node.' };

	assert.equal(shouldPostToDiscord(entry, { important: true }), true);
	assert.equal(shouldPostToDiscord(entry, {}), false);
	assert.equal(shouldPostToDiscord({}, { important: true }), false);
});

test('discord messages include the Dave Tracker source label', () => {
	assert.equal(formatDiscordLogMessage({ message: 'Source started a Dave Rave.' }), '**Dave Tracker**\nSource started a Dave Rave.');
});

test('postDiscordMessage sends Discord JSON without using the real network', async () => {
	const calls = [];
	const fetchImpl = async (url, options) => {
		calls.push({ url, options });
		return { ok: true, status: 204 };
	};

	const posted = await postDiscordMessage('Hello', {
		webhookUrl: 'https://example.test/webhook',
		fetchImpl
	});

	assert.equal(posted, true);
	assert.equal(calls[0].url, 'https://example.test/webhook');
	assert.equal(calls[0].options.method, 'POST');
	assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
	assert.deepEqual(JSON.parse(calls[0].options.body), { content: 'Hello' });
});

test('postImportantLogToDiscord ignores ordinary events', async () => {
	let called = false;

	const posted = await postImportantLogToDiscord(
		{ message: 'Routine event.' },
		{
			fetchImpl: async () => {
				called = true;
				return { ok: true, status: 204 };
			}
		}
	);

	assert.equal(posted, false);
	assert.equal(called, false);
});
