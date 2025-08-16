const socket = io();
let myId = "Dave";

const totalEl = document.getElementById('total');
const nearbyEl = document.getElementById('nearby');
const arrowEl = document.getElementById('arrow');
const statusEl = document.getElementById('status');
const distanceList = document.getElementById("distanceList");


const savedId = localStorage.getItem('DaveID');
if (savedId) {
	myId = savedId;
	document.getElementById('userId').value = myId;
	socket.emit('setId', myId); 
}


document.getElementById('setIdBtn').addEventListener('click', () => {
	const val = document.getElementById('userId').value.trim();
	if (val) {
		myId = val;
		localStorage.setItem('DaveID', myId); 
		socket.emit('setId', myId); 
	}
});


let lastBearingToNearest = null;
let lastCompassHeading = null;
let smoothedBearing = null;
const bearingHistory = [];
const MAX_HISTORY = 5; // use last 5 readings for smoothing
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100; // ms

// --- Socket events ---
socket.on('totalUsers', (n) => totalEl.textContent = n);


// --- Leaflet map setup ---
let map = L.map('map').setView([0, 0], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let myMarker = null;
let userMarkers = {};
let nearestLine = null;

const markers = {};

// --- Socket update ---
socket.on('update', (data) => {
	// --- Update map markers ---
	Object.values(markers).forEach(m => map.removeLayer(m));
	for (let other of data.others) {
		const marker = L.marker([other.lat, other.lon], {
			icon: L.divIcon({
				className: "custom-icon",
				html: `<div style="font-size:24px">${other.icon}</div>`,
				iconSize: [24, 24],
				iconAnchor: [12, 12],
			})
		});
		marker.addTo(map);
		markers[other.id] = marker;
	}

	// --- Update distance list ---
	distanceList.innerHTML = "";
	data.others
		.slice()
		.sort((a, b) => a.distance - b.distance)
		.forEach((o, idx) => {
			const li = document.createElement("li");
			li.textContent = `${o.icon} ${Math.round(o.distance)} m`;
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
		statusEl.textContent = 'Geolocation not supported.';
		return;
	}
	navigator.geolocation.watchPosition((pos) => {
		const lat = pos.coords.latitude;
		const lon = pos.coords.longitude;
		console.log("sending: " + myId);
		socket.emit('location', { lat, lon, myId });

		// Update my marker
		if (!myMarker) {
			myMarker = L.marker([lat, lon], { title: "You" }).addTo(map);
		} else {
			myMarker.setLatLng([lat, lon]);
		}
		map.setView([lat, lon]);
	}, (err) => {
		statusEl.textContent = `Location error: ${err.message}`;
	}, {
		enableHighAccuracy: true,
		maximumAge: 2000,
		timeout: 15000
	});
}

// Start everything
startGeolocation();
