import { inRange } from './distance.js';

export function getMapData(me, target) {
	return {
		viewerLat : me.lat,
		viewerLon : me.lng,

		targetLat : target.lat,
		targetLon : target.lng,

		state : me.state,
		name : target.name,

		inRange : inRange(me, target),
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

export function addMap(mapData) {
	console.log("loading: " + JSON.stringify(mapData, null, 2));

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


	// --- fit bounds to both ---
	const group = new L.featureGroup([meMarker, targetMarker]);
	map.fitBounds(group.getBounds(), { padding: [30, 30] });

	// --- draw connection line ---
	L.polyline(
		[
			[mapData.viewerLat, mapData.viewerLon],
			[mapData.targetLat, mapData.targetLon]
		],
		{ color: "white", opacity: 0.5 }
	).addTo(map);

	return map;
}

