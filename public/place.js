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

async function deconstructPlace() {
	console.log("deconstructing: " + placeId);
	const res = await fetch(`/api/places/${placeId}/deconstruct`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
		userId: userId,
		}),
	});

	const result = await res.json();

	if (!result.ok) {
		alert(result.error || "failed to deconstruct node");
		return;
	}

	window.location.href = "/";
}

function addActions(actionHtml) {
	const actionsContainer = document.getElementById("actions");

	actionsContainer.innerHTML = actionHtml;

	actionsContainer.onclick = (e) => {
		const action = e.target.dataset.action;
		console.log("onClick: " + action);
		if (!action) return;

		switch (action) {

			case "teleport":
				teleport();
				break;
			case "deconstructNode":
				deconstructPlace();
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
	const nameElement = document.getElementById("name");

	if (place.owner == userId) {
		const input = document.createElement("input");
		input.type = "text";
		input.value = place.name;
		input.id = "nameInput";

		const button = document.createElement("button");
		button.id = "setIdBtn";
		button.textContent = "Set Name";

		nameElement.innerHTML = "";
		nameElement.appendChild(input);
		nameElement.appendChild(button);
		nameElement.className = "input-row";

		// Handle button click
		button.onclick = () => {
			const newName = input.value;
			socket.emit("setPlaceName", userId, placeId, newName);
			place.name = newName;

			// Optionally update display after setting
			nameElement.textContent = newName;
		};
	} else {
		nameElement.textContent = place.name;
	}

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
	
		if (place.name.endsWith("Tacos El Gordo")) {
			if (place.availableActions.canGetTaco) {
				actionHtml += `<button data-action="getTaco">Get a Taco</button> `   
			} else {
				actionHtml += `<button disabled=true>Get a Taco (on cooldown)</button> `   
			}
		} else if (place.name.endsWith("Slots A Fun")) {
			if (place.availableActions.canGetHotdog) {
				actionHtml += `<button data-action="getHotdog">Get a Hotdog</button> `   
			} else {
				actionHtml += `<button disabled=true>Get a Hotdog (on cooldown)</button> `   
			}
		} 
	} else {
		actionHtml += "OUT OF RANGE";
	}
	if (place.owner == userId) {
		actionHtml += `<button data-action="deconstructNode">Deconstruct node</button> `   
	} 
	if (place.availableActions.davePrime) {
		actionHtml += `<button data-action="teleport">Teleport & Free Roam</button>`;
	}
	addActions(actionHtml);

	map = addMap(place.mapData);
}


loadPlace();

