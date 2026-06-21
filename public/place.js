import { getUserId } from './utils/id.js';
import { getItemsForSource, displayItems } from './utils/itemUI.js';
import { BABY_ITEM } from './utils/babies.js';
import {
	canAttemptPlaceFragmentChallenge,
	canReceiveHackerJeopardyBaby,
	formatPlaceChallengePrompt,
	getHackerJeopardyBabyCooldownRemaining,
	getPlaceFragmentChallengeCooldownRemaining,
	getPlaceFragmentChallengeForAction,
	getPlaceFragmentChallengeForPlaceName,
	getRandomPlaceChallengeQuestion,
	shufflePlaceChallengeOptions
} from './utils/placeChallenges.js';
import {
	canAttemptTacoGame,
	formatTacoGamePrompt,
	getRandomTacoGameQuestion,
	getTacoGameCooldownRemaining,
	shuffleTacoGameOptions,
	TACO_ITEM
} from './utils/tacoGame.js';
import { getAscensionText } from "./utils/placesUI.js";
import { bindLogEvents } from './utils/log.js';
import { addMap } from './utils/map.js';
import { rangesOverlap } from "./utils/distance.js";
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
let isDebugUser = false;
const DRINK_ITEM = "\u{1F37A}";
const COCKTAIL_ITEM = "\u{1F378}";
const BEACH_BALL_ITEM = "\u{1F3D0}";
const SAO_ITEM = "\u{131F2}";

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

function getAdminActionHtml() {
	return `<button data-action="admin">su root</button>`;
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
	socket.emit("getItem", userId, placeId, item);
	location.reload()
}

function openDrinkGame() {
	window.location.href = `/drink-game.html?placeId=${encodeURIComponent(placeId)}&returnTo=${encodeURIComponent(window.location.href)}`;
}

function openSolderingGame() {
	window.location.href = `/soldering-game.html?placeId=${encodeURIComponent(placeId)}&returnTo=${encodeURIComponent(window.location.href)}`;
}

function getLineconUrl() {
	return `/linecon.html?placeId=${encodeURIComponent(placeId)}`;
}

function getPirateVoyageUrl(mode = "join") {
	return `/pirates/pirate-voyage.html?placeId=${encodeURIComponent(placeId)}&mode=${encodeURIComponent(mode)}`;
}

function getResolveSignalUrl() {
	return `/resolve-signal.html?placeId=${encodeURIComponent(placeId)}`;
}

function getItemCountRow(dave, item, label, href = "") {
	const amount = state.getAmt(dave, item);
	const content = `
		<span class="label">${label}</span>
		<span>${amount}</span>`;

	if (amount > 0 && href) {
		return `<a class="field item-row" href="${href}">${content}</a>`;
	}

	return `<div class="field">${content}</div>`;
}

function getPlaceGrantItemStats(dave, place, firstEmoji, fragmentChallenge, isLineconNode) {
	let html = "";

	if (place.name?.includes("Circus Circus") && firstEmoji !== COCKTAIL_ITEM) {
		html += getItemCountRow(dave, DRINK_ITEM, "🍺 Drinks");
	}

	if (fragmentChallenge?.action === "hackerJeopardy") {
		const babyHref = `/babies.html?id=${encodeURIComponent(dave.userId || userId)}&viewerId=${encodeURIComponent(userId)}`;
		html += getItemCountRow(dave, BABY_ITEM, "👶 Babies", babyHref);
	}

	if (fragmentChallenge?.action === "hardwareHacking") {
		html += getItemCountRow(dave, SAO_ITEM, "𓇲 SAOs");
	}

	if (isLineconNode) {
		html += getItemCountRow(dave, BEACH_BALL_ITEM, "🏐 Beach Balls", getLineconUrl());
	}

	return html;
}

function openLinecon() {
	window.location.href = getLineconUrl();
}

function openPirateVoyage(mode = "join") {
	window.location.href = getPirateVoyageUrl(mode);
}

function stopPirateVoyage() {
	let handled = false;

	socket.emit("stopPirateVoyage", userId, placeId, (result) => {
		handled = true;
		if (!result?.ok) {
			alert(result?.error || "Unable to stop the voyage.");
			return;
		}
		location.reload();
	});

	setTimeout(() => {
		if (!handled) {
			location.reload();
		}
	}, 800);
}

function joinLinecon() {
	let handled = false;

	socket.emit("joinLinecon", userId, placeId, (result) => {
		handled = true;
		if (!result?.ok) {
			alert(result?.error || "LineCon is not available here");
			return;
		}
		openLinecon();
	});

	setTimeout(() => {
		if (!handled) {
			openLinecon();
		}
	}, 500);
}

