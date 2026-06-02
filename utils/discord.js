import { readFileSync } from "node:fs";

const DEFAULT_DISCORD_WEBHOOK_FILE = new URL("../discord-webhook.txt", import.meta.url);

export function getDiscordWebhookUrl(env = process.env, webhookFile = DEFAULT_DISCORD_WEBHOOK_FILE) {
	if (env.DISCORD_WEBHOOK_URL) {
		return env.DISCORD_WEBHOOK_URL;
	}

	try {
		return readFileSync(webhookFile, "utf8").trim();
	} catch {
		return "";
	}
}

export function shouldPostToDiscord(logEntry, options = {}) {
	return Boolean(logEntry?.message && options.important);
}

export function formatDiscordLogMessage(logEntry) {
	return `${logEntry.message}`;
}

export async function postDiscordMessage(content, {
	webhookUrl = getDiscordWebhookUrl(),
	fetchImpl = globalThis.fetch
} = {}) {
	if (!webhookUrl || typeof fetchImpl !== "function") {
		return false;
	}

	const response = await fetchImpl(webhookUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			content: String(content).slice(0, 2000)
		})
	});

	if (!response.ok) {
		throw new Error(`Discord webhook failed with status ${response.status}`);
	}

	return true;
}

export async function postImportantLogToDiscord(logEntry, options = {}) {
	if (!shouldPostToDiscord(logEntry, options)) {
		return false;
	}

	return postDiscordMessage(formatDiscordLogMessage(logEntry), options);
}
