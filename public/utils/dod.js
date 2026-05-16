
export function getLevel(dave) {
	return dave?.dodLevel ?? 0;
}

export function hasApplication(dave) {
	return !!dave?.dodApplication;
}
