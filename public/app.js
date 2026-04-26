import { haversineDistance } from './utils/distance.js';

const socket = io();
let myId = "Dave";
let me = {}

const totalEl = document.getElementById('total');
const stateEl = document.getElementById('state');
const infectedCountEl = document.getElementById('infectedCount');
const fragmentsEl = document.getElementById('fragments');
const distanceList = document.getElementById("distanceList");

//DavID

function getUserId() {
	let id = localStorage.getItem("davecon_user_id");

	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem("davecon_user_id", id);
	}

	return id;
}

const userId = getUserId();
socket.emit("register", { userId });

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById('userId').textContent = userId;
});

const savedId = localStorage.getItem('DaveID');
if (savedId) {
	myId = savedId;
	document.getElementById('userName').value = myId;
	socket.emit('setId', myId); 
}


document.getElementById('setIdBtn').addEventListener('click', () => {
	const val = document.getElementById('userName').value.trim();
	if (val) {
		myId = val;
		localStorage.setItem('DaveID', myId); 
		socket.emit('setId', myId); 
	}
});


//State

function updateButtons() {
	const state = me.state; 
	if (state === "IMMUNE" || state == "PATCHED") {
		//stabilizeBtn.disabled = false;
		stabilizeBtn.textContent = "STABILIZE HOST";
	} else {
		//stabilizeBtn.disabled = true;
		stabilizeBtn.textContent = "ANTIVIRUS REQUIRED";
	}
}


// INFECTION


document.getElementById("infectBtn").addEventListener("click", () => {
	console.log("infect");
	socket.emit("infectNearby");
});

socket.on('infectResult', (data) => {
	logEvent(`Transmission spread  ${data.count} host(s) infected`);
});

socket.on('updateState', (data) => {
	logEvent(data);
});


//  STABILIZE

document.getElementById("stabilizeBtn").addEventListener("click", () => {
	const state = me.state; 
	if (state === "IMMUNE" || state == "PATCHED") {
		socket.emit("stabilizeNearby");
	} else {
		window.location.href = "https://iamdavecon.github.io/bb/";
	}
});


//  etc

document.getElementById("spawnCluster").addEventListener("click", () => {
	console.log("spawn");
	socket.emit("spawnCluster", 5);
});

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

let myMarker = null;
let userMarkers = {};

const markers = {};

socket.on('update', (data) => {
	const daves = data.daves;
	console.log(`[UPDATE]  ` + JSON.stringify(daves, null, 2));

	totalEl.textContent = Object.keys(daves).length

	me = daves[userId]
	console.log("update " + JSON.stringify(me, null, 2) + " from " + userId)

	// --- Update status ---

	const state = me.state; 
	if (state) {
		stateEl.textContent = state;
		stateEl.className = "value " + state.toLowerCase();

		infectedCountEl.textContent = me.infectedUsers.length; 

		updateButtons()
	}

	// Build list of other Daves with distances relative to me and update map markers
	distanceList.innerHTML = "";
	console.log(typeof daves)
	Object.entries(daves) 
		.filter(([key, dave]) => key !== socket.userId && dave.lat != null && dave.lon != null)
		.sort(([, a], [, b]) => {
			const distanceA = haversineDistance(
				{ lat: me.lat, lon: me.lon },
				{ lat: a.lat, lon: a.lon }
			);
			const distanceB = haversineDistance(
				{ lat: me.lat, lon: me.lon },
				{ lat: b.lat, lon: b.lon }
			);
			a.distance = distanceA;
			b.distance = distanceB;
			return distanceA - distanceB;
		})
		.forEach(([key, dave], idx) => {
			console.log("\tdave: " + key); // Use the key as the user ID
			// --- Update map markers ---
			const marker = L.marker([dave.lat, dave.lon], {
				icon: L.divIcon({
					className: `custom-icon ${dave.state.toLowerCase()}`,
					html: `<div class="icon-inner">${dave.icon}</div>`,
					iconSize: [24, 24],
					iconAnchor: [12, 12],
				})
			});
			marker.addTo(map);
			markers[key] = marker; // Use the key for storing the marker

			// --- Update distance list ---
			const li = document.createElement("li");
			li.textContent = `${dave.icon} ${Math.round(dave.distance)} m`;
			if (idx === 0) {
				li.style.fontWeight = "bold";
				li.style.color = "green";
			}
			distanceList.appendChild(li);
		});
	
});



// --- Geolocation ---
function startGeolocation() {
	if (!navigator.geolocation) {
		stateEl.textContent = 'Geolocation not supported.';
		return;
	}
	navigator.geolocation.watchPosition((pos) => {
		const lat = pos.coords.latitude;
		const lon = pos.coords.longitude;
		//console.log("sending: " + myId);
		socket.emit('location', { lat, lon });

		// Update my marker
		if (!myMarker) {
			myMarker = L.marker([lat, lon], { title: "You" }).addTo(map);
		} else {
			myMarker.setLatLng([lat, lon]);
		}
		map.setView([lat, lon]);
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
