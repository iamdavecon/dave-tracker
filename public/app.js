import { getUserId } from './utils/id.js';
import { haversineDistance } from './utils/distance.js';
import { addStateUI } from './utils/stateUI.js';
import { addPlayer, cullNotSeen } from './utils/playersUI.js';
import { addPlace } from './utils/placesUI.js';

const userId = getUserId();
const socket = io({
    auth: {
        userId: userId
    }
});

let me = {}
let centerOn = true;
let lastRender = 0;
const MIN_INTERVAL = 250;
let init = true;

const params = new URLSearchParams(window.location.search);
const immune = params.get('immune');

socket.emit("register", { userId, immune });

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById('userId').textContent = userId;
});

document.getElementById('setIdBtn').addEventListener('click', () => {
	const userName = document.getElementById('userName').value.trim();
	//console.log("=> " + userName);
	if (userName) {
		socket.emit('setId', userName); 
		update();
	}
});

const leaderboard = document.getElementById("leaderboardLink");
leaderboard.href = `/leaderboard.html?userId=${encodeURIComponent(userId)}`;


function logEvent(message) {
	const logList = document.getElementById("logList");

	const li = document.createElement("li");

	const timestamp = new Date().toLocaleTimeString();

	li.textContent = `[${timestamp}] ${message}`;

	logList.prepend(li);

	const maxLogs = 10;
	while (logList.children.length > maxLogs) {
		logList.removeChild(logList.lastChild);
	}
}


// --- Leaflet map setup ---
let map = L.map('map').setView([0, 0], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

map.on("dragstart", () => {
	centerOn = false;
});


document.getElementById("centerMe").onclick = () => {
	//console.log("CENTER ME: " + me.lat + ", " + me.lng);
	centerOn = true;
	map.flyTo([me.lat, me.lng], 16);
};

const canonicalLayer = L.layerGroup().addTo(map);

function renderPlaces(places) {
	//console.log("render places: " + JSON.stringify(me, null, 2));
	//console.log(JSON.stringify(places, null, 2));

	const totalEl = document.getElementById('totalNodes');
	totalEl.textContent = Object.keys(places).length

	canonicalLayer.clearLayers();

	const zoom = map.getZoom();


	const nodeDistanceList = document.getElementById("nodeDistanceList");
	nodeDistanceList.innerHTML = "";

	let i = 0;
	Object.entries(places)  
		.sort(([, a], [, b]) => {
			const distanceA = haversineDistance(
				{ lat: me.lat, lng: me.lng },
				{ lat: a.lat, lng: a.lng }
			);
			const distanceB = haversineDistance(
				{ lat: me.lat, lng: me.lng },
				{ lat: b.lat, lng: b.lng }
			);
			a.distance = distanceA;
			b.distance = distanceB;
			return distanceA - distanceB;
		})
		.slice(0, 30)  
		.map(([id, place]) => ({ id, ...place }))  
		.forEach((place, idx) => {  
			let isCannonical = !place.owner
			//console.log(JSON.stringify(place, null, 2));
			addPlace(place.id, me, canonicalLayer, zoom, place, isCannonical, i);  
		});
}


async function update() {
	const res = await fetch(`/api/data`);
	const payload = await res.json();
	const { daves, places } = payload;

	//console.log(`[UPDATE daves]  ` + JSON.stringify(daves, null, 2));
	//console.log(`[UPDATE places]  ` + JSON.stringify(places, null, 2));

	me = daves[userId]
	if (!me) {
		console.log("Update, but I'm missing");
		return;
	} 

	renderPlaces(places);
	addStateUI(me, Object.keys(daves).length);

	// Build list of other Daves with distances relative to me and update map markers
	const distanceList = document.getElementById("distanceList");
	distanceList.innerHTML = "";
	let i = 0;

	const seen = new Set();
	Object.entries(daves)
		.filter(([key, dave]) => key !== socket.userId && dave.lat != null && dave.lng != null)
		.sort(([, a], [, b]) => {
			const distanceA = haversineDistance(
				{ lat: me.lat, lng: me.lng },
				{ lat: a.lat, lng: a.lng }
			);
			const distanceB = haversineDistance(
				{ lat: me.lat, lng: me.lng },
				{ lat: b.lat, lng: b.lng }
			);
			a.distance = distanceA;
			b.distance = distanceB;
			return distanceA - distanceB;
		})
		.forEach(([key, dave], idx) => {
			seen.add(key);
			addPlayer(map, me, dave, i++);
		});
	//console.log("\tadded: " + i);
	cullNotSeen(map, seen);

	if (init) {
		map.setView([me.lat, me.lng]);
		init = false;
	} }

socket.on('update', () => {
	const now = Date.now();
	if (now - lastRender > MIN_INTERVAL) {
		lastRender = now;
		update();
	} 
});

socket.on("logEvent", (entry) => {
	logEvent(entry.message);
});

socket.on('teleport', (data) => {
	me.lat = data.lat;
	me.lng = data.lng;
	me.freeRoam = data.freeRoam;
	//console.log("recv'd teleport: " + JSON.stringify(me));
	map.setView([me.lat, me.lng]);
});

map.on('click', async (e) => {
	//console.log("got click: " + me.freeRoam);
	if (!me.freeRoam) return;

	const { lat, lng } = e.latlng;
	//console.log("set player: " + lat + ", " + lng);
	
	const payload = JSON.stringify({
		source: userId,
		targetType: "coords",
		lat: lat,
		lng: lng,
	});

	await fetch('/api/teleport', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload
	});

	map.setView([lat, lng]);
	update()

});



// --- Geolocation ---
function startGeolocation() {
	if (!navigator.geolocation) {
		stateEl.textContent = 'Geolocation not supported.';
		return;
	}
	navigator.geolocation.watchPosition((pos) => {
		if (me.freeRoam) {
			return;
		} 
		const lat = pos.coords.latitude;
		const lng = pos.coords.longitude;
		if (lat === 0 && lng === 0) {
			map.setView([me.lat, me.lng]);
		} else {
			socket.emit('location', { lat, lng });
	
			if (centerOn) {
				map.setView([lat, lng]);
			}
		}
	}, (err) => {
		stateEl.textContent = `Location error: ${err.message}`;
	}, {
		enableHighAccuracy: true,
		maximumAge: 2000,
		timeout: 15000
	});
}

// Start everything
startGeolocation();
