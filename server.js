import { saveUsers, loadUsers } from './utils/storage.js';
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
let daves = {};
let userSockets = {}

let savedDaves = await loadUsers();
setInterval(() => {
	saveUsers(daves);
}, 10000);


setInterval(() => {
	const cutoff = Date.now() - 2*60*1000;
	let changed = false;
	for (const [id, info] of Object.entries(daves)) {
		if (!info || info.updatedAt < cutoff) {
			delete daves[id];
			changed = true;
		}
	}
	if (changed) {
		io.emit("update", { daves });
	}
}, 30*1000);

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
				state: "UNSTABLE",
				infectedUsers: [],
				infectedBy: [],
				fragmentsCollected: [],
			};
		}

		daves[userId] = savedDaves[userId]
		daves[userId].lastSeen = Date.now();

		const ts = data.immune;
		if (ts) {
			const decoded = atob(ts);
			const targetTimestamp = parseInt(decoded, 10);
			const difference = Math.abs(Date.now() - targetTimestamp);

			if (difference <= 20 * 1000) {
				daves[userId].state = "IMMUNE";
			} 
		} 

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
		me.state = "PATCHED"

		socket.emit("patch");
	})

	socket.on("stabilize", () => {
		const me = daves[socket.userId];
		if (!me) return;

		const stabilizedTargets = stabilize(me, daves, userSockets, io);
		console.log("stabilized: " + JSON.stringify(stabilizedTargets, null, 2));

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
		const STATUSES = ["INFECTED", "IMMUNE", "UNSTABLE"];
		for (let i = 0; i < count; i++) {
			const id = "cluster-" + i + "-" + Date.now();

			daves[id] = {
				lat: centerLat + (Math.random() - 0.5) * 0.001,
				lon: centerLon + (Math.random() - 0.5) * 0.001,
				infectedUsers: [],
				infectedBy: [],
				icon: "DAVE",
				state: STATUSES[Math.floor(Math.random() * STATUSES.length)],
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
