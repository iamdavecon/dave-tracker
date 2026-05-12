const STATES = {
	DAVEPRIME: "daveprime",
	DOPE: "dope",
	ASCENDED: "ascended",
	AWAKENING: "awakening",
	IMMUNE: "immune",
	PATCHED: "patched",
	UNSTABLE: "unstable",
	INFECTED: "infected",
	CORRUPTED: "corrupted",
	VOIDED: "voided"
};
const STATE_LIST = Object.values(STATES);

function toNumber(state) {
	return STATE_LIST.indexOf(state);
}

function toState(index) {
	return STATE_LIST[index] ?? null;
}

function getIndex(dave) {
	return toNumber(getState(dave));
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
		{ state: STATES.UNSTABLE, weight: 0.7 },
		{ state: STATES.CORRUPTED, weight: 0.2 },
		{ state: STATES.VOIDED, weight: 0.1 }
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
		return getState(dave);
	}

	return toState(currentIndex - 1);
}

export function decreaseRank(dave) {
	const currentIndex = getIndex(dave);

	// lower rank = higher index
	if (currentIndex >= STATE_LIST.length - 1) {
		return getState(dave);
	}

	return toState(currentIndex + 1);
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

export function ascendencyIndex(dave) {
	// Explicit tuning overrides
	const overrides = {
		[STATES.DAVEPRIME]: 20,
		[STATES.DOPE]: 10,
		[STATES.ASCENDED]: 8,
		[STATES.AWAKENING]: 6,
		[STATES.IMMUNE]: 4,
		[STATES.PATCHED]: 2
	};

	if (overrides[dave.state] != null) {
		return overrides[dave.state];
	}

	// Fallback formula for future inserted states
	const unstableIndex = toNumber(STATES.UNSTABLE);
	const stateIndex = toNumber(dave.state);

	return Math.max(1, unstableIndex - stateIndex + 1);
}

export function installAntivirus(dave) {
	const state = getIndex(dave);
	if (state < toNumber(STATES.IMMUNE)) {
		return;
	}  else {
		const chance = Math.random(); 

		if (chance < 0.2) {
			// 20% chance for IMMUNE
			dave.state = STATES.IMMUNE;
		} else {
			// 80% chance for PATCHED
			dave.state = STATES.PATCHED;
		}
	}
}


export function ascendUser(dave) {
	const state = getIndex(dave);
	if (state > 1 && state > toNumber(STATES.ASCENDED)) {
		dave.state = toState(state - 1);
		return true;
	}
	return false;
}

export function setImmune(dave) {
	const state = getIndex(dave);
	if (state > toNumber(STATES.IMMUNE)) {
		dave.state = STATES.IMMUNE;
	}
}

export function canPatch(dave) {
	const state = getIndex(dave);
	return state <= toNumber(STATES.PATCHED);
}

export function canAscend(dave) {
	const state = getIndex(dave);
	return state <= toNumber(STATES.ASCENDED); 
}

export function isInfected(dave) {
	const state = getIndex(dave);
	return state >= toNumber(STATES.INFECTED); 
}

export function infect(dave) {
	if (dave.state == STATES.UNSTABLE) {
		dave.state = STATES.INFECTED;
		return true;
	}
	return false;
}

export function stabilize(dave) {
	//console.log("stabilizing");
	console.log(JSON.stringify(dave, null, 2));

	if (dave.state == STATES.PATCHED) {
		//console.log("\tpatched");
		dave.patches = (dave.patches ?? 0) + 1;
		if (dave.patches >= 2) {
			dave.state = STATES.IMMUNE;
		}
	} if (getIndex(dave) >= toNumber(STATES.UNSTABLE)) {
		//console.log("\tunstable");
		dave.state = STATES.PATCHED;
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

function canAfford(dave, cost) {
	return (dave.fragmentsCollected && dave.fragmentsCollected.length >= cost)
}

export function isDavePrime(dave) {
	return getIndex(dave) <= toNumber(STATES.DAVEPRIME)
}

export function getUserActions(source, target) {
	const state = getIndex(source);
	return {
		canInfect : target.state == STATES.UNSTABLE,
		canAscend : canAscend(source),
		canPatch : canPatch(source),
		canBePatched : target.state == STATES.UNSTABLE,
		hasFragments : canAfford(source, 1),
		canDaveputize : hasTag(source, "mayor") && ! hasTag(target, "doon"),
		davePrime:  isDavePrime(source),
	}
}

function maxState(dave) {
	switch (dave.state) {
		case STATES.IMMUNE:
			return 2;
		case STATES.AKAKENING:
			return 4;
		case STATES.ASCENDED:
			return 8;
		case STATES.DOPE:
			return 32;
		case STATES.DAVEPRIME:
			return 64;
	}
	return 0;
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

export function canGet(dave, item) {
	if (dave.state == STATES.DAVEPRIME) {
		return true;
	}
	if (item in alcoholEmojis) {
		item = alcoholEmojis[0];
	}

	const obj = dave[item];
	if (obj == null) {
		console.log("missing, approved: " + item);
		return true;
	} else {
		const tenMinutesMs = 10 * 60 * 1000;
		if (obj.lastTime >= tenMinutesMs) {
			console.log(item + " approved")
			return true;
		} else {
			console.log(item + " denied, timeout")
			return false;
		}
	}
}

export function getAmt(dave, item) {
	if (item in alcoholEmojis) {
		item = alcoholEmojis[0];
	}
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
	const now = Date.now();
	const TEN_MINUTES = 10 * 60 * 1000;

	if (dave[item] == null) {
		dave[item] = { count: 1, lastTime: now };
	} else if (now - dave[item].lastTime > TEN_MINUTES) {
		dave[item].count += 1;
		dave[item].lastTime = now;
		//console.log("add1:  " + dave[item].lastTime);
	}
	return dave[item]; 
	
}

export function getPlaceActions(dave, place) {
	const state = getIndex(dave);
	return {
		hasFragments : canAfford(dave, 1),
		canUpgrade : canUpgrade(dave, place),
		davePrime:  isDavePrime(dave),
	}
}

