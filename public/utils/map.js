import { inRange } from './distance.js';

const LOCATION_OPTIONS = {
	enableHighAccuracy: true,
	maximumAge: 2000,
	timeout: 15000
};

const LOCATION_REFRESH_MS = 5000;

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

export function addMap(mapData, options = {}) {
	//console.log("loading: " + JSON.stringify(mapData, null, 2));

	// --- init map ---
	const map = L.map("map");

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

	function fitMap() {
		map.fitBounds(group.getBounds(), { padding: [30, 30] });
	}

	function updateViewerLocation(lat, lng) {
		if (options.freeRoam || mapData.freeRoam) {
			return;
		}

		if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
			return;
		}

		mapData.viewerLat = lat;
		mapData.viewerLon = lng;
		meMarker.setLatLng([lat, lng]);
		connectionLine.setLatLngs([
			[lat, lng],
			[mapData.targetLat, mapData.targetLon]
		]);
		fitMap();

		options.socket?.emit("location", { lat, lng });
		options.onLocation?.({ lat, lng });
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

		window.addEventListener("beforeunload", () => {
			navigator.geolocation.clearWatch(watchId);
			window.clearInterval(intervalId);
		}, { once: true });

		refreshLocation();
	}

	fitMap();

	return map;
}
