const STATES = {
	DAVEPRIME: "daveprime",
	DOPE: "dope",
	ASCENDED: "ascended",
	RESONANT: "resonant",
	IMMUNE: "immune",
	UNSTABLE: "unstable",
	INFECTED: "infected",
	CORRUPTED: "corrupted"
};
const STATE_LIST = Object.values(STATES);
const TERRITORY_TAGS = [
	"standard-user",
	"admin",
	"power-user",
	"root",
	"network-administrator"
];
const TERRITORY_RANKS = [
	{ tag: "standard-user", label: "Standard User", min: 1 },
	{ tag: "admin", label: "Admin", min: 3 },
	{ tag: "power-user", label: "Power User", min: 6 },
	{ tag: "root", label: "Root", min: 10 },
	{ tag: "network-administrator", label: "Network Administrator", min: 15 }
];

function toNumber(state) {
	return STATE_LIST.indexOf(state);
}

function toState(index) {
	return STATE_LIST[index] ?? null;
}

function getIndex(dave) {
	return toNumber(getState(dave));
}

export function getAscension(state) {
	const unstableIndex = STATE_LIST.indexOf(STATES.UNSTABLE);
	const stateIndex = STATE_LIST.indexOf(state);

	if (stateIndex === -1) return 0;

	return Math.max(0, unstableIndex - stateIndex);
}

export function getDefaultState() {
	return STATES.UNSTABLE;
}

export function getRandomState() {
	const values = Object.values(STATES);
	const i = Math.floor(Math.random() * values.length);
	return values[i];
}

export function getRandomBotState() {
	const outcomes = [
		{ state: STATES.UNSTABLE, weight: 0.9 },
		{ state: STATES.CORRUPTED, weight: 0.1 }
	];

	const rand = Math.random();
	let cumulative = 0;

	for (const o of outcomes) {
		cumulative += o.weight;
		if (rand < cumulative) {
			return o.state;
		}
	}
}


export function increaseRank(dave) {
	const currentIndex = getIndex(dave);

	// higher rank = lower index
	if (currentIndex <= 0) {
		return false;
	}

	dave.state = toState(currentIndex - 1);
	return true;
}

export function decreaseRank(dave) {
	const currentIndex = getIndex(dave);

	// lower rank = higher index
	if (currentIndex >= STATE_LIST.length - 1) {
		return false;
	}

	dave.state = toState(currentIndex + 1);
	return true;
}

export function getState(dave) {
	if (dave && dave.state && Object.values(STATES).includes(dave.state)) {
		return dave.state;
	} else {
		return STATES.UNSTABLE;
	}
}

export function getStateClass(dave) {
	return getState(dave);
}

export function getRadarClass(dave) {
	const stateValue = getIndex(dave);
	if (stateValue < toNumber(STATES.IMMUNE)) {
		return 'ascended';
	} else if (stateValue < toNumber(STATES.UNSTABLE)) {
		return 'immune';
	} else if (stateValue == toNumber(STATES.UNSTABLE)) {
		return 'unstable';
	} else {
		return 'infected';
	}

}

export function getAscendencyBonus(obj) {
	if (obj?.state) {
		const currentState = getState(obj);
		// Explicit tuning overrides
		const overrides = {
			[STATES.DAVEPRIME]: 20,
			[STATES.DOPE]: 12,
			[STATES.ASCENDED]: 10,
			[STATES.RESONANT]: 8,
			[STATES.IMMUNE]: 4
		};
		if (overrides[currentState] != null) {
			return overrides[currentState];
		}

		// Fallback formula for future inserted states
		const unstableIndex = toNumber(STATES.UNSTABLE);
		const stateIndex = toNumber(currentState);

		return Math.max(1, unstableIndex - stateIndex + 1);
	} else if (obj.level) {
		return obj.level;
	}
	return 1;
}

export function installAntivirus(dave) {
	const state = getIndex(dave);
	if (state < toNumber(STATES.IMMUNE)) {
		return;
	}

	dave.state = STATES.IMMUNE;
}


export function ascendUser(dave) {
	const state = getIndex(dave);
	if (state > toNumber(STATES.DOPE)) {
		dave.state = toState(state - 1);
		return true;
	}
	return false;
}

export function grantDavePrime(dave) {
	if (getIndex(dave) <= toNumber(STATES.DAVEPRIME)) {
		return false;
	}

	dave.state = STATES.DAVEPRIME;
	return true;
}

