const COOLDOWN_TIME_KEYS = [
	"lastDaveRaveTime",
	"lastDoonPlaceUpgradeTime",
	"lastHackerJeopardyBabyTime",
	"lastHackerJeopardyTime",
	"lastHardwareHackingTime",
	"lastVetconTime",
	"lastTacoCalibrationTime"
];

export function resetDaveCooldowns(dave) {
	if (!dave || typeof dave !== "object") {
		return 0;
	}

	let resetCount = 0;

	for (const key of COOLDOWN_TIME_KEYS) {
		if (Number.isFinite(dave[key])) {
			dave[key] = 0;
			resetCount += 1;
		}
	}

	for (const value of Object.values(dave)) {
		if (value && typeof value === "object" && Number.isFinite(value.lastTime)) {
			value.lastTime = 0;
			resetCount += 1;
		}
	}

	return resetCount;
}

export function resetAllCooldowns(users = {}) {
	return Object.values(users).reduce((total, dave) => total + resetDaveCooldowns(dave), 0);
}
