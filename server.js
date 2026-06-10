import { saveUsers, loadUsers, getUsers, getPlaces, replaceSavedData } from './utils/storage.js';
import * as state from "./public/utils/state.js";
import { getFragmentFrom } from "./public/utils/id.js";  
import { isDebugId } from "./utils/debugAccess.js";
import { inRange } from "./public/utils/distance.js";

import { notifyUser } from './utils/sockets.js';
import * as infect from './utils/infect.js';
import * as stabilize from './utils/stabilize.js';
import * as items from './utils/items.js';
import * as places from './utils/places.js';
import * as raves from './utils/raves.js';
import * as ascension from './utils/ascension.js';
import * as debug from './utils/debug.js';
import { postImportantLogToDiscord } from './utils/discord.js';
import { DAVE_TANGENT_NAME, getBotLifetimeMs, hasDaveTangent, spawnBot, updateBots } from "./utils/bots.js";
import { summarizeDave, getInteraction } from "./utils/players.js";
import { applyLineconBump } from "./utils/linecon.js";
import { addCommendations } from "./public/utils/dod.js";
import { resetAllCooldowns } from "./utils/cooldowns.js";
import { applyLocationActivity, markActive } from "./utils/activity.js";


// --- HTTP server ---
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

const io = new Server(server);

export function getIO() {
	return io;
}

app.use(express.static('public'));
app.use('/utils', express.static('utils'));
app.use(express.json({ limit: '2mb' })); 

export function getApp() {
	return app;
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`server running at http://localhost:${PORT}`);
});

// --- In-memory state ---
let savedDaves = await loadUsers();
let savedPlaces = getPlaces();

let daves = { ...savedDaves };  

function isActiveDave(info, now = Date.now()) {
	if (!info || !Number.isFinite(info.updatedAt)) {
		return false;
	}

	const maxIdleMs = info.isBot ? getBotLifetimeMs() : 15 * 60 * 1000;
	return info.updatedAt >= now - maxIdleMs;
}

function getActiveDaves() {
	return Object.fromEntries(
		Object.entries(daves).filter(([, info]) => isActiveDave(info))
	);
}

// --- save active users, cull idle users ---
setInterval(async () => { 
	const now = Date.now();
	let davesToCull = [];

	// Build a list of daves to cull
	for (const [id, info] of Object.entries(daves)) {
		if (!isActiveDave(info, now)) {
			//console.log("\tCULLED: " + info.userId);
			davesToCull.push(id);
		}
	}

	saveUsers(daves, savedPlaces);

	if (davesToCull.length > 0) {
		for (const id of davesToCull) {
			delete daves[id];
		}

		// Notify clients about the update
		io.emit("update");
	}
}, 60_000);  //save / cull once a minute

const MAX_BOTS = 80;
const DAVE_TANGENT_SPAWN_CHANCE = 0.025;

function randomSpawn() {
	const nBots = Object.keys(Object.fromEntries(
		Object.entries(daves).filter(([id, user]) => user.isBot)
	)).length;
	//console.log(nBots + " bots");
	if (nBots >= MAX_BOTS) {
		return;
	}

	const realUsers = Object.fromEntries(
		Object.entries(daves).filter(([id, user]) => !user.isBot && user.visible !== false)
	);

	const keys = Object.keys(realUsers);
	const chance = 0.05 * keys.length;
	if (Math.random() < chance) {
		const randomDave = keys[Math.floor(Math.random() * keys.length)];
		const shouldSpawnDaveTangent = !hasDaveTangent(daves) && Math.random() < DAVE_TANGENT_SPAWN_CHANCE;
		const bot = spawnBot(daves[randomDave], {
			name: shouldSpawnDaveTangent ? DAVE_TANGENT_NAME : undefined
		});
		//console.log("spawn: " + randomDave + " => " + bot.userId);
		daves[bot.userId] = bot;

		io.emit("update");
	} 
}

setInterval(randomSpawn, 10_000);

setInterval(() => {
	const bots = Object.fromEntries(
		Object.entries(daves).filter(([id, user]) => user.isBot)
	);

	updateBots(bots);
	io.emit("update");
}, 1000); // 1 second

const globalLog = [];
const DOD_REWARD_ITEMS = Object.freeze({
	taco: "🌮",
	hotdog: "🌭",
	drink: "🍺"
});
const BABY_ITEM = "👶";
const BABY_LOSS_DRINK_CHANCE = 0.2;

