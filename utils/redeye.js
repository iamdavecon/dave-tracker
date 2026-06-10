const REDEYE_TAG = "redeye";
const REDEYE_START_HOUR = 2;
const REDEYE_END_HOUR = 4;

export function isRedeyeHotdogTime(now = Date.now()) {
	const hour = new Date(now).getHours();
	return hour >= REDEYE_START_HOUR && hour < REDEYE_END_HOUR;
}

export function getRedeyeTag() {
	return REDEYE_TAG;
}
