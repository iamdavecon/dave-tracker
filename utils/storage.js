import { Redis } from '@upstash/redis';
import fs from 'fs';

const USE_REDIS = process.env.USE_REDIS === "true";
const DATA_FILE = "./users.json";

let redis;
if (USE_REDIS) {
	redis = new Redis({
		url: process.env.REDIS_URL,
		token: process.env.REDIS_TOKEN,
	});
}

let savedDaves = {};

export async function loadUsers() {
	if (USE_REDIS) {
		savedDaves = await redis.get("davecon:users");

		// If Redis returned a non-null value, parse it as JSON
		if (savedDaves !== null) {
			console.log("[LOAD] from redis");
		} else {
			console.log("[LOAD] empty from redis");
			savedDaves = {}; 
		}
	} else {
		if (fs.existsSync(DATA_FILE)) {
			console.log("[LOAD] from file");
			savedDaves = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
		} else {
			savedDaves = {};
		}
	}
	return savedDaves;
}

export async function saveUsers(daves) {
	const merged = { ...savedDaves };

	for (const [id, info] of Object.entries(daves)) {
		if (!info.userId) {
			continue;
		}
		merged[id] = info; 
	}
	savedDaves = merged;

	if (USE_REDIS) {
		await redis.set("davecon:users", JSON.stringify(merged)); 
	} else {
		fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2)); 
	}

	//console.log(`[SAVE]  wrote ${JSON.stringify(merged, null, 2)}`);
}


