import { inRange } from './distance.js';
import { DAVE_RAVE_MIN_PLAYERS, DAVE_RAVE_RADIUS_METERS } from './raves.js';

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
		badgeStatus: target?.badgeStatus ?? null,
		freeRoam: !!me?.freeRoam,

		inRange: me && target ? inRange(me, target) : false,
	};
}


function getBadgeIndicatorHtml(badgeStatus) {
	if (badgeStatus === "need") {
		return `<span class="badge-indicator badge-indicator-need" title="Needs badges" aria-label="Needs badges">!</span>`;
	}

	if (badgeStatus === "have") {
		return `<span class="badge-indicator badge-indicator-have" title="Has badges" aria-label="Has badges">!</span>`;
	}

	return "";
}

function createPill(label, state = "neutral", isYou = false, badgeStatus = null) {
	const goonClass = label === "GOON" ? "goon" : "";
	return L.divIcon({
		className: "",
		html: `
			<div class="map-pill ${state} ${goonClass} ${isYou ? "you" : ""}">
				${label}
				${getBadgeIndicatorHtml(badgeStatus)}
			</div>
		`,
		iconSize: null
	});
}

function normalizeCoordinate(value, fallback = 0) {
	const coordinate = Number(value);
	return Number.isFinite(coordinate) ? coordinate : fallback;
}

function fitMapBounds(state, force = false) {
	const now = Date.now();
	if (!force && now - state.lastFitAt < MAP_REFIT_MS) {
		return;
	}

	const bounds = state.options.showDaveRaveRange && state.raveRangeCircle
		? getRadiusBounds(state.mapData.viewerLat, state.mapData.viewerLon, DAVE_RAVE_RADIUS_METERS)
		: state.group.getBounds();

	state.map.fitBounds(bounds, { padding: [30, 30], animate: true, duration: 0.5 });
	state.lastFitAt = now;
}

function getRadiusBounds(lat, lng, radiusMeters) {
	const latDelta = radiusMeters / 111320;
	const lngScale = Math.max(Math.cos(lat * Math.PI / 180), 0.01);
	const lngDelta = radiusMeters / (111320 * lngScale);

	return L.latLngBounds(
		[lat - latDelta, lng - lngDelta],
		[lat + latDelta, lng + lngDelta]
	);
}

function getRaveRangeSummary(options = {}) {
	const count = Number.isFinite(options.raveCount) ? options.raveCount : 0;
	const needed = Math.max(0, DAVE_RAVE_MIN_PLAYERS - count);
	const status = options.canStartDaveRave
		? "Ready"
		: needed > 0
			? `${needed} more`
			: "Cooldown";

	return {
		count,
		status
	};
}

function renderRaveRangeLegend(state) {
	if (!state.raveLegend) {
		state.raveLegend = L.control({ position: "bottomleft" });
		state.raveLegend.onAdd = () => {
			const el = L.DomUtil.create("div", "rave-range-legend");
			state.raveLegendEl = el;
			return el;
		};
		state.raveLegend.addTo(state.map);
	}

	const summary = getRaveRangeSummary(state.options);
	state.raveLegendEl.innerHTML = `
		<div class="rave-range-label">Dave Rave Range</div>
		<div class="rave-range-value">${DAVE_RAVE_RADIUS_METERS}m radius</div>
		<div class="rave-range-count">${summary.count}/${DAVE_RAVE_MIN_PLAYERS} Daves - ${summary.status}</div>
	`;
}

function updateRaveRange(state) {
	if (!state.options.showDaveRaveRange) {
		state.raveRangeCircle?.remove();
		state.raveLegend?.remove();
		state.raveRangeCircle = null;
		state.raveLegend = null;
		state.raveLegendEl = null;
		return;
	}

	const center = [state.mapData.viewerLat, state.mapData.viewerLon];
	if (!state.raveRangeCircle) {
		state.raveRangeCircle = L.circle(center, {
			radius: DAVE_RAVE_RADIUS_METERS,
			color: "#ffd700",
			weight: 2,
			opacity: 0.95,
			fillColor: "#5cff9d",
			fillOpacity: 0.12,
			className: "rave-range-circle"
		}).addTo(state.map);
	} else {
		state.raveRangeCircle.setLatLng(center);
		state.raveRangeCircle.setRadius(DAVE_RAVE_RADIUS_METERS);
	}

	renderRaveRangeLegend(state);
}

function updateMapState(state, mapData, shouldFit = false) {
	state.mapData = mapData;
	state.meMarker.setLatLng([mapData.viewerLat, mapData.viewerLon]);
	state.targetMarker?.setLatLng([mapData.targetLat, mapData.targetLon]);
	state.targetMarker?.setIcon(createPill(mapData.name, mapData.state?.toLowerCase(), false, mapData.badgeStatus));
	state.connectionLine?.setLatLngs([
		[mapData.viewerLat, mapData.viewerLon],
		[mapData.targetLat, mapData.targetLon]
	]);
	updateRaveRange(state);
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

	const showTarget = !options.showDaveRaveRange;
	const map = L.map(container);

	L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		attribution: "© OpenStreetMap"
	}).addTo(map);

	// --- markers ---
	const meMarker = L.marker([mapData.viewerLat, mapData.viewerLon], {
		icon: createPill("YOU", "", true)
	}).addTo(map);

	const targetMarker = showTarget
		? L.marker([mapData.targetLat, mapData.targetLon], {
			icon: createPill(mapData.name, mapData.state?.toLowerCase(), false, mapData.badgeStatus)
		}).addTo(map)
		: null;

	//L.marker([mapData.targetLat, mapData.targetLon], { title: mapData.name }).addTo(map);

	const groupLayers = targetMarker ? [meMarker, targetMarker] : [meMarker];
	const group = new L.featureGroup(groupLayers);

	// --- draw connection line ---
	const connectionLine = showTarget
		? L.polyline(
			[
				[mapData.viewerLat, mapData.viewerLon],
				[mapData.targetLat, mapData.targetLon]
			],
			{ color: "white", opacity: 0.5 }
		).addTo(map)
		: null;

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
	updateRaveRange(mapState);

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
		connectionLine?.setLatLngs([
			[lat, lng],
			[mapState.mapData.targetLat, mapState.mapData.targetLon]
		]);
		updateRaveRange(mapState);
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

export function removeMap(container = document.getElementById("map")) {
	if (!container) {
		return;
	}

	const activeState = activeMapStates.get(container);
	if (activeState) {
		activeState.cleanup?.();
		activeState.map.remove();
		activeMapStates.delete(container);
	}

	container.innerHTML = "";
}
