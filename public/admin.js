import { getUserId } from './utils/id.js';
import * as state from './utils/state.js';
import { parseLandmarkInput } from './utils/adminPlaces.js';

const userId = getUserId();
const socket = io({
	auth: {
		userId
	}
});

const nameEl = document.getElementById("adminName");
const rankEl = document.getElementById("adminRank");
const statusEl = document.getElementById("adminStatus");
const backLink = document.getElementById("backLink");
const usersJsonEl = document.getElementById("usersJson");
const placesJsonEl = document.getElementById("placesJson");
const landmarkInputEl = document.getElementById("landmarkInput");

backLink.href = `/player.html?id=${encodeURIComponent(userId)}&viewerId=${encodeURIComponent(userId)}`;

function setButtonsEnabled(enabled) {
	document.querySelectorAll("button[data-action]").forEach((button) => {
		button.disabled = !enabled;
	});
}

async function loadAdmin() {
	const res = await fetch(`/api/dave?id=${encodeURIComponent(userId)}&viewerId=${encodeURIComponent(userId)}`);
	const dave = await res.json();

	if (!res.ok) {
		nameEl.textContent = "Dave unavailable";
		rankEl.textContent = "...";
		statusEl.textContent = dave.error ?? "Unable to load admin controls.";
		setButtonsEnabled(false);
		return;
	}

	nameEl.textContent = dave.name;
	rankEl.textContent = state.getState(dave).toUpperCase();

	if (!dave.isDebugUser) {
		statusEl.textContent = "Admin controls are only available to debug users.";
		setButtonsEnabled(false);
		return;
	}

	statusEl.textContent = "";
	setButtonsEnabled(true);
}

async function callAdminEndpoint(path, pendingText, doneText, payload = {}, options = {}) {
	statusEl.textContent = pendingText;

	let res;
	let result;
	try {
		res = await fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId, ...payload })
		});
		result = await res.json();
	} catch (error) {
		const message = `Admin action failed: ${error.message}`;
		statusEl.textContent = message;
		if (options.popup) {
			alert(message);
		}
		return false;
	}

	if (!res.ok || !result.ok) {
		const message = result.error ?? `Admin action failed (${res.status}).`;
		statusEl.textContent = message;
		if (options.popup) {
			alert(message);
		}
		return false;
	}

	const message = doneText(result);
	statusEl.textContent = message;
	if (options.popup) {
		alert(message);
	}
	await loadAdmin();
	statusEl.textContent = message;
	return true;
}

function parseJsonTextarea(textarea, label) {
	const value = textarea.value.trim();
	if (!value) {
		statusEl.textContent = `${label} JSON is empty.`;
		return null;
	}

	try {
		return JSON.parse(value);
	} catch (error) {
		statusEl.textContent = `${label} JSON is invalid: ${error.message}`;
		return null;
	}
}

async function getActivePlaces() {
	const res = await fetch("/api/data");
	const data = await res.json();
	if (!res.ok) {
		throw new Error(data.error ?? `Unable to load places (${res.status}).`);
	}
	if (!data.places || typeof data.places !== "object" || Array.isArray(data.places)) {
		throw new Error("Active places are unavailable.");
	}
	return data.places;
}

document.addEventListener("click", (e) => {
	const action = e.target.dataset.action;
	if (!action) return;

	if (action === "increaseRank" || action === "decreaseRank") {
		statusEl.textContent = action === "increaseRank" ? "Increasing rank..." : "Decreasing rank...";
		socket.emit(action, userId);
		return;
	}

	if (action === "grantRandomFragments" || action === "grantRandomInfectedUsers") {
		const label = action === "grantRandomFragments" ? "fragments" : "infected users";
		statusEl.textContent = `Adding 10 random ${label}...`;
		socket.emit(action, userId, (result) => {
			statusEl.textContent = result?.ok
				? `Added 10 random ${label}.`
				: (result?.error || `Unable to add random ${label}.`);
		});
		return;
	}

	if (action === "saveUsers") {
		callAdminEndpoint(
			"/api/admin/save-users",
			"Saving users...",
			(result) => result.changed ? "Users saved." : "Users already up to date."
		);
		return;
	}

	if (action === "loadUsers") {
		callAdminEndpoint(
			"/api/admin/load-users",
			"Loading users...",
			() => "Users loaded."
		);
		return;
	}

	if (action === "updateUsers") {
		const users = parseJsonTextarea(usersJsonEl, "Users");
		if (!users) {
			alert(statusEl.textContent);
			return;
		}

		callAdminEndpoint(
			"/api/admin/update-users",
			"Updating users...",
			(result) => result.changed ? "Users updated." : "Users already matched pasted content.",
			{ users },
			{ popup: true }
		);
		return;
	}

	if (action === "updatePlaces") {
		const places = parseJsonTextarea(placesJsonEl, "Places");
		if (!places) return;

		callAdminEndpoint(
			"/api/admin/update-places",
			"Updating places...",
			(result) => result.changed ? "Places updated." : "Places already matched pasted content.",
			{ places }
		);
		return;
	}

	if (action === "addLandmark") {
		const parsed = parseLandmarkInput(landmarkInputEl.value);
		if (parsed.error) {
			statusEl.textContent = parsed.error;
			return;
		}

		statusEl.textContent = "Adding landmark...";
		getActivePlaces()
			.then((places) => {
				const nextPlaces = { ...places, [parsed.place.id]: parsed.place };
				placesJsonEl.value = JSON.stringify(nextPlaces, null, 2);
				return callAdminEndpoint(
					"/api/admin/update-places",
					"Adding landmark...",
					() => `Added ${parsed.place.name}.`,
					{ places: nextPlaces }
				);
			})
			.then((added) => {
				if (added) {
					landmarkInputEl.value = "";
				}
			})
			.catch((error) => {
				statusEl.textContent = `Unable to add landmark: ${error.message}`;
			});
	}
});

socket.on("update", () => {
	loadAdmin();
});

loadAdmin();
