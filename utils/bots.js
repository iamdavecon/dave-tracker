import * as state from "../public/utils/state.js";

export function spawnBot(me) {
	const id = "bot_" + crypto.randomUUID();
	const botState = state.getRandomBotState();
	const tenMinutesLater = Date.now() + 10 * 60 * 1000;

	const centerLat = me.lat;
	const centerLon = me.lng;

	return {
		lat: centerLat + (Math.random() - 0.5) * 0.001,
		lng: centerLon + (Math.random() - 0.5) * 0.001,

		userId: id,
		isBot: true,
		infectedBy: [],
		name: "CIVILIAN",
		state: botState,
		updatedAt: tenMinutesLater
	};

}

const METERS_TO_DEGREES = 1 / 111_111; // ~1 meter in latitude

function pickNewTarget(bot) {
	const MAX_DISTANCE_METERS = 100; 

	const dx = (Math.random() - 0.5) * MAX_DISTANCE_METERS;
	const dy = (Math.random() - 0.5) * MAX_DISTANCE_METERS;

	bot.targetLat = bot.lat + dy * METERS_TO_DEGREES;
	bot.targetLng = bot.lng + dx * METERS_TO_DEGREES;
}

function moveBot(bot) {
	if (!bot.targetLat || !bot.targetLng) {
		pickNewTarget(bot);
	}

	const dx = bot.targetLng - bot.lng;
	const dy = bot.targetLat - bot.lat;

	const dist = Math.sqrt(dx * dx + dy * dy);

	// If close to target, pick a new one
	const ARRIVAL_THRESHOLD = 2 * METERS_TO_DEGREES;
	if (dist < ARRIVAL_THRESHOLD) {
		pickNewTarget(bot);
		return;
	}

	// Move ~1 meter per tick
	const STEP_METERS = 1;
	const step = STEP_METERS * METERS_TO_DEGREES;

	bot.lng += (dx / dist) * step;
	bot.lat += (dy / dist) * step;
}

export function updateBots(bots) {
	Object.entries(bots)
		.forEach(([key, bot], idx) => {
			moveBot(bot);
		});
}
