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
			//console.log("LOADED: " + JSON.stringify(savedDaves, null, 2));
		} else {
			savedDaves = {};
		}
	}
	return savedDaves;
}

export async function saveUsers(daves) {
	//console.log("SAVE: " + JSON.stringify(savedDaves, null, 2));

	let mergedUsers = getUsers(daves);
	//console.log(`[SAVE]  ${JSON.stringify(mergedUsers, null, 2)}`);
	const realUsers = Object.fromEntries(
		Object.entries(mergedUsers).filter(([id, user]) => !user.isBot)
	);
	savedDaves = realUsers;

	if (USE_REDIS) {
		await redis.set("davecon:users", JSON.stringify(realUsers)); 
	} else {
		fs.writeFileSync(DATA_FILE, JSON.stringify(realUsers, null, 2)); 
	}

	//console.log(`[SAVE]  wrote ${JSON.stringify(realUsers, null, 2)}`);
}

export function getUsers(daves) {
	const merged = { ...savedDaves };

	//console.log("GETTING DAVES");
	for (const [id, info] of Object.entries(daves)) {
		//console.log("\t" + id);
		if (!info.userId) {
			continue;
		}
		merged[id] = info; 
	}
	return merged;
}
