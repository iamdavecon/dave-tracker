export function parseLandmarkInput(value, createId = () => crypto.randomUUID()) {
	const match = value.trim().match(/^([^,]+),([^,]+),(.+)$/);
	if (!match) {
		return { error: "Landmark must be formatted as lat, lon, name." };
	}

	const lat = Number(match[1].trim());
	const lng = Number(match[2].trim());
	const name = match[3].trim();

	if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
		return { error: "Landmark latitude must be a number between -90 and 90." };
	}
	if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
		return { error: "Landmark longitude must be a number between -180 and 180." };
	}
	if (!name) {
		return { error: "Landmark name is required." };
	}

	return {
		place: {
			id: createId(),
			lat,
			lng,
			name
		}
	};
}

export function parseCurrentLocationLandmarkInput(value, location, createId = () => crypto.randomUUID()) {
	const name = value.trim();
	if (!name) {
		return { error: "Landmark name is required." };
	}

	const lat = Number(location?.lat);
	const lng = Number(location?.lng);
	if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
		return { error: "Current latitude is unavailable." };
	}
	if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
		return { error: "Current longitude is unavailable." };
	}

	return {
		place: {
			id: createId(),
			lat,
			lng,
			name
		}
	};
}
