const fs = require('fs');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();

// --- HTTP server ---
const server = http.createServer(app);

// --- Socket.io ---
const io = new Server(server);

// --- Static files ---
app.use(express.static('public'));

// --- In-memory user location store ---
// Structure: { socketId: { lat: Number, lon: Number, updatedAt: Number } }
let users = {};

// --- Helpers: Haversine distance ---
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineDistance(a, b) {
	const R = 6371000; // radius of Earth in meters
	const toRad = (deg) => (deg * Math.PI) / 180;

	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);

	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);

	const h =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);

	return 2 * R * Math.asin(Math.sqrt(h));
}


setInterval(() => {
	const cutoff = Date.now() - 2*60*1000;
	let changed = false;
	for (const [id, info] of Object.entries(users)) {
		if (!info || info.updatedAt < cutoff) {
			delete users[id];
			changed = true;
		}
	}
	if (changed) io.emit('totalUsers', Object.keys(users).length);
}, 30*1000);

// --- Socket.io handlers ---
io.on('connection', (socket) => {
	// Immediately broadcast total users
	io.emit('totalUsers', Object.keys(users).length);

	socket.on('location', (loc) => {
		if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;

		// Save/update this user's location
		users[socket.id] = { lat: loc.lat, lon: loc.lon, icon: loc.myId, updatedAt: Date.now() };

		const me = users[socket.id];

		// Build list of other Daves with distances relative to me
		const daves = Object.entries(users)
			.filter(([id, u]) => id !== socket.id && u.lat != null && u.lon != null)
			.map(([id, u]) => {
				const distance = haversineDistance(
					{ lat: me.lat, lon: me.lon },
					{ lat: u.lat, lon: u.lon }
				);
				return { id, icon: u.icon, lat: u.lat, lon: u.lon, distance };
			});

		socket.emit('update', {
			daves
		});

		// Broadcast total count to everyone
		io.emit('totalUsers', Object.keys(users).length);
	});

	socket.on('setId', (name) => {
		if (users[socket.id]) {
			users[socket.id].icon = name;
		}
	});

	socket.on('disconnect', () => {
		delete users[socket.id];
		io.emit('totalUsers', Object.keys(users).length);
	});
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`server running at http://localhost:${PORT}`);
});