function claimPlaceFragmentChallenge(action) {
	const challenge = getPlaceFragmentChallengeForAction(action);
	const question = getRandomPlaceChallengeQuestion(challenge);
	if (!challenge || !question) return;

	const options = shufflePlaceChallengeOptions(question);
	const answer = prompt(formatPlaceChallengePrompt(challenge, question, options));
	if (answer == null) return;

	const selectedIndex = Number.parseInt(answer.trim(), 10) - 1;
	const selectedAnswer = Number.isInteger(selectedIndex) && options[selectedIndex]
		? options[selectedIndex]
		: answer;

	let handled = false;
	socket.emit("claimPlaceFragmentChallenge", userId, placeId, action, question.id, selectedAnswer, async (result) => {
		handled = true;
		location.reload();
	});

	setTimeout(() => {
		if (!handled) {
			location.reload();
		}
	}, 800);
}

function claimHackerJeopardyBaby() {
	let handled = false;
	socket.emit("claimHackerJeopardyBaby", userId, placeId, (result) => {
		handled = true;
		if (!result?.ok) {
			alert(result?.error || "Unable to receive a baby.");
			return;
		}
		if (result?.plasticBabyPass) {
			window.location.href = `/baby-pass.html?claim=plasticBabyPass&returnTo=${encodeURIComponent(window.location.href)}`;
			return;
		}
		location.reload();
	});

	setTimeout(() => {
		if (!handled) {
			location.reload();
		}
	}, 800);
}

function playTacoGame() {
	const question = getRandomTacoGameQuestion();
	if (!question) return;

	const options = shuffleTacoGameOptions(question);
	const answer = prompt(formatTacoGamePrompt(question, options));
	if (answer == null) return;

	const selectedIndex = Number.parseInt(answer.trim(), 10) - 1;
	const selectedAnswer = Number.isInteger(selectedIndex) && options[selectedIndex]
		? options[selectedIndex]
		: answer;

	socket.emit("claimTacoGame", userId, placeId, question.id, selectedAnswer);
	location.reload();
}

