import { Redis } from '@upstash/redis';
import fs from 'fs';

const USE_REDIS = process.env.USE_REDIS === "true";
const USER_FILE = "./users.json";
const PLACE_FILE = "./places.json";

let redis;
if (USE_REDIS) {
	redis = new Redis({
		url: process.env.REDIS_URL,
		token: process.env.REDIS_TOKEN,
	});
}

let savedDaves = {};
let savedPlaces = {};
let lastSavedUsersJson = null;
let lastSavedPlacesJson = null;

function setSavedSnapshots() {
	lastSavedUsersJson = JSON.stringify(savedDaves, null, 2);
	lastSavedPlacesJson = JSON.stringify(savedPlaces, null, 2);
}

async function persistSavedData(users, places) {
	const usersJson = JSON.stringify(users, null, 2);
	const placesJson = JSON.stringify(places, null, 2);

	if (usersJson === lastSavedUsersJson && placesJson === lastSavedPlacesJson) {
		//console.log("skipping save. nothing changed");
		return false;
	}

	if (USE_REDIS) {
		await redis.set("davecon:users", usersJson); 
		await redis.set("davecon:places", placesJson); 
	} else {
		fs.writeFileSync(USER_FILE, usersJson); 
		fs.writeFileSync(PLACE_FILE, placesJson); 
	}

	lastSavedUsersJson = usersJson;
	lastSavedPlacesJson = placesJson;
	return true;
}

export async function loadUsers() {
	if (USE_REDIS) {
		savedDaves = await redis.get("davecon:users");
		savedPlaces = await redis.get("davecon:places");

		if (savedDaves !== null) {
			console.log("[LOAD] users from redis");
		} else {
			console.log("[LOAD] init from redis");
			savedDaves = {}; 
		}
		if (savedPlaces !== null) {
			console.log("[LOAD] places from redis");
		} else {
			savedPlaces = {}; 
		}

	} else {
		if (fs.existsSync(USER_FILE)) {
			console.log("[LOAD] users from file");
			savedDaves = JSON.parse(fs.readFileSync(USER_FILE, "utf8"));
		} else {
			console.log("[LOAD] init from file");
			savedDaves = {};
		}
		if (fs.existsSync(PLACE_FILE)) {
			console.log("[LOAD] places from file");
			savedPlaces = JSON.parse(fs.readFileSync(PLACE_FILE, "utf8"));
		} else {
			savedPlaces = {};
		}
	}
	setSavedSnapshots();
	//console.log("LOADED: " + JSON.stringify(savedDaves, null, 2));
	return savedDaves;
}

export async function saveUsers(daves, places) {
	if (!daves) {
		daves = {};
	}
	if (!places) {
		places = savedPlaces;
	}
	//console.log("SAVE: " + JSON.stringify(savedDaves, null, 2));
	//console.log("SAVE: " + JSON.stringify(places, null, 2));

	let mergedUsers = getUsers(daves);
	//console.log(`[SAVE]  ${JSON.stringify(mergedUsers, null, 2)}`);
	const realUsers = Object.fromEntries(
		Object.entries(mergedUsers).filter(([id, user]) => !user.isBot)
	);
	savedDaves = realUsers;
	savedPlaces = places;

	const changed = await persistSavedData(realUsers, places);
	//console.log(`[SAVE]  wrote ${JSON.stringify(realUsers, null, 2)}`);
	return changed;
}

export async function replaceSavedData(users, places) {
	const realUsers = Object.fromEntries(
		Object.entries(users ?? {}).filter(([id, user]) => !user.isBot)
	);
	savedDaves = realUsers;
	savedPlaces = places ?? {};

	return persistSavedData(savedDaves, savedPlaces);
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

export function getPlaces() {
	return savedPlaces;
}
