
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
		return true;
	} 
	return false;
}
