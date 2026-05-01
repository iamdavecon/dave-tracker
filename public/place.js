import { getUserId } from './utils/id.js';
import { logEvent } from './utils/log.js';
import { addMap } from './utils/map.js';
import * as state from "./utils/state.js";

const userId = getUserId();
const socket = io({
    auth: {
        userId: userId
    }
});

const params = new URLSearchParams(window.location.search);
const placeId = params.get("id");

let map;

function emit(event) {
	socket.emit(event, userId, placeId);
	location.reload()
}

async function teleport() {
	const payload = JSON.stringify({
		source: userId,
		targetId: placeId,
		targetType: "place",
	});
	console.log("teleport: " + payload);
	await fetch('/api/teleport', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload
	});

	//logEvent("Teleported");
	window.location.href = "/";
}

function addActions(actionHtml) {
	const actionsContainer = document.getElementById("actions");

	actionsContainer.innerHTML = actionHtml;

	actionsContainer.onclick = (e) => {
		const action = e.target.dataset.action;
		if (!action) return;

		switch (action) {

			case "teleport":
				teleport();
				break;
			default:
				emit(action);
		}
	};
}

async function loadPlace() {
	if (!placeId) return;

	const res = await fetch(`/api/place?id=${encodeURIComponent(placeId)}&viewerId=${encodeURIComponent(userId)}`);
	const payload = await res.json();
	const { place, dave } = payload;

	console.log("loading: " + JSON.stringify(payload, null, 2));


	// --- Populate fields ---
	document.getElementById("name").textContent = place.name;

	let fragments = 0;
	if (dave.fragmentsCollected) {
		fragments = dave.fragmentsCollected.length;
	}

	let statHtml = `
		<div class="field">
			<span class="label">🧬Fragments available</span>
			<span>${fragments}</span>
		</div>`

	if (place.level) {
		statHtml += `
		<br />
		<div class="field">
			<span class="label">Level</span>
			<span>${place.level}</span>
		</div>`



	}
	document.getElementById("stats").innerHTML = statHtml;

	let actionHtml = "";
	if (place.mapData.inRange) {
		if (place.availableActions.canUpgrade) {
			actionHtml += `<button data-action="upgradeDavePoint">Daveify This Spot</button> `   
		} else {
			actionHtml += `<button disabled=true>Daveify This Spot  (Need more Davefluence)</button> `   
		}
	} else {
		actionHtml += "OUT OF RANGE";
	}
	if (place.availableActions.davePrime) {
		actionHtml += `<button data-action="teleport">Teleport & Free Roam</button>`;
	}
	addActions(actionHtml);

	map = addMap(place.mapData);
}


loadPlace();

