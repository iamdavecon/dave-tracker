import * as state from "./state.js";

// --- Helpers: Haversine distance ---
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

function distanceMeters(lat1, lon1, lat2, lon2) {
	const R = 6371000; // meters
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat/2)**2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
		Math.sin(dLon/2)**2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineDistance(a, b) {
	const R = 6371000; // radius of Earth in meters
	const toRad = (deg) => (deg * Math.PI) / 180;

	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lng - a.lng);

	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);

	const h =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);

	return 2 * R * Math.asin(Math.sqrt(h));
}

export function getRange(src) {
	//console.log("from: " + state.getAscendencyBonus(src));
	const baseRange = 50 * state.getAscendencyBonus(src);
	const tacoMultiplier = Number.isFinite(src?.tacoRangeBoostUntil) && src.tacoRangeBoostUntil > Date.now()
		? 2
		: 1;
	return baseRange * tacoMultiplier;
}

export function inRange(src, target) {
	//console.log("\t\tdx:  " + haversineDistance(src, target) + " < " + getRange(src));
	//console.log(JSON.stringify(src, null, 2));
	//console.log(JSON.stringify(target, null, 2));
	return haversineDistance(src, target) < getRange(src);
}

export function rangesOverlap(a, b) {
	return haversineDistance(a, b) < getRange(a) + getRange(b);
}
