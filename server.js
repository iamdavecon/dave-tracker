import { haversineDistance } from './public/utils/distance.js';
import fs from 'fs';
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';

const DATA_FILE = "./users.json";

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
let persistentUsers = {}
let userSockets = {}

if (fs.existsSync(DATA_FILE)) {
	persistentUsers = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
	console.log("reading: " + JSON.stringify(persistentUsers, null, 2));
}
function saveUsers() {
	// start with a shallow copy of persisted users
	const merged = { ...persistentUsers };

	// add active daves
	for (const [id, info] of Object.entries(daves)) {
		if (!info.userId) continue;
		//console.log("\tmerge: " + JSON.stringify(info, null, 2))
		merged[id] = info;
	}

	fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
	persistentUsers = merged;

	console.log(`[SAVE]  wrote ` + JSON.stringify(merged, null, 2));
}

//setInterval(saveUsers, 10000);
//setInterval(saveUsers, 5000);


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
		console.log("register: " + socket + " to " + userId);

		// initialize if new
		if (!persistentUsers[userId]) {
			persistentUsers[userId] = {
				state: "UNSTABLE",
				infectedUsers: [],
				infectedBy: [],
			};
		}

		daves[userId] = persistentUsers[userId]
		daves[userId].lastSeen = Date.now();

		socket.userId = userId;
		console.log("client registered:", socket.userId);
		io.emit("update", { daves });

		console.log(`[R]  ` + JSON.stringify(daves, null, 2));
	});	
	
	socket.on('location', (loc) => {
		if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;
		console.log(`update loc ` + JSON.stringify(loc, null, 2));


		// Save/update this user's location
		const me = daves[socket.userId];
		if (me) {
			console.log(`update with me ` + JSON.stringify(me, null, 2));
			me.lat = loc.lat;
			me.lon = loc.lon;
			me.updatedAt = Date.now();

			io.emit("update", { daves });
		} else {
			console.log(`update missing me `);
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

	socket.on("infectNearby", () => {
		const me = daves[socket.userId];
		if (!me) return;

		const INFECT_RADIUS = 50; // meters 

		let infectedTargets = [];

		for (const [id, u] of Object.entries(daves)) {
			if (id === socket.userId) continue;
			if (!u.lat || !u.lon) continue;

			const dist = haversineDistance(
				{ lat: me.lat, lon: me.lon },
				{ lat: u.lat, lon: u.lon }
			);

			// Only infect non-immune daves
			if (dist <= INFECT_RADIUS && u.state !== "IMMUNE" && u.state !== "PATCHED") {
				console.log("infecting " + id);

				//infector
				if (me.infectedUsers && !me.infectedUsers.includes(id)) {
					me.infectedUsers.push(id);
				}
				infectedTargets.push(id);

				//infectee
				u.state = "INFECTED";
				if (u.infectedBy && !u.infectedBy.includes(me.userId)) {
					u.infectedBy.push(me.userId)
				}
				const targetSocket = userSockets[id];
				if (targetSocket) {
					io.to(targetSocket).emit("notifyInfected", { by: socket.userId });
				}
			}
		}

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

		socket.emit("updateState", {
			state: "PATCHED"
		});
	})

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
