import { getUserId } from './utils/id.js';
import * as state from "./utils/state.js";
import { haversineDistance } from './utils/distance.js';
import { inRange } from './utils/distance.js';
import { addPlace } from './utils/places.js';

const userId = getUserId();
const socket = io({
    auth: {
        userId: userId
    }
});

let me = {}
let savedPlaces = {}

const params = new URLSearchParams(window.location.search);
const immune = params.get('immune');

socket.emit("register", { userId, immune });

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById('userId').textContent = userId;
});

document.getElementById('setIdBtn').addEventListener('click', () => {
	const userName = document.getElementById('userName').value.trim();
	if (userName) {
		socket.emit('setId', userName); 
	}
});


const leaderboard = document.getElementById("leaderboardLink");
leaderboard .href = `/leaderboard.html?userId=${encodeURIComponent(userId)}`;

function updateButtons() {
	if (state.canPatch(me)) {
		const btn = document.getElementById("install-antivirus");
		btn.style.display = "none";
	} else {
		document.getElementById("install-antivirus").onclick = () => {
			window.location.href = "https://iamdavecon.github.io/bb/";
		};
	}
}

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

function roughDistance(a, b) {
	const dx = a.lat - b.lat;
	const dy = a.lon - b.lon;
	return dx * dx + dy * dy; 
}

function renderPlaces() {
	canonicalLayer.clearLayers();

	const zoom = map.getZoom();

	//console.log(JSON.stringify(savedPlaces, null, 2));

	Object.entries(savedPlaces)  
		.map(([id, place]) => ({ id, ...place }))  
		.sort((a, b) => roughDistance(a, me) - roughDistance(b, me))  
		.slice(0, 50)  
		.forEach((place, idx) => {  
			addPlace(place.id, userId, canonicalLayer, zoom, place, true);  
		});
}

socket.on('setSavedPlaces', (data) => {
	savedPlaces = data.savedPlaces;
	renderPlaces();
});

const canonicalLayer = L.layerGroup().addTo(map);


socket.on('update', (data) => {
	const daves = data.daves;

	//console.log(`[UPDATE]  ` + JSON.stringify(daves, null, 2));

	const totalEl = document.getElementById('total');
	totalEl.textContent = Object.keys(daves).length

	me = daves[userId]
	if (!me) {
		console.log("I'm missing");
		return;
	}

	// --- Update state/status --
	const stringValue = state.getState(me).toUpperCase();
	const stateEl = document.getElementById('state');
	stateEl.textContent = stringValue;
	stateEl.className = "value pill " + state.getStateClass(me);

	const infectedCountEl = document.getElementById('infectedCount');
	if (me.infectedUsers) {
		infectedCountEl.textContent = me.infectedUsers.length; 
	} else {
		infectedCountEl.textContent = 0;
	}

	const fragmentsEl = document.getElementById('fragments');
	if (me.aragmentsCollected) {
		fragmentsEl.textContent = me.fragmentsCollected.length;
	} else {
		fragmentsEl.textContent = 0;
	}

	updateButtons()

	// Build list of other Daves with distances relative to me and update map markers
	const distanceList = document.getElementById("distanceList");
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
			const stateString = state.getState(dave).toUpperCase();
			const stateClass = state.getStateClass(dave);
			const marker = L.marker([dave.lat, dave.lon], {
				icon: L.divIcon({
					className: "custom-icon", 
					html: `<div class="pill center ${stateClass}">
						${dave.icon}
					</div>`,
					iconSize: null, 
					iconAnchor: [0, 0] 
				})
			});
			marker.addTo(map);

			//L.marker([dave.lat, dave.lon], { title: dave.icon }).addTo(map);


			if (key == userId) {
				const range = dave.range || 50;
				const rangeCircle = L.circle([dave.lat, dave.lon], {
					radius: range,
					color: "#00ffcc",
					weight: 2,
					fillColor: "#00ffcc",
					fillOpacity: 0.08,
				}).addTo(map);
			} 
			if (i < 12) {
				marker.on("click", () => {
					window.location.href = `/player.html?id=${encodeURIComponent(key)}&viewerId=${encodeURIComponent(userId)}`;
				});

				// --- Update distance list ---
				const li = document.createElement("li");

				// Make row feel tappable
				li.style.cursor = "pointer";
				li.style.padding = "12px 16px";
				li.style.borderRadius = "10px";
				li.style.transition = "background 0.15s ease, transform 0.05s ease";
				li.style.borderBottom = "1px solid rgba(255,255,255,0.08)";

				// Navigation on click
				li.addEventListener("click", () => {
					window.location.href = `/player.html?id=${encodeURIComponent(key)}&viewerId=${encodeURIComponent(userId)}`;
				});

				// Touch feedback (mobile)
				li.addEventListener("touchstart", () => {
					li.style.background = "rgba(255,255,255,0.08)";
					li.style.transform = "scale(0.98)";
				});

				li.addEventListener("touchend", () => {
					li.style.background = "transparent";
					li.style.transform = "scale(1)";
				});

				li.addEventListener("touchcancel", () => {
					li.style.background = "transparent";
					li.style.transform = "scale(1)";
				});

				// Hover (desktop)
				li.addEventListener("mouseenter", () => {
					li.style.background = "rgba(255,255,255,0.05)";
				});

				li.addEventListener("mouseleave", () => {
					li.style.background = "transparent";
				});

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
				stateEl.className = stateClass;
				if (stateClass == "ascended" || stateClass == "dope" || stateClass == "awakening") {
					stateEl.style.color = "black";
				} else {
					stateEl.style.color = "white";
				}

				// Optional: prevent row click if you later make this interactive
				stateEl.addEventListener("click", (e) => {
					e.stopPropagation();
				});

				container.appendChild(stateEl);

				// Right side: Distance + chevron
				const rightSide = document.createElement("div");
				rightSide.style.display = "flex";
				rightSide.style.alignItems = "center";
				rightSide.style.gap = "8px";

				const distance = document.createElement("span");
				distance.textContent = `${Math.round(dave.distance)} m`;

				const chevron = document.createElement("span");
				chevron.textContent = ">";
				chevron.style.opacity = "0.5";

				rightSide.appendChild(distance);
				rightSide.appendChild(chevron);

				container.appendChild(rightSide);

				// Append the container to the list item
				li.appendChild(container);

				// Highlight daves in range
				if (key == userId) {
					li.style.fontWeight = "bold";
					li.style.color = "green";
				} else if (inRange(me, dave)) {
					li.style.fontWeight = "bold";
					li.style.color = "blue";
				}

				// Add list item to the distance list
				distanceList.appendChild(li);
				i++;
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
		socket.emit('location', { lat, lon });

		map.setView([lat, lon]);
		map.on("zoomend", renderPlaces);
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
