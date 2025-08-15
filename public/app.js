// Client-side logic: geolocation + compass + socket.io
const socket = io();

const totalEl = document.getElementById('total');
const nearbyEl = document.getElementById('nearby');
const distanceEl = document.getElementById('distance');
const arrowEl = document.getElementById('arrow');
const statusEl = document.getElementById('status');
const compassBtn = document.getElementById('compassPermission');

let lastBearingToNearest = null; // From our position to nearest (deg)
let currentHeading = 0;          // Device compass heading (0 = North)

// Rotate the arrow so it points towards the nearest user (bearing minus device heading)
function updateArrow() {
	if (lastBearingToNearest == null) {
		arrowEl.style.transform = `rotate(0deg)`;
		return;
	}
	const rotation = (lastBearingToNearest - currentHeading + 360) % 360;
	arrowEl.style.transform = `rotate(${rotation}deg)`;
}

// --- Socket events ---
socket.on('totalUsers', (n) => totalEl.textContent = n);

// --- Socket update ---
socket.on('update', (data) => {
	nearbyEl.textContent = data.nearby ?? 0;

	// Clear old markers (except mine)
	for (const id in userMarkers) {
		map.removeLayer(userMarkers[id]);
	}
	userMarkers = {};
	if (nearestLine) {
		map.removeLayer(nearestLine);
		nearestLine = null;
	}

	if (data.users) {
		data.users.forEach(u => {
			if (u.isMe) return; // skip myself
			const m = L.marker([u.lat, u.lon], { title: `User ${u.id}` }).addTo(map);
			userMarkers[u.id] = m;
		});
	}

	if (data.nearest) {
		lastBearingToNearest = data.nearest.bearing;
		distanceEl.textContent = `${(data.nearest.distanceMeters).toFixed(0)} m`;
		statusEl.textContent = `Arrow points toward nearest user.`;

		// Draw line to nearest
		if (myMarker) {
			nearestLine = L.polyline([myMarker.getLatLng(), [data.nearest.lat, data.nearest.lon]], {
				color: 'red'
			}).addTo(map);
		}
	} else {
		lastBearingToNearest = null;
		distanceEl.textContent = '—';
		statusEl.textContent = 'No other users yet.';
	}

	updateArrow();
});

// --- Leaflet map setup ---
let map = L.map('map').setView([0, 0], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let myMarker = null;
let userMarkers = {};
let nearestLine = null;


// --- Geolocation ---
function startGeolocation() {
	if (!navigator.geolocation) {
		statusEl.textContent = 'Geolocation not supported.';
		return;
	}
	navigator.geolocation.watchPosition((pos) => {
		const lat = pos.coords.latitude;
		const lon = pos.coords.longitude;
		socket.emit('location', { lat, lon });

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

// --- Compass (DeviceOrientation) ---
function handleOrientation(event) {
	let heading;
	// iOS Safari provides webkitCompassHeading (0 = North, clockwise)
	if (typeof event.webkitCompassHeading === 'number') {
		heading = event.webkitCompassHeading;
	} else if (typeof event.alpha === 'number') {
		// Other browsers: alpha is 0 at initial orientation; if absolute, 0 ~ North.
		// Convert to compass heading: 0 = North, clockwise.
		// The commonly used transform is (360 - alpha) % 360
		heading = (360 - event.alpha) % 360;
	}
	if (typeof heading === 'number' && !Number.isNaN(heading)) {
		currentHeading = heading;
		updateArrow();
	}
}

function enableCompassListeners() {
	window.addEventListener('deviceorientationabsolute', handleOrientation, true);
	window.addEventListener('deviceorientation', handleOrientation, true);
}

// Some browsers (iOS 13+) require an explicit permission request
function maybeRequestCompassPermission() {
	const needsButton = typeof DeviceOrientationEvent !== 'undefined' &&
		typeof DeviceOrientationEvent.requestPermission === 'function';
	if (needsButton) {
		compassBtn.classList.remove('hidden');
		compassBtn.onclick = async () => {
			try {
				const resp = await DeviceOrientationEvent.requestPermission();
				if (resp === 'granted') {
					enableCompassListeners();
					compassBtn.classList.add('hidden');
				} else {
					statusEl.textContent = 'Compass permission denied.';
				}
			} catch (e) {
				statusEl.textContent = 'Compass permission error.';
			}
		};
	} else {
		// No permission prompt needed
		enableCompassListeners();
	}
}

// Start everything
startGeolocation();
maybeRequestCompassPermission();
