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
	const dLon = toRad(b.lon - a.lon);

	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);

	const h =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);

	return 2 * R * Math.asin(Math.sqrt(h));
}

export function inRange(src, target) {
	const range = src.range || 50;
	return haversineDistance(src, target) < range;
}


