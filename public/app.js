import { getUserId } from './utils/id.js';
import { haversineDistance } from './utils/distance.js';
import { addStateUI } from './utils/stateUI.js';
import { addPlayer, cullNotSeen } from './utils/playersUI.js';
import { addPlace } from './utils/placesUI.js';
import { bindLogEvents } from './utils/log.js';

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
bindLogEvents(socket);


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

async function showMe() {
	const res = await fetch('/api/visibility', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId, visible: true })
	});

	if (!res.ok) {
		return;
	}

	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition((pos) => {
			socket.emit('location', {
				lat: pos.coords.latitude,
				lng: pos.coords.longitude
			});
		});
	}

	await update();
}

function renderMapVisibility() {
	const mapEl = document.getElementById("map");
	const centerMeButton = document.getElementById("centerMe");
	const visibilityMapAction = document.getElementById("visibilityMapAction");
	const showOnIndexMapBtn = document.getElementById("showOnIndexMapBtn");
	const isInvisible = me.visible === false;

	mapEl.classList.toggle("hidden", isInvisible);
	centerMeButton.classList.toggle("hidden", isInvisible);
	visibilityMapAction.classList.toggle("hidden", !isInvisible);

	if (showOnIndexMapBtn) {
		showOnIndexMapBtn.onclick = showMe;
	}

	if (!isInvisible) {
		map.invalidateSize();
	}
}

function renderPlaces(places) {
	//console.log("render places: " + JSON.stringify(me, null, 2));
	//console.log(JSON.stringify(places, null, 2));

	const totalEl = document.getElementById('totalNodes');
	totalEl.textContent = Object.keys(places).length

	canonicalLayer.clearLayers();

	const zoom = map.getZoom();


	const nodeDistanceList = document.getElementById("nodeDistanceList");
	nodeDistanceList.innerHTML = "";

	if (me.visible === false) {
		return;
	}

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
			addPlace(place.id, me, canonicalLayer, zoom, place, isCannonical, nodeDistanceList, i);  
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

	renderMapVisibility();
	renderPlaces(places);

	const realUsers = Object.fromEntries(
		Object.entries(daves).filter(([id, user]) => !user.isBot && user.visible !== false)
	);
	addStateUI(me, Object.keys(realUsers).length);

	// Build list of other Daves with distances relative to me and update map markers
	const distanceList = document.getElementById("distanceList");
	distanceList.innerHTML = "";
	let i = 0;

	const seen = new Set();
	if (me.visible !== false) {
		Object.entries(daves)
			.filter(([key, dave]) => dave.visible !== false && dave.lat != null && dave.lng != null)
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
				const showInList = !dave.isBot;
				addPlayer(map, me, dave, i, { showInList });
				if (showInList) {
					i++;
				}
			});
	}
	//console.log("\tadded: " + i);
	cullNotSeen(map, seen);

	if (init && me.visible !== false) {
		map.setView([me.lat, me.lng]);
		init = false;
	} }

async function refreshAfterNavigationRestore() {
	await update();
	if (me.freeRoam && Number.isFinite(Number(me.lat)) && Number.isFinite(Number(me.lng))) {
		centerOn = true;
		map.setView([me.lat, me.lng]);
	}
}

window.addEventListener("pageshow", () => {
	refreshAfterNavigationRestore();
});

socket.on('update', () => {
	const now = Date.now();
	if (now - lastRender > MIN_INTERVAL) {
		lastRender = now;
		update();
	} 
});

socket.on('teleport', (data) => {
	me.lat = data.lat;
	me.lng = data.lng;
	me.freeRoam = data.freeRoam;
	if (me.visible !== false) {
		map.setView([me.lat, me.lng]);
	}
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

	const res = await fetch('/api/teleport', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload
	});

	if (res.ok) {
		const result = await res.json();
		me.lat = result.lat;
		me.lng = result.lng;
		me.freeRoam = result.freeRoam;
		map.setView([me.lat, me.lng]);
		update();
	}

});



// --- Geolocation ---
function startGeolocation() {
	if (!navigator.geolocation) {
		document.getElementById("state").textContent = 'Geolocation not supported.';
		return;
	}
	navigator.geolocation.watchPosition((pos) => {
		if (me.freeRoam) {
			return;
		} 
		const lat = me.visible === false ? 0 : pos.coords.latitude;
		const lng = me.visible === false ? 0 : pos.coords.longitude;
		if (me.visible === false) {
			socket.emit('location', { lat, lng });
		} else if (lat === 0 && lng === 0) {
			map.setView([me.lat, me.lng]);
		} else {
			socket.emit('location', { lat, lng });
	
			if (centerOn) {
				map.setView([lat, lng]);
			}
		}
	}, (err) => {
		document.getElementById("state").textContent = `Location error: ${err.message}`;
	}, {
		enableHighAccuracy: true,
		maximumAge: 2000,
		timeout: 15000
	});
}

// Start everything
startGeolocation();
