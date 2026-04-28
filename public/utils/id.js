
export function getUserId() {
	let id = localStorage.getItem("davecon_user_id");

	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem("davecon_user_id", id);
	}

	return id;
}

