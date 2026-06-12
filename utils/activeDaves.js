import { getBotLifetimeMs } from "./bots.js";

export function isActiveDave(info, now = Date.now()) {
	if (!info || !Number.isFinite(info.updatedAt)) {
		return false;
	}

	if (info.isTest) {
		return true;
	}

	const maxIdleMs = info.isBot ? getBotLifetimeMs() : 15 * 60 * 1000;
	return info.updatedAt >= now - maxIdleMs;
}

export function getActiveDaves(daves = {}, now = Date.now()) {
	return Object.fromEntries(
		Object.entries(daves).filter(([, info]) => isActiveDave(info, now))
	);
}