const DOD_REWARD_LABELS = Object.freeze({
	[DOD_REWARD_ITEMS.taco]: "Taco",
	[DOD_REWARD_ITEMS.hotdog]: "Hotdog",
	[DOD_REWARD_ITEMS.drink]: "Drink"
});

function logEvent(message, options = {}) {
	const entry = {
		id: crypto.randomUUID(),
		message,
		timestamp: Date.now(),

		// optional metadata
		type: options.type || "system",
		userId: options.userId || null,
		placeId: options.placeId || null,
	};

	globalLog.unshift(entry);

	// cap size so it doesn't grow forever
	const MAX_LOG_ENTRIES = 50;

	if (globalLog.length > MAX_LOG_ENTRIES) {
		globalLog.length = MAX_LOG_ENTRIES;
	}

	// broadcast to all connected clients
	io.emit("logEvent", entry);

	postImportantLogToDiscord(entry, options).catch((error) => {
		console.error("Discord webhook error:", error);
	});

	return entry;
}

function addItemReward(dave, item, count = 1) {
	if (!dave[item]) {
		dave[item] = { count: 0, lastTime: Date.now() };
	}

	dave[item].count += count;
	dave[item].lastTime = Date.now();

	if (item === DOD_REWARD_ITEMS.drink) {
		for (let index = 0; index < count; index += 1) {
			maybeLoseBabyAfterDrink(dave);
		}
	}
}

function maybeLoseBabyAfterDrink(dave, random = Math.random) {
	if (state.getAmt(dave, BABY_ITEM) < 1 || random() >= BABY_LOSS_DRINK_CHANCE) {
		return false;
	}

	dave[BABY_ITEM].count -= 1;
	dave.babiesLost = (dave.babiesLost ?? 0) + 1;
	logEvent(`Where's your baby, ${dave.name}?`, {
		userId: dave.userId
	});
	return true;
}

function getDodApplicationRewards(application) {
	const rewards = [];
	const signalEvents = Array.isArray(application.signalEvents) ? application.signalEvents : [];

	if (signalEvents.includes("Unscheduled taco acquisition")) {
		rewards.push(DOD_REWARD_ITEMS.taco);
	}

	if (application.operationalAptitude === "Wait for backup") {
		rewards.push(DOD_REWARD_ITEMS.drink);
	}

	if (application.operationalAptitude === "Follow the strongest ping") {
		rewards.push(DOD_REWARD_ITEMS.taco);
	}

	if (application.borrowedBadge === "Quietly issue them a temporary Dave badge made of tape") {
		rewards.push(DOD_REWARD_ITEMS.hotdog);
	}

	if (application.fieldEquipment === "Two radios tuned to different futures") {
		rewards.push(DOD_REWARD_ITEMS.drink);
	}

	if (application.fieldEquipment === "Approved flashlight, unapproved batteries") {
		rewards.push(DOD_REWARD_ITEMS.hotdog);
	}

	if (application.dailyHotDogs === "> 7") {
		rewards.push(DOD_REWARD_ITEMS.hotdog);
	}

	if (application.reflectionPaperwork === "The reflection has been reassigned") {
		rewards.push(DOD_REWARD_ITEMS.taco);
	}

	return rewards.reduce((summary, item) => {
		summary[item] = (summary[item] ?? 0) + 1;
		return summary;
	}, {});
}

function formatItemRewards(rewards) {
	return Object.entries(rewards)
		.map(([item, count]) => `${count} ${DOD_REWARD_LABELS[item] ?? "Item"}${count === 1 ? "" : "s"}`)
		.join(", ");
}

function awardDodCommendations(dave, points, reason, options = {}) {
	const result = addCommendations(dave, points);
	if (!result.awarded) {
		return result;
	}

	/*
	logEvent(`${dave.name} received ${points} DoD commendation${points === 1 ? "" : "s"} for ${reason}.`, {
		userId: dave.userId,
		...options
	});
	*/

	if (result.promoted) {
		logEvent(`${dave.name} was promoted to General by the Department of Davefence.`, {
			userId: dave.userId,
			important: true,
			...options
		});
	}

	return result;
}


