
import { addTag, hasTag } from "./state.js";

export const COMMENDATION_THRESHOLD = 10;

export function getLevel(dave) {
	return dave?.dodLevel ?? 0;
}

export function hasApplication(dave) {
	return !!dave?.dodApplication;
}

export function getCommendations(dave) {
	return Math.max(0, Number(dave?.dodCommendations ?? 0));
}

export function addCommendations(dave, points) {
	if (!dave || getLevel(dave) < 1 || !Number.isFinite(points) || points <= 0) {
		return {
			awarded: false,
			promoted: false,
			total: getCommendations(dave)
		};
	}

	dave.dodCommendations = getCommendations(dave) + points;
	const promoted = dave.dodCommendations >= COMMENDATION_THRESHOLD && !hasTag(dave, "general");

	if (promoted) {
		addTag(dave, "general");
	}

	return {
		awarded: true,
		promoted,
		total: dave.dodCommendations
	};
}
