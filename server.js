import { saveUsers, loadUsers, getUsers, getPlaces } from './utils/storage.js';
import * as state from "./public/utils/state.js";
import { isDebugId} from "./public/utils/id.js";  
import { inRange } from "./public/utils/distance.js";

import { notifyUser } from './utils/sockets.js';
import * as infect from './utils/infect.js';
import * as stabilize from './utils/stabilize.js';
import * as items from './utils/items.js';
import * as places from './utils/places.js';
import * as ascension from './utils/ascension.js';
import * as debug from './utils/debug.js';
import { spawnBot, updateBots } from "./utils/bots.js";
import { summarizeDave, getInteraction } from "./utils/players.js";


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
app.use(express.json()); 

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

let daves = savedDaves;  

// --- save active users, cull idle users ---
setInterval(async () => { 
	const cutoff = Date.now() - 15 * 60 * 1000; // 15 minutes
	const botCutoff = Date.now() - 2 * 60 * 1000; // 2 minutes
	let davesToCull = [];

	// Build a list of daves to cull
	for (const [id, info] of Object.entries(daves)) {
		if (!info || info.updatedAt < cutoff) {
			//console.log("\tCULLED: " + info.userId);
			davesToCull.push(id);
		} else {
			if (info.isBot && info.updatedAt < botCutoff) {
				//console.log("\tCULLED: " + info.userId);
				davesToCull.push(id);
			}
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

function randomSpawn() {
	const nBots = Object.keys(Object.fromEntries(
		Object.entries(daves).filter(([id, user]) => user.isBot)
	)).length;
	//console.log(nBots + " bots");
	if (nBots >= MAX_BOTS) {
		return;
	}

	const realUsers = Object.fromEntries(
		Object.entries(daves).filter(([id, user]) => !user.isBot)
	);

	const keys = Object.keys(realUsers);
	const chance = 0.05 * keys.length;
	if (Math.random() < chance) {
		const randomDave = keys[Math.floor(Math.random() * keys.length)];
		const bot = spawnBot(daves[randomDave]);
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

	return entry;
}

function addItemReward(dave, item, count = 1) {
	if (!dave[item]) {
		dave[item] = { count: 0, lastTime: Date.now() };
	}

	dave[item].count += count;
	dave[item].lastTime = Date.now();
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
	result.availableActions.tooNear = places.isTooNear(me, savedPlaces);
	res.json(result);
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
		source.updatedAt = Date.now();

		logEvent(`${source.name} linked with ${target.name}.`, {
			userId: source.userId
		});

		await saveUsers(daves, savedPlaces);
		io.emit("update");
		return res.json({ ok: true, linked: true, target: summarizeDave(target, savedPlaces) });
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
			return acc;
		},
		{ totalVirus: 0, totalAntivirus: 0 }
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
	const localDaves = getUsers(daves);
	const place = savedPlaces[id];
	const me = localDaves[viewerId]; 

	res.json({
		place: places.getInteraction(me, place),
		dave: me
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
		: `${daveName} deconstructed ${placeName}.`
	);

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
		daves: getUsers(daves), 
		places: savedPlaces 
	});
});

app.post('/api/teleport', (req, res) => {
	const { source, targetId, targetType, freeRoam = true } = req.body;

	//console.log("recv'd teleport call: " + JSON.stringify(req.body, null, 2));

	const localDaves = getUsers(daves);
	const me = localDaves[source];
	if (state.isDavePrime(me) || isDebugId(source)) {
		let target = {}	
		if (targetType == "coords") {
			target = { 
				lat: req.body.lat, 
				lng: req.body.lng,
			};
		} else {
			 target = targetType == "place" ? savedPlaces[targetId] : localDaves[targetId];
			//console.log(target + " from " + targetType + " and " + targetId);
			//console.log("recv'd teleport call: " + JSON.stringify(savedPlaces, null, 2));
		}	
		if (!me || !target) return res.sendStatus(404);

		me.lat = target.lat;
		me.lng = target.lng;
		me.freeRoam = !!freeRoam;
		//notifyUser(me, "teleport", { lat : dave.lat, lng : dave.lng, freeRoam : !!freeRoam });

		res.sendStatus(200);
	} else {
		return res.sendStatus(403);
	}

});



// --- Socket.io handlers ---
io.on('connection', (socket) => {
	const userId = socket.handshake.auth.userId;
	socket.userId = userId;
	//console.log("new connection: " + socket.id + " => " + userId);
	//console.log("saved Daves: " + JSON.stringify(savedDaves, null, 2));

	// load from savedDaves or initialize if new
	let me = daves[userId];
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
			daves[userId] = me;
			saveUsers(daves);
		}
	}
	
	me.updatedAt = Date.now();
	if (!me.sockets || Object.keys(me.sockets).length === 0) {
		me.sockets = new Set();
	} 
	me.sockets.add(socket);

	//console.log("registered: " + JSON.stringify(daves, null, 2));

	//check for immune flag on main page (redirected from bb)
	socket.on("register", (data) => {
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
			me.lat = loc.lat;
			me.lng = loc.lng;
			me.updatedAt = Date.now();

			io.emit("update");
		} 

		//console.log("location update: " + JSON.stringify(daves, null, 2));
	});

	socket.on('setId', (name) => {
		const dave = daves[socket.userId];
		if (dave) {
			const oldName = dave.name;
			dave.name = name;
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
		if (!me || !state.isDavePrime(me)) {
			return;
		}

		count = Number.isInteger(count) ? count : 10;
		count = Math.max(1, Math.min(count, 50));

		for (let i = 0; i < count; i++) {
			const bot = spawnBot(me);
			daves[bot.userId] = bot;
		}

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

		const rewards = getDodApplicationRewards(application);
		for (const [item, count] of Object.entries(rewards)) {
			addItemReward(me, item, count);
		}

		logEvent(`${me.name} applied to the Department of Davefence.`, {
			userId: me.userId,
			placeId
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

		logEvent(`${me.name} exchanged 5 infections for 1 fragment with the Department of Davefence.`, {
			userId: me.userId
		});

		socket.emit("dodExchangeResult", { ok: true });
		io.emit("update");
	});


	infect.registerHandlers(socket, daves, io, logEvent);
	stabilize.registerHandlers(socket, daves, savedPlaces, io, logEvent);
	items.registerHandlers(socket, daves, io);
	places.registerHandlers(socket, daves, savedPlaces, io, logEvent);
	ascension.registerHandlers(socket, daves, savedPlaces, io, logEvent);

	debug.registerHandlers(socket, daves, savedPlaces, io);
});
