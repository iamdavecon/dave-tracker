import { saveUsers, loadUsers, getUsers } from './utils/storage.js';
import * as state from "./public/utils/state.js";
import { inRange } from "./public/utils/distance.js";

import * as infect from './utils/infect.js';
import * as stabilize from './utils/stabilize.js';
import { spawnBot } from "./utils/bots.js";


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

export function getApp() {
	return app;
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`server running at http://localhost:${PORT}`);
});


// --- In-memory user location store ---
let savedDaves = await loadUsers();

//let daves = {};
let daves = savedDaves;  //for debugging - show saved daves in addition to active sessions

// --- save active users, cull idle users ---
setInterval(async () => { 
	const cutoff = Date.now() - 20 * 60 * 1000; // 20 minutes
	let davesToCull = [];

	// Build a list of daves to cull
	for (const [id, info] of Object.entries(daves)) {
		if (!info || info.updatedAt < cutoff) {
			console.log("\tCULLED: " + info.userId);
			davesToCull.push(id);
		}
	}

	saveUsers(daves);

	if (davesToCull.length > 0) {
		for (const id of davesToCull) {
			delete daves[id];
		}

		// Notify clients about the update
		io.emit("update", { daves });
	}
}, 30_000);



function randomSpawn() {
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

		io.emit("update", { daves });
	} else {
		console.log("skip");
	}
}

setInterval(randomSpawn, 45_000);


function summarizeDave(dave) {
	let score = 0;
	let teamVirus = 0;
	let teamAntivirus = 0;

	if (dave.infectedUsers) {
		teamVirus += dave.infectedUsers.length; 
	}
	if (dave.fragmentsCollected) {
		teamAntivirus += dave.fragmentsCollected.length
	}
	score = teamVirus + (teamAntivirus * 2)

	return {
		name: dave.icon,  
		score: score,
		teamVirus: teamVirus,
		teamAntivirus: teamAntivirus,
		state: state.getState(dave).toUpperCase()
	};

}

// --- dave details ---
app.get('/api/dave', (req, res) => {
	const { id, viewerId } = req.query;
	const localDaves = getUsers(daves);
	const dave = localDaves[id]; 
	const me = localDaves[viewerId]; 

	/*
	console.log("api daves: " + JSON.stringify(localDaves, null, 2));
	console.log("dave: " + JSON.stringify(dave, null, 2) + " from " + id);
	console.log("me: " + JSON.stringify(me, null, 2) + " from " + viewerId);
	*/

	if (!dave || !me) {
		return res.status(404).json({ error: "Dave's not here" });
	}

	let daveDetails = summarizeDave(dave);
	daveDetails.isMe = id === viewerId
	daveDetails.availableActions = state.getActions(me, dave);

	daveDetails.targetLat = dave.lat;
	daveDetails.targetLon = dave.lon;

	daveDetails.viewerLat = me.lat;
	daveDetails.viewerLon = me.lon;

	daveDetails.inRange = inRange(me, dave);

	res.json(daveDetails);
});

// --- leaderboard ---
app.get("/api/leaderboard", (req, res) => {
	const leaderboard = Object.entries(getUsers(daves)) 
		.filter(([id, user]) => !user.isBot)
		.map(([key, d], idx) => { 
			return summarizeDave(d);
		})
		.sort((a, b) => b.score - a.score)  
		.map((d, idx) => ({
			rank: idx + 1,
			name: d.name,
			score: d.score,
			teamVirus: d.teamVirus,
			teamAntivirus: d.teamAntivirus,
			state: d.state
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

	const sorted = leaderboard
		.sort((a, b) => b.score - a.score)
		.map((d, idx) => ({
			rank: idx + 1,
			name: d.name,
			score: d.score,
			state: d.state,
			teamVirus: d.teamVirus,
			teamAntivirus: d.teamAntivirus
		}));

	res.json({
		summary: serverSummary,
		leaderboard: sorted
	});
});

// --- Socket.io handlers ---
io.on('connection', (socket) => {
	const userId = socket.handshake.auth.userId;
	socket.userId = userId;
	/*
	console.log("new connection: " + socket.id + " => " + userId);
	console.log("saved Daves: " + JSON.stringify(savedDaves, null, 2));
	*/

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
	if (!me.sockets) {
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
					console.log("INSTALL");
					state.installAntivirus(daves[socket.userId]);
				}
			} catch (error) { //ignore
				console.error("Error decoding base64:", error);
			}
		}
		//console.log("update on register: " + JSON.stringify(daves, null, 2));
		io.emit("update", { daves });
	});	

	socket.on('disconnect', () => {
		const dave = daves[socket.userId];
		if (dave) {
			dave.sockets.delete(socket);
		}
	});
	
	socket.on('location', (loc) => {
		if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;

		// Save/update this user's location
		const me = daves[socket.userId];
		if (me) {
			me.lat = loc.lat;
			me.lon = loc.lon;
			me.updatedAt = Date.now();

			io.emit("update", { daves });
		} 

		//console.log("location update: " + JSON.stringify(daves, null, 2));
	});

	socket.on('setId', (name) => {
		const dave = daves[socket.userId];
		if (dave) {
			dave.icon = name;
			io.emit("update", { daves });
		}
	});

	socket.on("installAntivirus", (sourceId) => {
		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];

		if (!me) return;
		state.installAntivirus(me);
	})

	socket.on("spawnCluster", (sourceId, count = 10) => {
		const localDaves = getUsers(daves);
		const me = localDaves[sourceId];
		console.log(`[SPAWN]  ` + JSON.stringify(daves, null, 2));
		if (!me) {
			console.log("MISSING: " + socket.userId);
			return;
		}

		for (let i = 0; i < count; i++) {
			const bot = spawnBot(me);
			daves[bot.userId] = bot;
		}

		io.emit("update", { daves });
	});

	infect.registerHandlers(socket, daves, io);
	stabilize.registerHandlers(socket, daves, io);
});