// --- dave details ---
app.get('/api/dave', (req, res) => {
	const { id, viewerId } = req.query;
	const localDaves = getUsers(daves);
	const dave = localDaves[id]; 
	const me = localDaves[viewerId]; 

	//console.log("api daves: " + JSON.stringify(localDaves, null, 2));

	if (!dave || !me) {
		return res.status(404).json({ error: "Dave's not here" });
	}

	let result = getInteraction(me, dave, localDaves, savedPlaces);
	result.availableActions.nearestPlace = places.getNearestPlaceInRange(me, savedPlaces);
	result.availableActions.tooNear = places.isTooNear(me, savedPlaces);
	result.isDebugUser = isDebugId(viewerId);
	res.json(result);
});

function requireDebugUser(req, res) {
	const { userId } = req.body ?? {};
	if (!isDebugId(userId)) {
		res.status(403).json({ ok: false, error: "debug user required" });
		return null;
	}
	return userId;
}

function applyLoadedDave(existingDave, loadedDave) {
	const liveSockets = existingDave.sockets instanceof Set ? existingDave.sockets : null;

	for (const key of Object.keys(existingDave)) {
		delete existingDave[key];
	}

	Object.assign(existingDave, loadedDave);

	if (liveSockets) {
		existingDave.sockets = liveSockets;
		markActive(existingDave);
	}
}

function replaceLiveDaves(loadedDaves) {
	const loadedIds = new Set(Object.keys(loadedDaves));

	for (const id of Object.keys(daves)) {
		if (!loadedIds.has(id)) {
			delete daves[id];
		}
	}

	for (const [id, loadedDave] of Object.entries(loadedDaves)) {
		if (daves[id]) {
			applyLoadedDave(daves[id], loadedDave);
		} else {
			daves[id] = loadedDave;
		}
	}
}

function replaceLivePlaces(loadedPlaces) {
	for (const id of Object.keys(savedPlaces)) {
		delete savedPlaces[id];
	}
	Object.assign(savedPlaces, loadedPlaces);
}

function getOrCreateDave(userId) {
	if (!userId) {
		return null;
	}

	const localDaves = getUsers(daves);
	let dave = daves[userId] || localDaves[userId];
	let created = false;

	if (!dave) {
		dave = {
			userId,
			name: "Dave",
			state: state.getDefaultState(),
			infectedUsers: [],
			infectedBy: [],
			fragmentsCollected: [],
			tags: []
		};
		created = true;
	}

	daves[userId] = dave;
	if (created || !Number.isFinite(dave.updatedAt)) {
		markActive(dave);
	}
	return dave;
}

function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateUsersPayload(users) {
	if (!isPlainObject(users)) {
		return "users must be a JSON object";
	}

	for (const [id, user] of Object.entries(users)) {
		if (!isPlainObject(user)) {
			return `user ${id} must be an object`;
		}
		if (!user.userId) {
			return `user ${id} must include userId`;
		}
		if (user.userId !== id) {
			return `user ${id} has mismatched userId`;
		}
	}

	return null;
}

app.post('/api/admin/save-users', async (req, res) => {
	const userId = requireDebugUser(req, res);
	if (!userId) return;

	const changed = await saveUsers(daves, savedPlaces);
	res.json({ ok: true, changed });
});

app.post('/api/admin/load-users', async (req, res) => {
	const userId = requireDebugUser(req, res);
	if (!userId) return;

	const loadedDaves = await loadUsers();
	const loadedPlaces = getPlaces();

	replaceLiveDaves(loadedDaves);
	replaceLivePlaces(loadedPlaces);

	savedDaves = loadedDaves;
	io.emit("update");
	res.json({ ok: true });
});

app.post('/api/admin/update-users', async (req, res) => {
	const userId = requireDebugUser(req, res);
	if (!userId) return;

	const users = req.body?.users;
	const validationError = validateUsersPayload(users);
	if (validationError) {
		return res.status(400).json({ ok: false, error: validationError });
	}

	replaceLiveDaves(users);
	const changed = await replaceSavedData(users, savedPlaces);
	savedDaves = getUsers({});
	io.emit("update");
	res.json({ ok: true, changed });
});

app.post('/api/admin/update-places', async (req, res) => {
	const userId = requireDebugUser(req, res);
	if (!userId) return;

	const placesPayload = req.body?.places;
	if (!isPlainObject(placesPayload)) {
		return res.status(400).json({ ok: false, error: "places must be a JSON object" });
	}

	replaceLivePlaces(placesPayload);
	const changed = await replaceSavedData(getUsers({}), savedPlaces);
	io.emit("update");
	res.json({ ok: true, changed });
});

