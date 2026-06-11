
export function getUserId() {
	let id = localStorage.getItem("davecon_user_id");

	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem("davecon_user_id", id);
	}

	return id;
}

export function getFragmentFrom(me, target) {
	const id = target.userId;

	if (!me.fragmentsCollected) {
		me.fragmentsCollected = [];
	}
	if (!me.fragmentsCollected.includes(id)) {
		me.fragmentsCollected.push(id);
		recordFragmentCollected(me);
		return true;
	} 
	return false;
}

export function getLifetimeTotal(dave, totalKey, currentKey) {
	const lifetimeTotal = Number(dave?.[totalKey]);
	const currentTotal = Array.isArray(dave?.[currentKey]) ? dave[currentKey].length : 0;
	return Math.max(Number.isFinite(lifetimeTotal) ? lifetimeTotal : 0, currentTotal);
}

export function recordFragmentCollected(dave, count = 1) {
	const lifetimeTotal = Number(dave?.totalFragmentsCollected);
	const currentTotal = Array.isArray(dave?.fragmentsCollected) ? dave.fragmentsCollected.length : 0;
	dave.totalFragmentsCollected = Number.isFinite(lifetimeTotal)
		? Math.max(lifetimeTotal + count, currentTotal)
		: currentTotal;
	return dave.totalFragmentsCollected;
}

export function recordInfectionSpread(dave, count = 1) {
	const lifetimeTotal = Number(dave?.totalInfectionsSpread);
	const currentTotal = Array.isArray(dave?.infectedUsers) ? dave.infectedUsers.length : 0;
	dave.totalInfectionsSpread = Number.isFinite(lifetimeTotal)
		? Math.max(lifetimeTotal + count, currentTotal)
		: currentTotal;
	return dave.totalInfectionsSpread;
}
