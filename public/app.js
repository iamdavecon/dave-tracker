import * as state from "./utils/state.js";
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

const params = new URLSearchParams(window.location.search);
const immune = params.get('immune');

const userId = getUserId();
socket.emit("register", { userId, immune });

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
	if (state.canPatch(me)) {
		//stabilizeBtn.disabled = false;
		stabilizeBtn.textContent = "STABILIZE HOST";
	} else {
		//stabilizeBtn.disabled = true;
		stabilizeBtn.textContent = "ANTIVIRUS REQUIRED";
	}
}


// INFECTION


document.getElementById("infectBtn").addEventListener("click", () => {
	socket.emit("infect");
});

socket.on('infectResult', (data) => {
	const infectedTargets = data.infectedTargets;
	const nInfected = infectedTargets.length;
	if (nInfected > 0) {
		if (nInfected == 1) {
			logEvent(`Transmission spread  1 host infected`);
		} else {
			logEvent(`Transmission spread  ${nInfected} hosts infected`);
		}
	} else {
		logEvent(`No hosts were infected`);
	}
});

socket.on('notifyInfected', (data) => {
	logEvent(`You have been infected by ${data.by}!`);
});

socket.on('patch', (data) => {
	logEvent("You have successfully installed the mind antivirus");
});


//  STABILIZE

document.getElementById("stabilizeBtn").addEventListener("click", () => {
	if (state.canPatch(me)) {
		socket.emit("stabilize");
	} else {
		window.location.href = "https://iamdavecon.github.io/bb/";
	}
});

socket.on('stabilizeResult', (data) => {
	const stabilizedTargets = data.stabilizedTargets;
	const nStabilized = stabilizedTargets.length;
	if (nStabilized > 0) {
		if (nStabilized == 1) {
			logEvent(`Acquired 1 fragment`);
		} else {
			logEvent(`Acquired ${nStabilized} fragments`);
		}
	} else {
		logEvent(`No fragments acquired`);
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
	//console.log(`[UPDATE]  ` + JSON.stringify(daves, null, 2));

	totalEl.textContent = Object.keys(daves).length

	me = daves[userId]

	// --- Update state/status --
	const stringValue = state.getState(me).toUpperCase();
	stateEl.textContent = stringValue;
	stateEl.className = "value " + state.getStateClass(me);

	if (me.infectedUsers) {
		infectedCountEl.textContent = me.infectedUsers.length; 
	} else {
		infectedCountEl.textContent = 0;
	}
	if (me.aragmentsCollected) {
		fragmentsEl.textContent = me.fragmentsCollected.length;
	} else {
		fragmentsEl.textContent = 0;
	}

	updateButtons()

	// Build list of other Daves with distances relative to me and update map markers
	distanceList.innerHTML = "";
	let i = 0;
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
			// --- Update map markers ---
			const stateString = state.getState(dave).toUpperCase();
			const stateClass = state.getStateClass(dave);
			console.log("marker: " + stateClass);
			const marker = L.marker([dave.lat, dave.lon], {
				icon: L.divIcon({
					className: `custom-icon ${stateClass}`,
					html: `<div class="icon-inner">${dave.icon}</div>`,
					iconSize: null,
				})
			});
			marker.addTo(map);
			markers[key] = marker; // Use the key for storing the marker

			i++;
			if (i < 12) {
				// --- Update distance list ---
				const li = document.createElement("li");

				// Create a container div for the layout
				const container = document.createElement("div");
				container.style.display = "flex";
				container.style.justifyContent = "space-between";
				container.style.alignItems = "center";

				// Left side: Name 
				const name = document.createElement("span");
				name.textContent = dave.icon;
				container.appendChild(name);

				// Middle: State
				const stateEl = document.createElement("span");
				stateEl.textContent = stateString;
				stateEl.style = stateClass;
				container.appendChild(stateEl);

				// Right side: Distance
				const distance = document.createElement("span");
				distance.textContent = `${Math.round(dave.distance)} m`;
				container.appendChild(distance);

				// Append the container to the list item
				li.appendChild(container);

				// Highlight the closest one (idx === 0)
				if (idx === 0) {
					li.style.fontWeight = "bold";
					li.style.color = "green";
				}

				// Add list item to the distance list
				distanceList.appendChild(li);
			}
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