app.post('/api/admin/reset-cooldowns', async (req, res) => {
	const userId = requireDebugUser(req, res);
	if (!userId) return;

	const users = getUsers(daves);
	const resetCount = resetAllCooldowns(users);
	const changed = await saveUsers(daves, savedPlaces);
	io.emit("update");
	res.json({ ok: true, resetCount, changed });
});

app.post('/api/admin/remove-player', async (req, res) => {
	const userId = requireDebugUser(req, res);
	if (!userId) return;

	const { targetId } = req.body ?? {};
	if (!targetId) {
		return res.status(400).json({ ok: false, error: "targetId is required" });
	}
	if (targetId === userId) {
		return res.status(400).json({ ok: false, error: "admins cannot remove themselves" });
	}

	const target = daves[targetId];
	if (!target) {
		return res.status(404).json({ ok: false, error: "player is not active" });
	}

	delete daves[targetId];
	io.emit("update");
	res.json({ ok: true, removed: targetId });
});

app.post('/api/link-dave', async (req, res) => {
	const { sourceId, targetId } = req.body ?? {};
	const localDaves = getUsers(daves);
	let source = daves[sourceId] || localDaves[sourceId];
	const target = localDaves[targetId];

	if (!sourceId || !targetId) {
		return res.status(400).json({ ok: false, error: "sourceId and targetId are required" });
	}

	if (!target) {
		return res.status(404).json({ ok: false, error: "target dave not found" });
	}

	if (!source) {
		source = {
			userId: sourceId,
			name: "Dave",
			state: state.getDefaultState(),
			infectedUsers: [],
			infectedBy: [],
			fragmentsCollected: [],
			tags: [],
			linkedDaves: []
		};
		daves[sourceId] = source;
	}

	if (sourceId === targetId) {
		return res.json({ ok: true, linked: false, reason: "self" });
	}

	if (!Array.isArray(source.linkedDaves)) {
		source.linkedDaves = [];
	}

	if (!source.linkedDaves.includes(targetId)) {
		source.linkedDaves.push(targetId);
		const recoveredFragment = getFragmentFrom(source, target);
		const gainedDavePrimeScanState = state.grantDavePrimeScanBonus(source, target);
		markActive(source);

		logEvent(`${source.name} linked with ${target.name}.`, {
			userId: source.userId
		});
		if (gainedDavePrimeScanState) {
			logEvent(`${source.name} gained state from scanning ${target.name}'s DavePrime QR code.`, {
				userId: source.userId
			});
		}
		awardDodCommendations(source, 1, "linking a new Dave");

		io.emit("update");
		return res.json({ ok: true, linked: true, recoveredFragment, gainedDavePrimeScanState, target: summarizeDave(target, savedPlaces) });
	}

	res.json({ ok: true, linked: false, reason: "already-linked", target: summarizeDave(target, savedPlaces) });
});

// --- leaderboard ---
app.get("/api/leaderboard", (req, res) => {
	const { viewerId } = req.query;
	const localDaves = getUsers(daves);
	const viewer = localDaves[viewerId];
	const linkedDaves = Array.isArray(viewer?.linkedDaves) ? viewer.linkedDaves : [];

	const canCheckRange = (target) =>
		viewer &&
		target &&
		target.userId !== viewer.userId &&
		Number.isFinite(viewer.lat) &&
		Number.isFinite(viewer.lng) &&
		Number.isFinite(target.lat) &&
		Number.isFinite(target.lng);

	const leaderboard = Object.entries(localDaves) 
		.filter(([id, user]) => !user.isBot)
		.map(([key, d], idx) => { 
			return {
				...summarizeDave(d, savedPlaces),
				inRange: canCheckRange(d) ? inRange(viewer, d) : false,
				linked: linkedDaves.includes(d.userId)
			};
		})
		.sort((a, b) => b.score - a.score)  
		.map((d, idx) => ({
			...d,
			rank: idx + 1,
		}));

	// SERVER-WIDE AGGREGATES
	const serverSummary = leaderboard.reduce(
		(acc, d) => {
			acc.totalVirus += d.teamVirus || 0;
			acc.totalAntivirus += d.teamAntivirus || 0;
			acc.totalDaveRaves += d.daveravesStarted || 0;
			return acc;
		},
		{ totalVirus: 0, totalAntivirus: 0, totalDaveRaves: 0 }
	);

	//console.log("leaderboard: " + JSON.stringify(leaderboard, null, 2));
	res.json({
		summary: serverSummary,
		leaderboard: leaderboard
	});
});

