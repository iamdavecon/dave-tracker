import * as state from "../public/utils/state.js";

export function spawnBot(me) {
	const id = "bot_" + crypto.randomUUID();
	//const botState = state.getRandomState();
	const botState = state.getDefaultState();
	const tenMinutesLater = Date.now() + 10 * 60 * 1000;

	const centerLat = me.lat;
	const centerLon = me.lon;

	return {
		lat: centerLat + (Math.random() - 0.5) * 0.001,
		lon: centerLon + (Math.random() - 0.5) * 0.001,

		userId: id,
		isBot: true,
		infectedBy: [],
		icon: "CIVILIAN",
		state: botState,
		updatedAt: tenMinutesLater
	};

}
