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
let currentMapTargets = [];
let activeTargetChooser = null;

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
	if (!Number.isFinite(Number(me.lat)) || !Number.isFinite(Number(me.lng))) {
		return;
	}

	centerOn = true;
	map.flyTo([me.lat, me.lng], 16);
};

const canonicalLayer = L.layerGroup().addTo(map);

function getTargetUrl(target) {
	if (target.type === "place") {
		return `/place.html?id=${encodeURIComponent(target.id)}&viewerId=${encodeURIComponent(userId)}`;
	}

	return `/player.html?id=${encodeURIComponent(target.id)}&viewerId=${encodeURIComponent(userId)}`;
}

function navigateToTarget(target) {
	window.location.href = getTargetUrl(target);
}

function targetKindLabel(target) {
	return target.type === "place" ? "NODE" : "DAVE";
}

function targetDetailLabel(target) {
	const parts = [];
	if (target.type === "place" && target.level) {
		parts.push(`Level ${target.level}`);
	}
	if (Number.isFinite(Number(target.distance))) {
		parts.push(`${Math.round(target.distance)} m away`);
	}
	return parts.join(" | ");
}

function closeTargetChooser() {
	if (activeTargetChooser) {
		activeTargetChooser.remove();
		activeTargetChooser = null;
	}
}

function showTargetChooser(targets) {
	closeTargetChooser();

	const overlay = document.createElement("div");
	overlay.className = "target-chooser-overlay";
	overlay.addEventListener("click", closeTargetChooser);

	const dialog = document.createElement("div");
	dialog.className = "target-chooser";
	dialog.setAttribute("role", "dialog");
	dialog.setAttribute("aria-modal", "true");
	dialog.setAttribute("aria-labelledby", "targetChooserTitle");
	dialog.addEventListener("click", (event) => event.stopPropagation());

	const header = document.createElement("div");
	header.className = "target-chooser-header";

	const title = document.createElement("div");
	title.id = "targetChooserTitle";
	title.className = "target-chooser-title";
	title.textContent = "Choose target";

	const closeButton = document.createElement("button");
	closeButton.type = "button";
	closeButton.className = "target-chooser-close";
	closeButton.setAttribute("aria-label", "Close target chooser");
	closeButton.textContent = "x";
	closeButton.addEventListener("click", closeTargetChooser);

	header.appendChild(title);
	header.appendChild(closeButton);
	dialog.appendChild(header);

	const list = document.createElement("div");
	list.className = "target-chooser-list";

	targets.forEach((target) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "target-choice";
		button.addEventListener("click", () => navigateToTarget(target));

		const main = document.createElement("span");
		main.className = "target-choice-main";

		const kind = document.createElement("span");
		kind.className = "target-choice-kind";
		kind.textContent = targetKindLabel(target);

		const name = document.createElement("span");
		name.className = "target-choice-name";
		name.textContent = target.name || target.id;

		main.appendChild(kind);
		main.appendChild(name);
		button.appendChild(main);

		const detailText = targetDetailLabel(target);
		if (detailText) {
			const detail = document.createElement("span");
			detail.className = "target-choice-detail";
			detail.textContent = detailText;
			button.appendChild(detail);
		}

		list.appendChild(button);
	});

	dialog.appendChild(list);
	overlay.appendChild(dialog);
	document.body.appendChild(overlay);
	activeTargetChooser = overlay;
	closeButton.focus();
}

function findOverlappingTargets(clickedTarget) {
	if (!clickedTarget || typeof map.latLngToLayerPoint !== "function") {
		return [];
	}

	const clickPoint = map.latLngToLayerPoint([clickedTarget.lat, clickedTarget.lng]);
	const overlapRadiusPx = 44;

	return currentMapTargets
		.map((target) => {
			const point = map.latLngToLayerPoint([target.lat, target.lng]);
			return {
				...target,
				_screenDistance: clickPoint.distanceTo(point)
			};
		})
		.filter((target) => target._screenDistance <= overlapRadiusPx)
		.sort((a, b) => a._screenDistance - b._screenDistance || (a.distance ?? 0) - (b.distance ?? 0));
}

function handleMapTargetClick(clickedTarget) {
	const targets = findOverlappingTargets(clickedTarget);

	if (targets.length > 1) {
		showTargetChooser(targets);
		return;
	}

	const exactTarget = currentMapTargets.find((target) => target.type === clickedTarget.type && target.id === clickedTarget.id);
	navigateToTarget(exactTarget || clickedTarget);
}

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") {
		closeTargetChooser();
	}
});

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
			if (!Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lng))) {
				return;
			}

			let isCannonical = !place.owner
			//console.log(JSON.stringify(place, null, 2));
			currentMapTargets.push({
				type: "place",
				id: place.id,
				name: place.name,
				level: place.level,
				lat: place.lat,
				lng: place.lng,
				distance: place.distance
			});
			addPlace(place.id, me, canonicalLayer, zoom, place, isCannonical, nodeDistanceList, i, {
				onMarkerClick: handleMapTargetClick
			});  
		});
}


async function update() {
	const res = await fetch(`/api/data`);
	const payload = await res.json();
	const { daves, places } = payload;

	//console.log(`[UPDATE daves]  ` + JSON.stringify(daves, null, 2));
	//console.log(`[UPDATE places]  ` + JSON.stringify(places, null, 2));

	const nextMe = daves[userId];
	if (!nextMe) {
		console.log("Update, but I'm missing");
		return;
	} 
	me = nextMe;

	currentMapTargets = [];
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
				if (!Number.isFinite(Number(dave.lat)) || !Number.isFinite(Number(dave.lng))) {
					return;
				}

				seen.add(key);
				const showInList = !dave.isBot;
				currentMapTargets.push({
					type: "player",
					id: dave.userId,
					name: dave.name,
					state: dave.state,
					lat: dave.lat,
					lng: dave.lng,
					distance: dave.distance
				});
				addPlayer(map, me, dave, i, {
					showInList,
					onMarkerClick: handleMapTargetClick
				});
				if (showInList) {
					i++;
				}
			});
	}
	//console.log("\tadded: " + i);
	cullNotSeen(map, seen);

	if (init && me.visible !== false && Number.isFinite(Number(me.lat)) && Number.isFinite(Number(me.lng))) {
		map.setView([me.lat, me.lng]);
		init = false;
	} }

async function refreshAfterNavigationRestore() {
	await update();
	if (me?.freeRoam && Number.isFinite(Number(me.lat)) && Number.isFinite(Number(me.lng))) {
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
			if (Number.isFinite(Number(me.lat)) && Number.isFinite(Number(me.lng))) {
				map.setView([me.lat, me.lng]);
			}
		} else {
			if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
				return;
			}

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
