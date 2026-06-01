import { getUserId, isDebugId } from './utils/id.js';
import { getItemsForSource, displayItems } from './utils/itemUI.js';
import { getAscensionText } from "./utils/placesUI.js";
import { bindLogEvents } from './utils/log.js';
import { addMap } from './utils/map.js';
import * as dod from "./utils/dod.js";
import * as state from "./utils/state.js";

const userId = getUserId();
const socket = io({
    auth: {
        userId: userId
    }
});

const params = new URLSearchParams(window.location.search);
const placeId = params.get("id");
const isDebugUser = isDebugId(userId);
const DRINK_ITEM = "🍺";

let map;

bindLogEvents(socket);

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
	//console.log("teleport: " + payload);
	await fetch('/api/teleport', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload
	});

	window.location.href = "/";
}

async function deconstructPlace() {
	//console.log("deconstructing: " + placeId);
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

function getItem(item) {
	const payload = JSON.stringify({
		source: userId,
		item: item,
	});

	socket.emit("getItem", userId, item);
	location.reload()
}

function addActions(actionHtml) {
	const actionsContainer = document.getElementById("actions");

	actionsContainer.innerHTML = actionHtml;

	actionsContainer.onclick = (e) => {
		const action = e.target.dataset.action;
		//console.log("onClick: " + action);
		if (!action) return;

		switch (action) {
			case "placeAction":
				const item = e.target.dataset.item;
				getItem(item);
				break;
			case "dod":
				window.location.href = `/dod-application.html?placeId=${encodeURIComponent(placeId)}`;
				break;
			case "dodConsole":
				window.location.href = "/dod.html";
				break;
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

	//console.log("loading: " + JSON.stringify(payload, null, 2));


	// --- Populate fields ---
	const nameElement = document.getElementById("name");

	if (place.owner == userId) {
		const input = document.createElement("input");
		input.type = "text";
		input.value = place.name;
		input.id = "nameInput";

		const button = document.createElement("button");
		button.id = "setIdBtn";
		button.textContent = "Set Node Name";

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

	let statHtml = ""
	if (place.level) {
		statHtml += `
		<div class="field">
			<span class="label">Level</span>
			<span>${place.level}</span>
		</div>
		<br />
		`
	}

	const characters = [...place.name]; // Splits correctly by Unicode code points
	const firstEmoji = characters.find(char => /\p{Extended_Pictographic}/u.test(char));

	statHtml += `
		<div class="field">
			<span class="label">🧬Fragments available</span>
			<span>${fragments}</span>
		</div>`

	if (firstEmoji) {
		statHtml += displayItems (dave, firstEmoji);
	}

	document.getElementById("stats").innerHTML = statHtml;

	let actionHtml = "";

	if (firstEmoji == '🛡') {
		let dodLevel = dod.getLevel(dave);
		switch(dodLevel) {
			case 0:
				actionHtml += `<button data-action="dod">Apply to the Department of Davefence</button>`   
				break;
			default:
				actionHtml += `<button data-action="dodConsole">Department of Davefence Console</button>`   
				break;
		}
	}

	if (place.mapData.inRange) {
		if (firstEmoji == '☠' && !state.hasTag(dave, "linecon")) {
			actionHtml += `<button data-action="joinLinecon">Join linecon</button>`;
		}

		if (place.name?.includes("Circus Circus")) {
			const available = state.canGet(dave, DRINK_ITEM);
			const remaining = state.formatCooldownRemaining(state.getCooldownRemaining(dave, DRINK_ITEM));
			actionHtml += available
				? `<button data-action="circusCircusParking">Is this not a reasonable place to park?</button>`
				: `<button disabled>Is this not a reasonable place to park? (${remaining})</button>`;
		}

		if (place.availableActions.canUpgrade) {
			actionHtml += `<button data-action="upgradeDavePoint">Daveify This Spot</button> `   
		} else {
			actionHtml += `<button disabled=true>Daveify This Spot  (Need more Davefluence)</button> `   
		}

		const stateAscension = getAscensionText(dave, place);
		if (stateAscension != "") {
			actionHtml += `<button data-action="ascendAtNode">${stateAscension}</button>`   
		}



		for (const rule of getItemsForSource(firstEmoji)) {
			const available = state.canGet(dave, rule.item);
			const remaining = state.formatCooldownRemaining(state.getCooldownRemaining(dave, rule.item));
			//console.log("canget:  " + rule.item + " avail " + available);

			actionHtml += available
					? `<button data-action="placeAction" data-item="${rule.item}"> ${rule.getLabel} </button>`
					: `<button disabled> ${rule.getLabel} (${remaining}) </button>`;
		}
	} else {
		actionHtml += "OUT OF RANGE";
	}
	if (place.owner == userId) {
		actionHtml += `<button data-action="deconstructNode">Deconstruct node</button> `   
	} 
	if (isDebugUser) {
		actionHtml += `<button data-action="teleport">Teleport</button>`;
	}
	addActions(actionHtml);

	map = addMap(place.mapData, { socket });
}


loadPlace();