app.get('/api/logs', (req, res) => {
	res.json(globalLog);
});


// --- place details ---
app.get('/api/place', (req, res) => {
	const { id, viewerId } = req.query;
	const place = savedPlaces[id];
	const me = getOrCreateDave(viewerId);

	if (!place) {
		return res.status(404).json({ error: "Node unavailable" });
	}

	if (!me) {
		return res.status(400).json({ error: "viewerId is required" });
	}

	res.json({
		place: places.getInteraction(me, place),
		dave: me,
		isDebugUser: isDebugId(viewerId)
	});
});

app.post("/api/places/:id/deconstruct", express.json(), (req, res) => {
	const placeId = req.params.id;
	const userId = req.body.userId;
	const place = savedPlaces[placeId];
	const localDaves = getUsers(daves);
	const dave = daves[userId] || localDaves[userId];

	if (!place) {
		return res.status(404).json({ ok: false, error: "place not found" });
	}

	if (!dave) {
		return res.status(404).json({ ok: false, error: "dave not found" });
	}

	if (place.owner !== userId) {
		return res.status(403).json({ ok: false, error: "only the node owner can deconstruct it" });
	}

	const placeName = place.name;
	const daveName = dave.name;
	const fragmentCount = Math.max(0, Number(place.level ?? 0) - 1);

	if (!Array.isArray(dave.fragmentsCollected)) {
		dave.fragmentsCollected = [];
	}

	for (let i = 0; i < fragmentCount; i++) {
		dave.fragmentsCollected.push(crypto.randomUUID());
	}

	delete savedPlaces[placeId];
	state.syncTerritoryRank(dave, savedPlaces);

	logEvent(fragmentCount > 0
		? `${daveName} deconstructed ${placeName} and recovered ${fragmentCount} fragments.`
		: `${daveName} deconstructed ${placeName}.`, {
		userId: dave.userId,
		placeId,
		important: true
	});

	io.emit("update");

	res.json({ ok: true, fragmentsRecovered: fragmentCount });
});

app.get('/api/places', (req, res) => {
	const localDaves = getUsers(daves);

	const enriched = Object.entries(savedPlaces).map(([placeId, place]) => {
		const ownerId = place.owner;

		return {
			id: placeId,
			...place,
			owner: ownerId
				? (localDaves[ownerId]?.name || 'Some Dave')
				: null
		};
	});

	enriched.sort((a, b) => Number(b.level) - Number(a.level));

	res.json(enriched);
});

//  --- daves and places ---
app.get('/api/data', (req, res) => {
	res.json( {
		daves: getActiveDaves(), 
		places: savedPlaces 
	});
});

app.post('/api/teleport', async (req, res) => {
	const { source, targetId, targetType, freeRoam = true } = req.body;

	const localDaves = getUsers(daves);
	const me = localDaves[source];
	const allowed = state.isDavePrime(me) || isDebugId(source);

	if (allowed) {
		let target = {}	
		if (targetType == "coords") {
			target = { 
				lat: req.body.lat, 
				lng: req.body.lng,
			};
		} else {
			 target = targetType == "place" ? savedPlaces[targetId] : localDaves[targetId];
			//console.log(target + " from " + targetType + " and " + targetId);
		}	
		if (!me || !target) {
			return res.sendStatus(404);
		}

		me.lat = target.lat;
		me.lng = target.lng;
		me.freeRoam = !!freeRoam;
		markActive(me);

		notifyUser(me, "teleport", { lat: me.lat, lng: me.lng, freeRoam: me.freeRoam });
		io.emit("update", { daves });

		res.json({ ok: true, lat: me.lat, lng: me.lng, freeRoam: me.freeRoam });
	} else {
		return res.sendStatus(403);
	}

});

app.post('/api/visibility', async (req, res) => {
	const { userId, visible } = req.body ?? {};
	const me = daves[userId];

	if (!me) {
		return res.status(404).json({ ok: false, error: "Dave's not here" });
	}

	me.visible = visible !== false;
	if (!me.visible) {
		me.lat = 0;
		me.lng = 0;
	}
	markActive(me);

	io.emit("update");

	res.json({ ok: true, visible: me.visible, lat: me.lat, lng: me.lng });
});



