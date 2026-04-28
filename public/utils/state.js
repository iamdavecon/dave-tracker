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

export function getDefaultState() {
	return STATES.UNSTABLE;
}

export function getRandomState() {
	const values = Object.values(STATES);
	const i = Math.floor(Math.random() * values.length);
	return values[i];
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

function getIndex(dave) {
	return Object.values(STATES).indexOf(getState(dave))
}

export function installAntivirus(dave) {
	const state = getIndex(dave);
	if (state < STATES.IMMUNE) {
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
	if (state > STATES.ASCENDED) {
		dave.state = STATES.ASCENDED;
	}
}

export function setImmune(dave) {
	const state = getIndex(dave);
	if (state > STATES.IMMUNE) {
		dave.state = STATES.IMMUNE;
	}
}

export function canPatch(dave) {
	const state = getIndex(dave);
	return state < STATES.IMMUNE;
}

export function canAscend(dave) {
	const state = getIndex(dave);
	return state < STATES.ASCENDED; 
}

export function isInfected(dave) {
	const state = getIndex(dave);
	return state >= STATES.INFECTED; 
}

export function infect(dave) {
	if (dave.state == STATES.UNSTABLE) {
		dave.state = STATES.INFECTED;
		return true;
	}
	return false;
}

export function stabilize(dave) {
	if (dave.state == STATES.PATCHED) {
		dave.patches = (dave.patches ?? 0) + 1;
		if (dave.patches >= 5) {
			dave.state = STATES.IMMUNE;
		}
	} if (dave.state >= STATES.UNSTABLE) {
		dave.state = STATES.PATCHED;
		return true;
	}
	return false;
}


export function hasTag(dave, tag) {
	return (dave.tags && tag in dave.tags) 
}

export function getActions(source, target) {
	const state = getIndex(source);
	return {
		canInfect : target.state == STATES.UNSTABLE,
		canAscend : canAscend(source),
		canDaveputize : hasTag(source, "mayor"),
		//DEBUGGING:
		davePrime:  true,  //  state <= STATES.DAVEPRIME,

	}
}

