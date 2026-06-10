import { haversineDistance } from "../public/utils/distance.js";

export const LOCATION_ACTIVITY_THRESHOLD_METERS = 5;

export function markActive(dave, now = Date.now()) {
	if (dave) {
		dave.updatedAt = now;
	}
}

export function hasLocationChanged(dave, lat, lng, thresholdMeters = LOCATION_ACTIVITY_THRESHOLD_METERS) {
	if (!Number.isFinite(dave?.lat) || !Number.isFinite(dave?.lng)) {
		return true;
	}

	return haversineDistance(dave, { lat, lng }) >= thresholdMeters;
}

export function applyLocationActivity(dave, loc, now = Date.now()) {
	const lat = dave.visible === false ? 0 : loc.lat;
	const lng = dave.visible === false ? 0 : loc.lng;
	const changed = hasLocationChanged(dave, lat, lng);

	dave.lat = lat;
	dave.lng = lng;

	if (changed) {
		markActive(dave, now);
	}

	return changed;
}
