import * as state from "../public/utils/state.js";

const BOT_LIFETIME_MS = 2 * 60 * 1000;
const GOON_SPAWN_CHANCE = 0.1;
export const BOT_NAMES = [
	"Alex",
	"Amari",
	"Arden",
	"Avery",
	"Bailey",
	"Bellamy",
	"Blake",
	"Brook",
	"Cameron",
	"Casey",
	"Charlie",
	"Dakota",
	"Devon",
	"Drew",
	"Emerson",
	"Finley",
	"Frankie",
	"Gray",
	"Harper",
	"Hayden",
	"Indigo",
	"Jamie",
	"Jesse",
	"Jules",
	"Jordan",
	"Kai",
	"Kendall",
	"Kit",
	"Lane",
	"Lee",
	"Lennon",
	"Logan",
	"London",
	"Marlow",
	"Micah",
	"Morgan",
	"Noa",
	"Oakley",
	"Parker",
	"Peyton",
	"Phoenix",
	"Quinn",
	"Reese",
	"Remy",
	"Riley",
	"River",
	"Robin",
	"Rowan",
	"Ryan",
	"Sage",
	"Sam",
	"Sawyer",
	"Scout",
	"Shawn",
	"Skyler",
	"Sloan",
	"Spencer",
	"Sunny",
	"Tatum",
	"Taylor",
	"Teagan",
	"Toby",
	"Val",
	"Wren"
];

export const DAVE_TANGENT_NAME = "DaveTangent";
export const GOON_NAME = "GOON";

export function getBotLifetimeMs() {
	return BOT_LIFETIME_MS;
}

export function hasDaveTangent(daves = {}) {
	return Object.values(daves).some((dave) => dave?.isBot && dave.name === DAVE_TANGENT_NAME);
}

export function getDefaultBotName(random = Math.random) {
	if (random() < GOON_SPAWN_CHANCE) {
		return GOON_NAME;
	}
	return BOT_NAMES[Math.floor(random() * BOT_NAMES.length)];
}

export function spawnBot(me, options = {}) {
	const id = "bot_" + crypto.randomUUID();
	const botState = state.getRandomBotState();

	const centerLat = me.lat;
	const centerLon = me.lng;

	return {
		lat: centerLat + (Math.random() - 0.5) * 0.0008,
		lng: centerLon + (Math.random() - 0.5) * 0.0008,

		userId: id,
		isBot: true,
		infectedBy: [],
		name: options.name || getDefaultBotName(),
		state: botState,
		updatedAt: Date.now()
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
