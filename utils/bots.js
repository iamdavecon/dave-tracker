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

const BOT_STEP_SIZE = 0.0001;     // how far they move per tick
const BOT_TARGET_RADIUS = 0.001;  // how far they can wander
const BOT_RETARGET_CHANCE = 0.02; // 2% chance per tick

export function updateBots(bots) {
	Object.entries(bots)
		.forEach(([key, bot], idx) => {
			// occasionally pick a new target
			if (!bot.target || Math.random() < BOT_RETARGET_CHANCE) {
				bot.target = {
					lat: bot.lat + (Math.random() - 0.5) * BOT_TARGET_RADIUS,
					lng: bot.lng + (Math.random() - 0.5) * BOT_TARGET_RADIUS
				};
			}

			// move toward target
			const dx = bot.target.lng - bot.lng;
			const dy = bot.target.lat - bot.lat;
			const dist = Math.sqrt(dx*dx + dy*dy);

			if (dist > 0) {
				bot.lng += (dx / dist) * BOT_STEP_SIZE;
				bot.lat += (dy / dist) * BOT_STEP_SIZE;
			}
		});
}