function addActions(actionHtml) {
	const actionsContainer = document.getElementById("actions");

	actionsContainer.innerHTML = actionHtml;

	actionsContainer.onclick = (e) => {
		const action = e.target.dataset.action;
		//console.log("onClick: " + action);
		if (!action) return;

		switch (action) {
			case "admin":
				window.location.href = "/admin.html";
				break;
			case "placeAction":
				const item = e.target.dataset.item;
				getItem(item);
				break;
			case "drinkGame":
				openDrinkGame();
				break;
			case "solderingGame":
				openSolderingGame();
				break;
			case "placeFragmentChallenge":
				claimPlaceFragmentChallenge(e.target.dataset.challengeAction);
				break;
			case "hackerJeopardyBaby":
				claimHackerJeopardyBaby();
				break;
			case "tacoGame":
				playTacoGame();
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
			case "joinLinecon":
				joinLinecon();
				break;
			case "playLinecon":
				openLinecon();
				break;
			case "launchPirateVoyage":
				openPirateVoyage("launch");
				break;
			case "joinPirateVoyage":
				openPirateVoyage("join");
				break;
			case "stopPirateVoyage":
				stopPirateVoyage();
				break;
			case "resolveSignal":
				window.location.href = getResolveSignalUrl();
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
	const { place, dave, voyage } = payload;
	isDebugUser = !!payload.isDebugUser;

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
	const fragmentChallenge = getPlaceFragmentChallengeForPlaceName(place.name);
	const isLineconNode = firstEmoji == '☠' || /def\s*con|line\s*con|linecon/i.test(place.name ?? "");

	statHtml += `
		<div class="field">
			<span class="label">🧬Fragments available</span>
			<span>${fragments}</span>
		</div>
		<div class="field">
			<span class="label">DoD Level</span>
			<span>${dod.getLevel(dave)}</span>
		</div>`

	if (firstEmoji) {
		statHtml += displayItems (dave, firstEmoji);
	}
	statHtml += getPlaceGrantItemStats(dave, place, firstEmoji, fragmentChallenge, isLineconNode);

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

	const placeInRange = place.mapData?.inRange || rangesOverlap(dave, place);
	place.mapData.inRange = placeInRange;

	if (placeInRange) {
		if (isLineconNode) {
			actionHtml += state.hasTag(dave, "linecon")
				? `<button data-action="playLinecon">Join LineCon</button>`
				: `<button data-action="joinLinecon">Join LineCon</button>`;
		}

		if (place.name?.includes("Circus Circus")) {
			const available = state.canGet(dave, DRINK_ITEM);
			const remaining = state.formatCooldownRemaining(state.getCooldownRemaining(dave, DRINK_ITEM));
			actionHtml += available
				? `<button data-action="circusCircusParking">Is this not a reasonable place to park?</button>`
				: `<button disabled>Is this not a reasonable place to park? (${remaining})</button>`;
		}

		if (fragmentChallenge) {
			const available = canAttemptPlaceFragmentChallenge(dave, fragmentChallenge);
			const remaining = state.formatCooldownRemaining(getPlaceFragmentChallengeCooldownRemaining(dave, fragmentChallenge));
			const challengeAction = fragmentChallenge.action === "hardwareHacking"
				? "solderingGame"
				: "placeFragmentChallenge";
			const challengeData = fragmentChallenge.action === "hardwareHacking"
				? ""
				: ` data-challenge-action="${fragmentChallenge.action}"`;
			const challengeLabel = fragmentChallenge.action === "hardwareHacking"
				? "Solder an SAO"
				: fragmentChallenge.label;
			actionHtml += available
				? `<button data-action="${challengeAction}"${challengeData}>${challengeLabel}</button>`
				: `<button disabled>${challengeLabel} (${remaining})</button>`;

			if (fragmentChallenge.action === "hackerJeopardy") {
				const babyAvailable = canReceiveHackerJeopardyBaby(dave);
				const babyRemaining = state.formatCooldownRemaining(getHackerJeopardyBabyCooldownRemaining(dave));
				actionHtml += babyAvailable
					? `<button data-action="hackerJeopardyBaby">Receive a baby</button>`
					: `<button disabled>Receive a baby (${babyRemaining})</button>`;
			}
		}

		if (firstEmoji === TACO_ITEM) {
			const available = canAttemptTacoGame(dave);
			const remaining = state.formatCooldownRemaining(getTacoGameCooldownRemaining(dave));
			actionHtml += available
				? `<button data-action="tacoGame">Taco Calibration</button>`
				: `<button disabled>Taco Calibration (${remaining})</button>`;
		}

		if (place.availableActions.canUpgrade) {
			actionHtml += `<button data-action="upgradeDavePoint">Daveify This Spot</button> `   
		} else {
			actionHtml += `<button disabled=true>Daveify This Spot  (Need more Davefluence)</button> `   
		}

		if (state.hasTag(dave, "doon")) {
			if (place.availableActions.canDoonUpgrade) {
				actionHtml += `<button data-action="doonUpgradePlace">Doonify This Spot</button>`;
			} else {
				const remaining = state.formatCooldownRemaining(place.availableActions.doonUpgradeCooldownRemaining);
				actionHtml += `<button disabled>Doonify This Spot (${remaining})</button>`;
			}
		}

		const stateAscension = getAscensionText(dave, place);
		if (stateAscension != "") {
			actionHtml += `<button data-action="ascendAtNode">${stateAscension}</button>`   
		}



		for (const rule of getItemsForSource(firstEmoji)) {
			const action = firstEmoji === COCKTAIL_ITEM && rule.item === COCKTAIL_ITEM
				? "drinkGame"
				: "placeAction";
			const cooldownItem = action === "drinkGame" ? DRINK_ITEM : rule.item;
			const available = state.canGet(dave, cooldownItem);
			const remaining = state.formatCooldownRemaining(state.getCooldownRemaining(dave, cooldownItem));
			//console.log("canget:  " + rule.item + " avail " + available);

			actionHtml += available
					? `<button data-action="${action}" data-item="${rule.item}"> ${rule.getLabel} </button>`
					: `<button disabled> ${rule.getLabel} (${remaining}) </button>`;
		}

		actionHtml += `<button data-action="resolveSignal">&#128225; Resolve the Signal</button>`;
		if (voyage?.active && voyage?.isStarter) {
			actionHtml += `<button data-action="joinPirateVoyage">Join the Voyage</button>`;
			actionHtml += `<button data-action="stopPirateVoyage">Stop the Voyage</button>`;
		} else {
			actionHtml += voyage?.active
				? `<button data-action="joinPirateVoyage">&#127988;&#8205;&#9760;&#65039; Join Crew</button>`
				: `<button data-action="launchPirateVoyage">&#9875; Launch Voyage</button>`;
		}


	} else {
		actionHtml += "OUT OF RANGE";
	}
	if (place.owner == userId) {
		actionHtml += `<button data-action="deconstructNode">Deconstruct node</button> `   
	} 
	if (isDebugUser) {
		actionHtml += getAdminActionHtml();
		actionHtml += `<button data-action="teleport">Teleport</button>`;
	}
	addActions(actionHtml);

	map = addMap(place.mapData, { socket });
}


loadPlace();
