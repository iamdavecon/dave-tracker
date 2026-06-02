import { inRange } from './distance.js';

const LOCATION_OPTIONS = {
	enableHighAccuracy: true,
	maximumAge: 2000,
	timeout: 15000
};

const LOCATION_REFRESH_MS = 5000;
const MAP_REFIT_MS = 10000;
const activeMapStates = new Map();

export function getMapData(me, target) {
	return {
		viewerLat: me?.lat ?? 0,
		viewerLon: me?.lng ?? 0,

		targetLat: target?.lat ?? 0,
		targetLon: target?.lng ?? 0,

		state: me?.state ?? "unstable",
		name: target?.name ?? "D",
		freeRoam: !!me?.freeRoam,

		inRange: me && target ? inRange(me, target) : false,
	};
}


function createPill(label, state = "neutral", isYou = false) {
	return L.divIcon({
		className: "",
		html: `
			<div class="map-pill ${state} ${isYou ? "you" : ""}">
				${label}
			</div>
		`,
		iconSize: null
	});
}

function normalizeCoordinate(value, fallback = 0) {
	return Number.isFinite(value) ? value : fallback;
}

function fitMapBounds(state, force = false) {
	const now = Date.now();
	if (!force && now - state.lastFitAt < MAP_REFIT_MS) {
		return;
	}

	state.map.fitBounds(state.group.getBounds(), { padding: [30, 30], animate: true, duration: 0.5 });
	state.lastFitAt = now;
}

function updateMapState(state, mapData, shouldFit = false) {
	state.mapData = mapData;
	state.meMarker.setLatLng([mapData.viewerLat, mapData.viewerLon]);
	state.targetMarker.setLatLng([mapData.targetLat, mapData.targetLon]);
	state.targetMarker.setIcon(createPill(mapData.name, mapData.state?.toLowerCase()));
	state.connectionLine.setLatLngs([
		[mapData.viewerLat, mapData.viewerLon],
		[mapData.targetLat, mapData.targetLon]
	]);
	fitMapBounds(state, shouldFit);
}

export function addMap(mapData, options = {}) {
	//console.log("loading: " + JSON.stringify(mapData, null, 2));
	mapData = {
		...mapData,
		viewerLat: normalizeCoordinate(mapData?.viewerLat),
		viewerLon: normalizeCoordinate(mapData?.viewerLon),
		targetLat: normalizeCoordinate(mapData?.targetLat, normalizeCoordinate(mapData?.viewerLat)),
		targetLon: normalizeCoordinate(mapData?.targetLon, normalizeCoordinate(mapData?.viewerLon))
	};

	// --- init map ---
	const container = document.getElementById("map");
	if (!container) {
		return null;
	}

	const activeState = activeMapStates.get(container);
	if (activeState) {
		activeState.options = options;
		updateMapState(activeState, mapData);
		return activeState.map;
	}

	const map = L.map(container);

	L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		attribution: "© OpenStreetMap"
	}).addTo(map);

	// --- markers ---
	const meMarker = L.marker([mapData.viewerLat, mapData.viewerLon], {
		icon: createPill("YOU", "", true)
	}).addTo(map);

	const targetMarker = L.marker([mapData.targetLat, mapData.targetLon], {
		icon: createPill(mapData.name, mapData.state?.toLowerCase())
	}).addTo(map);

	//L.marker([mapData.targetLat, mapData.targetLon], { title: mapData.name }).addTo(map);


	const group = new L.featureGroup([meMarker, targetMarker]);

	// --- draw connection line ---
	const connectionLine = L.polyline(
		[
			[mapData.viewerLat, mapData.viewerLon],
			[mapData.targetLat, mapData.targetLon]
		],
		{ color: "white", opacity: 0.5 }
	).addTo(map);

	const mapState = {
		map,
		meMarker,
		targetMarker,
		group,
		connectionLine,
		mapData,
		options,
		lastFitAt: 0
	};

	activeMapStates.set(container, mapState);

	function updateViewerLocation(lat, lng) {
		if (mapState.options.freeRoam || mapState.mapData.freeRoam) {
			return;
		}

		if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
			return;
		}

		mapState.mapData.viewerLat = lat;
		mapState.mapData.viewerLon = lng;
		meMarker.setLatLng([lat, lng]);
		connectionLine.setLatLngs([
			[lat, lng],
			[mapState.mapData.targetLat, mapState.mapData.targetLon]
		]);
		fitMapBounds(mapState);

		mapState.options.socket?.emit("location", { lat, lng });
		mapState.options.onLocation?.({ lat, lng });
	}

	function refreshLocation() {
		if (!navigator.geolocation) {
			return;
		}

		navigator.geolocation.getCurrentPosition((pos) => {
			updateViewerLocation(pos.coords.latitude, pos.coords.longitude);
		}, () => {}, LOCATION_OPTIONS);
	}

	if (navigator.geolocation) {
		const watchId = navigator.geolocation.watchPosition((pos) => {
			updateViewerLocation(pos.coords.latitude, pos.coords.longitude);
		}, () => {}, LOCATION_OPTIONS);

		const intervalId = window.setInterval(refreshLocation, LOCATION_REFRESH_MS);

		const cleanup = () => {
			navigator.geolocation.clearWatch(watchId);
			window.clearInterval(intervalId);
			activeMapStates.delete(container);
		};

		mapState.cleanup = cleanup;
		window.addEventListener("beforeunload", cleanup, { once: true });

		refreshLocation();
	}

	fitMapBounds(mapState, true);

	return map;
}
