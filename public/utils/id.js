
export function getUserId() {
	let id = localStorage.getItem("davecon_user_id");

	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem("davecon_user_id", id);
	}

	return id;
}

export function isDebugId(id) {
	return id == "59a388e8-413a-4d8e-906e-15469bb3b471" 
	|| id == "629603fc-58fa-49c9-ba98-cfc391b82569";
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