export function grantDavePrimeScanBonus(source, target) {
	if (!isDavePrime(target)) {
		return false;
	}

	return ascendUser(source);
}

export function setImmune(dave) {
	const state = getIndex(dave);
	if (state > toNumber(STATES.IMMUNE)) {
		dave.state = STATES.IMMUNE;
	}
}

export function hasPatchAbility(dave) {
	const state = getIndex(dave);
	return state <= toNumber(STATES.IMMUNE);
}

export function canPatch(dave) {
	return hasPatchAbility(dave);
}

export function canBePatched(dave) {
	return getState(dave) == STATES.UNSTABLE;
}

export function canAscend(me, dave) {
	if (me.fragmentsCollected?.includes(dave.userId)) {
		return false;
	}

	const myState = getIndex(me);
	const theirState = getIndex(dave);
	return myState <= toNumber(STATES.ASCENDED) && myState < theirState; 
}

export function isInfected(dave) {
	const state = getIndex(dave);
	return state >= toNumber(STATES.INFECTED); 
}

export function infect(dave) {
	if (getState(dave) == STATES.UNSTABLE) {
		dave.state = STATES.INFECTED;
		return true;
	}
	return false;
}

export function stabilize(dave) {
	//console.log("stabilizing");
	//console.log(JSON.stringify(dave, null, 2));

	if (getIndex(dave) >= toNumber(STATES.UNSTABLE)) {
		//console.log("\tunstable");
		dave.state = STATES.IMMUNE;
		return true;
	} 
	return false;
}


export function hasTag(dave, tag) {
	return Array.isArray(dave.tags) && dave.tags.includes(tag);
}

export function addTag(dave, tag) {
	if (!Array.isArray(dave.tags)) {
		dave.tags = [];
	}
	if (dave.tags.includes(tag)) {
		return false;		
	} else {
		dave.tags.push(tag); 
		return true;
	}
}

export function isTerritoryTag(tag) {
	return TERRITORY_TAGS.includes(tag);
}

export function getTerritoryScore(dave, places = {}) {
	if (!dave?.userId) {
		return 0;
	}

	return Object.values(places).reduce((score, place) => {
		if (place?.owner !== dave.userId) {
			return score;
		}

		return score + Math.max(1, Number(place.level ?? 0));
	}, 0);
}

export function getTerritoryRank(score) {
	let rank = null;

	for (const candidate of TERRITORY_RANKS) {
		if (score >= candidate.min) {
			rank = candidate;
		}
	}

	return rank;
}

export function syncTerritoryRank(dave, places = {}) {
	if (!dave) {
		return null;
	}
	if (!Array.isArray(dave.tags)) {
		dave.tags = [];
	}

	const rank = getTerritoryRank(getTerritoryScore(dave, places));
	dave.tags = dave.tags.filter(tag => !isTerritoryTag(tag));

	if (rank) {
		dave.tags.push(rank.tag);
	}

	return rank;
}

export function hasTerritoryRank(dave) {
	return Array.isArray(dave?.tags) && dave.tags.some(tag => isTerritoryTag(tag));
}

function canAfford(dave, cost) {
	return (dave.fragmentsCollected && dave.fragmentsCollected.length >= cost)
}

export function isDavePrime(dave) {
	return getIndex(dave) <= toNumber(STATES.DAVEPRIME)
}

export function canBypassNodeDistanceRestriction(dave) {
	const currentState = getState(dave);
	return currentState === STATES.DOPE || currentState === STATES.DAVEPRIME;
}

export function canDoonShift(source, target) {
	return hasTag(source, "doon") && getState(target) == STATES.INFECTED;
}

export function canGrantTag(source, target) {
	return isDavePrime(source) && source?.userId !== target?.userId;
}

export function canMakeBadDecision(source, target) {
	return hasTag(source, "peppercon") && hasTag(source, "GDIK") && canAscend(source, target);
}

export function canDecreaseStatus(source, target) {
	const sourceState = getState(source);
	return (
		source?.userId !== target?.userId &&
		(sourceState === STATES.INFECTED || sourceState === STATES.CORRUPTED) &&
		getIndex(target) < toNumber(STATES.CORRUPTED)
	);
}