// --- Socket.io handlers ---
io.on('connection', (socket) => {
	const userId = socket.handshake.auth.userId;
	socket.userId = userId;
	//console.log("new connection: " + socket.id + " => " + userId);
	//console.log("saved Daves: " + JSON.stringify(savedDaves, null, 2));

	// load from savedDaves or initialize if new
	let me = daves[userId];
	let createdDave = false;
	if (!me) {  //not in current session
		savedDaves = getUsers(daves);
		if (savedDaves[userId]) {  //but recognized
			//console.log("recognized");
			//retrieve dave from storage
			me = savedDaves[userId];
			//put dave in active in-memory list
			daves[userId] = me;
		} else {  // or new Dave, needs to be initialized
			//console.log("new dave: " + userId);
			 me = {
				userId: userId,
				name: "Dave",
				state: state.getDefaultState(),
				infectedUsers: [],
				infectedBy: [],
				fragmentsCollected: [],
				tags: [],
			};
			createdDave = true;
			daves[userId] = me;
		}
	}
	
	if (createdDave || !Number.isFinite(me.updatedAt)) {
		markActive(me);
	}
	if (!me.sockets || Object.keys(me.sockets).length === 0) {
		me.sockets = new Set();
	} 
	me.sockets.add(socket);

	//console.log("registered: " + JSON.stringify(daves, null, 2));

	//check for immune flag on main page (redirected from bb)
	socket.on("register", (data) => {
		const me = daves[socket.userId];
		if (me) {
			markActive(me);
		}

		const ts = data.immune;
		if (ts) {
			//console.log("register with ts: _" + ts + "_");
			try {
				const decoded = Buffer.from(ts.trim(), 'base64').toString('utf-8');
				const targetTimestamp = parseInt(decoded, 10);
				const difference = Math.abs(Date.now() - targetTimestamp);

				if (difference <= 20 * 1000) {
					//console.log("INSTALL");
					state.installAntivirus(daves[socket.userId]);
					markActive(daves[socket.userId]);
					logEvent(`${daves[socket.userId].name} installed mind antivirus.`, {
						userId: socket.userId
					});
				}
			} catch (error) { //ignore
				console.error("Error decoding base64:", error);
			}
		}
		//console.log("update on register: " + JSON.stringify(daves, null, 2));
		io.emit("update");
	});	

	socket.on("logEvent", (message, options = {}) => {
		if (typeof message !== "string" || !message.trim()) {
			return;
		}

		logEvent(message.trim(), {
			...options,
			userId: socket.userId
		});
	});

	socket.on("lineconBump", (sourceId, placeId = null, bestStreak = 0, callback = () => {}) => {
		if (typeof bestStreak === "function") {
			callback = bestStreak;
			bestStreak = 0;
		}
		if (sourceId !== socket.userId) {
			callback({ ok: false, error: "source mismatch" });
			return;
		}

		const me = daves[socket.userId];
		if (!me) {
			callback({ ok: false, error: "Dave's not here" });
			return;
		}

		const result = applyLineconBump(me, bestStreak);
		markActive(me);
		callback({ ok: true, ...result, placeId });
	});

	socket.on('disconnect', () => {
		const dave = daves[socket.userId];
		if (dave) {
			dave.sockets.delete(socket);
		}
	});
	
	socket.on('location', (loc) => {
		if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;

		// Save/update this user's location
		const me = daves[socket.userId];
		if (me) {
			if (me.freeRoam) {
				return;
			}

			if (applyLocationActivity(me, loc)) {
				io.emit("update");
			}
		} 

		//console.log("location update: " + JSON.stringify(daves, null, 2));
	});

	socket.on('setId', (name) => {
		const dave = daves[socket.userId];
		if (dave) {
			const oldName = dave.name;
			dave.name = name;
			markActive(dave);
			logEvent(`${oldName} is now known as ${dave.name}.`, {
				userId: dave.userId
			});
			io.emit("update");
		}
	});

	socket.on("installAntivirus", (sourceId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];

		if (!me) return;
		state.installAntivirus(me);
		markActive(me);
		logEvent(`${me.name} installed mind antivirus.`, {
			userId: me.userId
		});
	})

	socket.on("spawnCluster", (sourceId, count = 10) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		//console.log(`[SPAWN]  ` + JSON.stringify(daves, null, 2));
		if (!me || !state.isDavePrime(me) || me.visible === false) {
			return;
		}

		count = Number.isInteger(count) ? count : 10;
		count = Math.max(1, Math.min(count, 50));

		for (let i = 0; i < count; i++) {
			const bot = spawnBot(me);
			daves[bot.userId] = bot;
		}

		markActive(me);
		logEvent(`${me.name} spawned ${count} civilians.`, {
			userId: me.userId
		});
		io.emit("update");
	});

	socket.on("dodApply", (sourceId, placeId, application = {}) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const me = daves[socket.userId];
		const place = savedPlaces[placeId];
		const optionalText = (field, maxLength) => (
			typeof application[field] === "string" ? application[field].trim().slice(0, maxLength) : ""
		);

		if (!me || !place) {
			socket.emit("dodApplyResult", { ok: false, error: "Application context unavailable" });
			return;
		}

		if (me.dodLevel > 0 || me.dodApplication) {
			socket.emit("dodApplyResult", { ok: false, error: "Application already on file" });
			return;
		}

		if (application.oath !== true) {
			socket.emit("dodApplyResult", { ok: false, error: "Application incomplete" });
			return;
		}

		me.dodLevel = 1;
		me.dodApplication = {
			placeId,
			nodeName: place.name,
			operational: {
				nodeResponse: optionalText("nodeResponse", 320),
				operationalAptitude: optionalText("operationalAptitude", 120),
				borrowedBadge: optionalText("borrowedBadge", 160),
				fieldEquipment: optionalText("fieldEquipment", 160),
				dailyHotDogs: optionalText("dailyHotDogs", 20),
				chainOfCommand: optionalText("chainOfCommand", 160)
			},
			signalIntegrity: {
				signalEvents: Array.isArray(application.signalEvents)
					? application.signalEvents
						.filter((event) => typeof event === "string")
						.map((event) => event.trim().slice(0, 120))
						.filter(Boolean)
					: [],
				signalNoise: optionalText("signalNoise", 80),
				glitchSymptom: optionalText("glitchSymptom", 160),
				reflectionPaperwork: optionalText("reflectionPaperwork", 120)
			},
			voluntaryDisclosure: optionalText("voluntaryDisclosure", 80),
			submittedAt: Date.now()
		};
		state.addTag(me, "dod");
		markActive(me);

		const rewards = getDodApplicationRewards(application);
		for (const [item, count] of Object.entries(rewards)) {
			addItemReward(me, item, count);
		}

		logEvent(`${me.name} applied to the Department of Davefence.`, {
			userId: me.userId,
			placeId,
			important: true
		});

		const rewardMessage = formatItemRewards(rewards);
		if (rewardMessage) {
			logEvent(`${me.name} received DoD field provisions: ${rewardMessage}.`, {
				userId: me.userId,
				placeId
			});
		}

		socket.emit("dodApplyResult", { ok: true, rewards });
		io.emit("update");
	});

	socket.on("dodExchangeInfections", (sourceId) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const me = daves[socket.userId];
		if (!me || (me.dodLevel ?? 0) < 1) {
			socket.emit("dodExchangeResult", { ok: false, error: "DoD credentials required" });
			return;
		}

		if (!Array.isArray(me.infectedUsers) || me.infectedUsers.length < 5) {
			socket.emit("dodExchangeResult", { ok: false, error: "Insufficient infections for exchange" });
			return;
		}

		if (!Array.isArray(me.fragmentsCollected)) {
			me.fragmentsCollected = [];
		}

		me.infectedUsers.splice(0, 5);
		me.fragmentsCollected.push(crypto.randomUUID());
		markActive(me);

		logEvent(`${me.name} exchanged 5 infections for 1 fragment with the Department of Davefence.`, {
			userId: me.userId
		});
		awardDodCommendations(me, 1, "infection reclassification");

		socket.emit("dodExchangeResult", { ok: true });
		io.emit("update");
	});


	infect.registerHandlers(socket, daves, io, logEvent);
	stabilize.registerHandlers(socket, daves, savedPlaces, io, logEvent, awardDodCommendations);
	items.registerHandlers(socket, daves, io);
	places.registerHandlers(socket, daves, savedPlaces, io, logEvent, awardDodCommendations);
	raves.registerHandlers(socket, daves, io, logEvent, awardDodCommendations);
	ascension.registerHandlers(socket, daves, savedPlaces, io, logEvent);

	debug.registerHandlers(socket, daves, savedPlaces, io);
});
