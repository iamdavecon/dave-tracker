import * as state from "./public/utils/state.js";
import { saveUsers, loadUsers, getUsers } from './utils/storage.js';
import { infect } from './utils/infect.js';
import { stabilize } from './utils/stabilize.js';
import fs from 'fs';
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';


const app = express();

// --- HTTP server ---
const server = http.createServer(app);

// --- Socket.io ---
const io = new Server(server);

// --- Static files ---
app.use(express.static('public'));
app.use('/utils', express.static('utils'));

// --- In-memory user location store ---
let savedDaves = await loadUsers();
setInterval(() => {
	saveUsers(daves);
}, 10000);

//let daves = {};
let daves = savedDaves;
let userSockets = {}



// --- cull idle users ---
setInterval(() => {
	const cutoff = Date.now() - 2*60*1000;
	let changed = false;
	for (const [id, info] of Object.entries(daves)) {
		if (!info || info.updatedAt < cutoff) {
			console.log("\tCULLED: " + info.updatedAt);
			delete daves[id];
			changed = true;
		}
	}
	if (changed) {
		io.emit("update", { daves });
	}
}, 30*1000);


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
	const dave = getUsers(daves)[id]; 

	if (!dave) {
		return res.status(404).json({ error: "Dave's not here" });
	}

	let daveDetails = summarizeDave(dave);
	daveDetails.isMe = id === viewerId
	res.json(daveDetails);
});

// --- leaderboard ---
app.get("/api/leaderboard", (req, res) => {
	const leaderboard = Object.entries(getUsers(daves)) 
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
	let userId = null;

	socket.on("register", (data) => {
		userId = data.userId;
		userSockets[userId] = socket.id;
		//console.log("register: " + socket + " to " + userId);

		// initialize if new
		if (!savedDaves[userId]) {
			savedDaves[userId] = {
				userId: userId,
				state: state.getDefaultState(),
				infectedUsers: [],
				infectedBy: [],
				fragmentsCollected: [],
				tags: [],
			};
		}

		daves[userId] = savedDaves[userId]
		daves[userId].updatedAt = Date.now();

		const ts = data.immune;
		if (ts) {
			//console.log("register with ts: _" + ts + "_");
			try {
				const decoded = Buffer.from(ts.trim(), 'base64').toString('utf-8');
				const targetTimestamp = parseInt(decoded, 10);
				const difference = Math.abs(Date.now() - targetTimestamp);

				if (difference <= 20 * 1000) {
					state.installAntivirus(daves[userId]);
				}
			} catch (error) { //ignore
				console.error("Error decoding base64:", error);
			}
			 
		} 

		console.log("registered: " + JSON.stringify(daves, null, 2));

		socket.userId = userId;
		io.emit("update", { daves });
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
		if (daves[socket.userId]) {
			daves[socket.userId].icon = name;
		}
		io.emit("update", { daves });
	});

	socket.on('disconnect', () => {
		delete daves[socket.userId];
		io.emit("update", { daves });
	});

	socket.on("infect", () => {
		const me = daves[socket.userId];
		if (!me) return;

		const infectedTargets = infect(me, daves, userSockets, io);
		//console.log("infected: " + JSON.stringify(infectedTargets, null, 2));

		// tell sender who they infected
		socket.emit("infectResult", {
			infectedTargets
		});

		io.emit("update", { daves });
	});

	socket.on("installAntivirus", () => {
		const me = daves[socket.userId];
		if (!me) return;
		state.installAntivirus(me);

		socket.emit("patch");
	})

	socket.on("stabilize", () => {
		const me = daves[socket.userId];
		if (!me) return;

		const stabilizedTargets = stabilize(me, daves, userSockets, io);

		// tell sender who they stabilized
		socket.emit("stabilizeResult", {
			stabilizedTargets 
		});

		io.emit("update", { daves });
	});

	socket.on("spawnCluster", (count = 5) => {
		console.log(`[SPAWN]  ` + JSON.stringify(daves, null, 2));
		const me = daves[socket.userId];
		if (!me) return;

		const centerLat = me.lat;
		const centerLon = me.lon;
		for (let i = 0; i < count; i++) {
			const id = "cluster-" + i + "-" + Date.now();
			const botState = state.getRandomState();
			//const botState = 0;

			daves[id] = {
				lat: centerLat + (Math.random() - 0.5) * 0.01,
				lon: centerLon + (Math.random() - 0.5) * 0.01,
				infectedUsers: [],
				infectedBy: [],
				icon: "DAVE_BOT",
				state: botState,
				updatedAt: Date.now()
			};
		}

		io.emit("update", { daves });
	});
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`server running at http://localhost:${PORT}`);
});