export function getUserActions(source, target) {
	const state = getIndex(source);
	return {
		canInfect : getState(target) == STATES.UNSTABLE,
		canAscend : canAscend(source, target),
		hasPatchAbility : hasPatchAbility(source),
		canPatch : hasPatchAbility(source),
		canBePatched : canBePatched(target),
		hasFragments : canAfford(source, 1),
		canDaveputize : hasTerritoryRank(source) && ! hasTag(target, "doon"),
		canDoonShift : canDoonShift(source, target),
		canGrantDavePrime : isDavePrime(source) && !isDavePrime(target),
		canGrantTag : canGrantTag(source, target),
		canMakeBadDecision : canMakeBadDecision(source, target),
		canDecreaseStatus : canDecreaseStatus(source, target),
		davePrime:  isDavePrime(source),
	}
}

export function maxState(dave) {
	switch (getState(dave)) {
		case STATES.IMMUNE:
			return 3;
		case STATES.RESONANT:
			return 5;
		case STATES.ASCENDED:
			return 7;
		case STATES.DOPE:
			return 9;
		case STATES.DAVEPRIME:
			return 10;
	}
	return 0;
}

export function ascendency(dave) {
	const unstableIndex = toNumber(STATES.UNSTABLE);
	const daveIndex = getIndex(dave);

	if (daveIndex === -1 || daveIndex >= unstableIndex) {
		return 0;
	}

	return unstableIndex - daveIndex;
}

function canUpgrade(dave, place) {
	if (canAfford(dave, 1)) {
		if (place && place.level) {
			return place.level < maxState(dave);
		} else {
			return true;
		}
	}
}

const alcoholEmojis = ["🍺", "🍸", "🍷", "🥂", "🍹", "🍾", "🫖"];
const ITEM_COOLDOWN = 10 * 60 * 1000;
const DOON_PLACE_UPGRADE_COOLDOWN = 60 * 60 * 1000;

function normalizeItem(item) {
	return alcoholEmojis.includes(item) ? alcoholEmojis[0] : item;
}

export function canGet(dave, item) {
	/*
	if (getState(dave) == STATES.DAVEPRIME) {
		return true;
	}
	*/
	item = normalizeItem(item);

	const obj = dave[item];
	if (obj == null) {
		//console.log("missing, approved: " + item);
		return true;
	} else {
		const tenMinutesPastLastAcquisition =  obj.lastTime + ITEM_COOLDOWN;
		if (Date.now() >= tenMinutesPastLastAcquisition) {
			//console.log(Date.now() + " is above " + tenMinutesPastLastAcquisition + " so " + item + " approved")
			return true;
		} else {
			//console.log(item + " denied, timeout")
			return false;
		}
	}
}

export function getCooldownRemaining(dave, item) {
	item = normalizeItem(item);

	const obj = dave?.[item];
	if (obj == null || !Number.isFinite(obj.lastTime)) {
		return 0;
	}

	return Math.max(0, obj.lastTime + ITEM_COOLDOWN - Date.now());
}

export function formatCooldownRemaining(ms) {
	const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes > 0) {
		return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
	}
	return `${seconds}s`;
}

export function getDoonPlaceUpgradeCooldownRemaining(dave) {
	if (!Number.isFinite(dave?.lastDoonPlaceUpgradeTime)) {
		return 0;
	}

	return Math.max(0, dave.lastDoonPlaceUpgradeTime + DOON_PLACE_UPGRADE_COOLDOWN - Date.now());
}

export function canDoonUpgradePlace(dave, place) {
	if (!hasTag(dave, "doon") || getDoonPlaceUpgradeCooldownRemaining(dave) !== 0) {
		return false;
	}

	return !place?.level || place.level < maxState(dave);
}

export function getAmt(dave, item) {
	item = normalizeItem(item);
	const obj = dave[item];
	if (obj == null) {
		return 0;
	} else {
		if (obj.count) {
			return obj.count;
		} else {
			return 0;
		}
	}
}

export function add(dave, item) {
	item = normalizeItem(item);

	const now = Date.now();
	if (dave[item] == null) {
		dave[item] = { count: 1, lastTime: now };
	} else if (now - dave[item].lastTime > ITEM_COOLDOWN) {
		dave[item].count += 1;
		dave[item].lastTime = now;
	}
	return dave[item].count; 
	
}

export function getPlaceActions(dave, place) {
	const state = getIndex(dave);
	return {
		hasFragments : canAfford(dave, 1),
		canUpgrade : canUpgrade(dave, place),
		canDoonUpgrade : canDoonUpgradePlace(dave, place),
		doonUpgradeCooldownRemaining : getDoonPlaceUpgradeCooldownRemaining(dave),
		davePrime:  isDavePrime(dave),
	}
}
