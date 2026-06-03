import { getUserId, isDebugId} from './utils/id.js';
import { bindLogEvents } from './utils/log.js';
import { addMap } from './utils/map.js';
import { displayItems } from './utils/itemUI.js';
import { getRecognizedTags, getTagPlayerLabel } from './utils/tags.js';
import { DAVE_RAVE_DEBUG_ENABLED, DAVE_RAVE_MIN_PLAYERS, DAVE_RAVE_RADIUS_METERS } from './utils/raves.js';
import * as state from "./utils/state.js";

const userId = getUserId();
const socket = io({
    auth: {
        userId: userId
    }
});

const params = new URLSearchParams(window.location.search);
const daveId = params.get("id");
const isDebugUser = isDebugId(userId);
const PEPPER_ITEM = "🌶️";
const BABY_ITEM = "👶";

let map;
let preserveActionStatusUntil = 0;
let pendingPlayerLoad = null;

bindLogEvents(socket);

function renderQrLink(dave) {
	const qrPanel = document.getElementById("qrPanel");
	const qrImage = document.getElementById("playerQrCode");
	const qrLink = document.getElementById("qrLink");
	const qrUrl = document.getElementById("qrUrl");
	const targetId = dave.userId || daveId;
	const targetUrl = new URL("/link.html", window.location.origin);
	targetUrl.searchParams.set("id", targetId);

	qrLink.href = targetUrl.toString();
	qrUrl.textContent = targetUrl.toString();
	qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=12&data=${encodeURIComponent(targetUrl.toString())}`;
	qrPanel.classList.remove("hidden");
}

function renderTags(tags = []) {
	const container = document.getElementById("player-tags");
	container.innerHTML = "";

	tags.forEach(tag => {
		const el = document.createElement("span");
		el.className = `tag tag-${tag}`;
		el.textContent = getTagPlayerLabel(tag);
		container.appendChild(el);
	});
}

function emit(event) {
	if (event === "spawnCluster") {
		socket.emit(event, userId, 10);
	} else {
		socket.emit(event, userId, daveId);
	}
	location.reload()
}

function getItemFromUser(item) {
	socket.emit("getItemFromUser", userId, daveId, item);
	location.reload()
}

function startDaveRave() {
	const statusEl = document.getElementById("actionStatus");
	if (statusEl) {
		statusEl.textContent = "Submitting Dave Rave permit...";
	}
	socket.emit("startDaveRave", userId);
}

function eatTaco() {
	const statusEl = document.getElementById("actionStatus");
	if (statusEl) {
		statusEl.textContent = "Eating taco...";
	}
	socket.emit("eatTaco", userId);
}

function grantTag() {
	const tag = document.getElementById("grantTagSelect")?.value;
	if (!tag) return;

	socket.emit("grantTag", userId, daveId, tag);
	location.reload();
}

function getGrantTagControlHtml() {
	const options = getRecognizedTags()
		.map(({ tag }) => `<option value="${tag}">${getTagPlayerLabel(tag)}</option>`)
		.join("");

	return `
		<div class="grant-tag-control">
			<select id="grantTagSelect" aria-label="Tag to grant">
				${options}
			</select>
			<button data-action="grantTag">GRANT TAG</button>
		</div>
	`;
}

function showDaveRaveAnimation() {
	const overlay = document.getElementById("daveRaveOverlay");
	if (!overlay) return;

	overlay.classList.remove("hidden");
	overlay.classList.remove("raving");
	void overlay.offsetWidth;
	overlay.classList.add("raving");

	setTimeout(() => {
		overlay.classList.add("hidden");
		overlay.classList.remove("raving");
		location.reload();
	}, 2200);
}

async function teleport(freeRoam) {
	const statusEl = document.getElementById("actionStatus");
	if (statusEl) {
		statusEl.textContent = freeRoam ? "Teleporting..." : "Returning to live location...";
	}

	const payload = JSON.stringify({
		source: userId,
		targetId: daveId,
		targetType: "player",
		freeRoam: freeRoam
	});
	const res = await fetch('/api/teleport', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload
	});

	if (res.ok) {
		const result = await res.json();
		preserveActionStatusUntil = Date.now() + 3000;
		if (statusEl) {
			statusEl.textContent = freeRoam
				? `Teleported to ${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}.`
				: "Live location restored.";
		}
		await loadPlayer();
		return;
	}

	preserveActionStatusUntil = Date.now() + 5000;
	const responseText = await res.text();
	if (statusEl) {
		statusEl.textContent = `Teleport failed (${res.status}). ${responseText}`;
	}
}

function addActions(actionHtml) {
	const actionsContainer = document.getElementById("actions");
	const statusEl = document.getElementById("actionStatus");

	actionsContainer.innerHTML = actionHtml;
	if (statusEl && Date.now() >= preserveActionStatusUntil) {
		statusEl.textContent = "";
	}

	actionsContainer.onclick = (e) => {
		const action = e.target.dataset.action;
		if (!action) return;

		switch (action) {
			case "antivirus":
				window.location.href = "https://iamdavecon.github.io/bb/";
				break;

			case "getItemFromUser":
				getItemFromUser(e.target.dataset.item);
				break;

			case "startDaveRave":
				startDaveRave();
				break;

			case "eatTaco":
				eatTaco();
				break;

			case "grantTag":
				grantTag();
				break;

			case "teleport":
				teleport(true);
				break;
			case "exitFreeRoam":
				teleport(false);
				break;	
			default:
				emit(action);
		}
	};
}

function renderLinkedDaves(linkedDaves = []) {
	const container = document.getElementById("linkedDaves");
	container.innerHTML = "";

	if (linkedDaves.length === 0) {
		return;
	}

	const title = document.createElement("div");
	title.className = "section-title linked-daves-title";
	title.textContent = "Linked Daves";
	container.appendChild(title);

	const list = document.createElement("div");
	list.className = "linked-daves-list";

	linkedDaves.forEach((linkedDave) => {
		const link = document.createElement("a");
		link.className = "linked-dave";
		link.href = `/player.html?id=${encodeURIComponent(linkedDave.userId)}&viewerId=${encodeURIComponent(userId)}`;

		const name = document.createElement("span");
		name.textContent = linkedDave.name || linkedDave.userId;

		const linkedState = document.createElement("span");
		linkedState.className = `pill ${linkedDave.state.toLowerCase()}`;
		linkedState.textContent = linkedDave.state;

		link.appendChild(name);
		link.appendChild(linkedState);
		list.appendChild(link);
	});

	container.appendChild(list);
}

async function loadPlayer() {
	if (!daveId) return;

	const res = await fetch(`/api/dave?id=${encodeURIComponent(daveId)}&viewerId=${encodeURIComponent(userId)}`);
	const dave = await res.json();
	//console.log("loading: " + JSON.stringify(dave, null, 2));

	if (!res.ok) {
		document.getElementById("playerName").textContent = "Dave unavailable";
		document.getElementById("actions").innerHTML = "";
		document.getElementById("actionStatus").textContent = dave.error ?? "Unable to load this Dave.";
		return;
	}


	// --- Populate fields ---
	document.getElementById("playerName").textContent = dave.name;

	const stateEl = document.getElementById("playerState");
	const stateValue = state.getState(dave);
	stateEl.textContent = stateValue.toUpperCase();
	stateEl.className = "state-pill " + stateValue.toLowerCase();

	if (dave.tags) {
		renderTags(dave.tags);
	}

	if (!dave.isBot) {
		let infectedCount = 0;
		if (dave.infectedUsers) {
			infectedCount = dave.infectedUsers.length; 
		}
		let fragments = 0;
		if (dave.fragmentsCollected) {
			fragments = dave.fragmentsCollected.length; 
		}
		const nodes = dave.nodeCount ?? 0;
		const babies = state.getAmt(dave, BABY_ITEM);

		let statHtml = "";
		statHtml = `
			<div class="field">
				<span class="label">☣️ Infected</span>
				<span>${infectedCount}</span>
			</div>
			<div class="field">
				<span class="label">🧬Fragments</span>
				<span>${fragments}</span>
			</div>
			<div class="field">
				<span class="label">🏙️ Nodes</span>
				<span>${nodes}</span>
			</div>
			<div class="field">
				<span class="label">👶 Babies</span>
				<span>${babies}</span>
			</div>
			<div class="field">
				<span class="label">▧ Dave Raves</span>
				<span>${dave.daveravesStarted ?? 0}</span>
			</div>
		`;
		statHtml += displayItems(dave);
		document.getElementById("stats").innerHTML = statHtml;
	}

	if (dave.isMe) {
		renderQrLink(dave);
		renderLinkedDaves(dave.linkedDaves);

		let actionHtml = "";

		//TODO  ??
		//actionHtml += `<button id="chooseTags">Choose </button> `   

		if (dave.availableActions.hasFragments) {
			if (dave.availableActions.tooNear) {
				actionHtml += `<button disabled=true>Daveify This Spot  (Too near a node)</button> `   
			} else {
				actionHtml += `<button data-action="dropDavePoint">Daveify This Spot</button> `   
			}
		} else {
			actionHtml += `<button disabled=true>Daveify This Spot  (Need more Davefluence)</button> `   
		}

		//  DAVEPRIME (ENABLES CHEATS)
		if (dave.availableActions.davePrime) {
			actionHtml += `<button data-action="spawnCluster">Spawn Civilians</button>`
		}

		if (dave.availableActions.canEatTaco) {
			actionHtml += `<button data-action="eatTaco">Eat a taco</button>`;
		} else if (dave.availableActions.tacoRangeBoostRemaining > 0) {
			const remaining = state.formatCooldownRemaining(dave.availableActions.tacoRangeBoostRemaining);
			actionHtml += `<button disabled>Eat a taco (${remaining} boost)</button>`;
		}

		const eligibleDaves = Array.isArray(dave.availableActions.daveRaveEligibleDaves)
			? dave.availableActions.daveRaveEligibleDaves
			: [];
		const excludedDaves = Array.isArray(dave.availableActions.daveRaveExcludedDaves)
			? dave.availableActions.daveRaveExcludedDaves
			: [];
		const eligibleNames = eligibleDaves
			.map((dave) => `${dave.name}${Number.isFinite(dave.distanceMeters) ? ` (${dave.distanceMeters}m)` : ""}`)
			.join(", ");
		const excludedNames = excludedDaves
			.map((dave) => `${dave.name}${Number.isFinite(dave.distanceMeters) ? ` (${dave.distanceMeters}m)` : ""}: ${dave.reason}`)
			.join(", ");
		actionHtml += `
			<div class="field-note">
				Dave Rave eligible: ${dave.availableActions.davesInArea ?? 0}/${DAVE_RAVE_MIN_PLAYERS} within ${DAVE_RAVE_RADIUS_METERS}m.
				${DAVE_RAVE_DEBUG_ENABLED && eligibleNames ? `Counted: ${eligibleNames}.` : ""}
				${DAVE_RAVE_DEBUG_ENABLED && excludedNames ? `Excluded nearby: ${excludedNames}.` : ""}
			</div>
		`;

		if (dave.availableActions.canStartDaveRave) {
			actionHtml += `<button class="dave-rave-button" data-action="startDaveRave">START A DAVE RAVE</button>`;
		} else if (dave.availableActions.davesInArea >= DAVE_RAVE_MIN_PLAYERS && dave.availableActions.daveRaveCooldownRemaining > 0) {
			const remaining = state.formatCooldownRemaining(dave.availableActions.daveRaveCooldownRemaining);
			actionHtml += `<button class="dave-rave-button" disabled>START A DAVE RAVE (${remaining})</button>`;
		} else {
			const needed = Math.max(0, DAVE_RAVE_MIN_PLAYERS - (dave.availableActions.davesInArea ?? 0));
			actionHtml += `<button class="dave-rave-button" disabled>START A DAVE RAVE (${needed} MORE DAVES)</button>`;
		}

		if (isDebugUser) {
			if (dave.freeRoam) {
				actionHtml += `<button data-action="exitFreeRoam">Exit Free Roam</button>`
			}
		}

		//  DEBUG
		if (isDebugUser) {
			actionHtml += `<button data-action="increaseRank">Increase Rank</button>`
			actionHtml += `<button data-action="decreaseRank">Decrease Rank</button>`
		}

		addActions(actionHtml);
	} else  {
		if (dave.mapData.inRange) {
			let actionHtml = "";

			if (dave.availableActions.canInfect) {
				actionHtml += `<button data-action="infect">TRANSMIT VIRUS</button>`;
			} else {
				actionHtml += `<button disabled class="disabled">TRANSMIT VIRUS</button>`;
			}

			if (dave.availableActions.hasPatchAbility) {
				if (dave.availableActions.canBePatched) {
					actionHtml += `<button data-action="stabilize">STABILIZE HOST</button>`;
				}
			} else {
				actionHtml += `<button data-action="antivirus">ANTIVIRUS REQUIRED</button>`;
			}

			if (dave.availableActions.canAscend) {
				actionHtml += `<button data-action="ascendPlayer">ASCEND</button>`;
			}

			if (dave.availableActions.canMakeBadDecision) {
				actionHtml += `<button data-action="badDecision">Do you want to make a bad decision?</button>`;
			}

			if (!dave.isBot && dave.availableActions.canDaveputize) {
				actionHtml += `<button data-action="daveputize">DAVEPUTIZE</button>`;
			}

			if (dave.availableActions.canDoonShift) {
				actionHtml += `<button data-action="doonShift">CORRUPT HOST</button>`;
			}

			if (dave.availableActions.canDecreaseStatus) {
				actionHtml += `<button data-action="decreaseStatus">CORRUPT HOST</button>`;
			}

			if (!dave.isBot && dave.availableActions.canGrantDavePrime) {
				actionHtml += `<button data-action="grantDavePrime">GRANT DAVEPRIME</button>`;
			}

			if (!dave.isBot && dave.availableActions.canGrantTag) {
				actionHtml += getGrantTagControlHtml();
			}

			if (dave.availableActions.canGetPepper) {
				actionHtml += `<button data-action="getItemFromUser" data-item="${PEPPER_ITEM}">Get a pepper</button>`;
			} else if (dave.availableActions.hasPepper) {
				const remaining = state.formatCooldownRemaining(dave.availableActions.pepperCooldownRemaining);
				actionHtml += `<button disabled>Get a pepper (${remaining})</button>`;
			}

			if (isDebugUser) {
				actionHtml += `<button data-action="teleport">Teleport</button>`;
			}

			addActions(actionHtml);
		} else {
			if (isDebugUser) {
				let actionHtml = "";
				actionHtml += `<button data-action="teleport">Teleport</button>`;
				addActions(actionHtml);
			} else {
				document.getElementById("actions").innerHTML = `OUT OF RANGE`;
			}
		}


		map = addMap(dave.mapData, { socket });
	}
}

loadPlayer();

function schedulePlayerRefresh() {
	if (pendingPlayerLoad) {
		clearTimeout(pendingPlayerLoad);
	}

	pendingPlayerLoad = setTimeout(() => {
		pendingPlayerLoad = null;
		loadPlayer();
	}, 250);
}




// INFECTION


socket.on('infectResult', (data) => {
	//console.log("infect result: " + data.sucess);
	if (data.success) {
		location.reload()
	}
});

socket.on('notifyInfected', () => {});

socket.on("update", () => {
	schedulePlayerRefresh();
});


//  STABILIZE


socket.on('stabilizeResult', (data) => {
	if (data.success) {
		location.reload()
	}
});

socket.on("daveRaveResult", (data) => {
	if (data.ok) {
		showDaveRaveAnimation();
		return;
	}

	preserveActionStatusUntil = Date.now() + 5000;
	const statusEl = document.getElementById("actionStatus");
	if (statusEl) {
		const davesInArea = data?.davesInArea ?? 0;
		const cooldownRemaining = data?.cooldownRemaining ?? 0;
		const requiredDaves = data?.debug?.requiredDaves ?? DAVE_RAVE_MIN_PLAYERS;
		const radiusMeters = data?.debug?.radiusMeters;
		const eligibleNames = Array.isArray(data?.debug?.eligibleDaves)
			? data.debug.eligibleDaves.map((dave) => `${dave.name}${Number.isFinite(dave.distanceMeters) ? ` (${dave.distanceMeters}m)` : ""}`).join(", ")
			: "";
		const excludedNames = Array.isArray(data?.debug?.excludedDaves)
			? data.debug.excludedDaves.map((dave) => `${dave.name}${Number.isFinite(dave.distanceMeters) ? ` (${dave.distanceMeters}m)` : ""}: ${dave.reason}`).join(", ")
			: "";
		const needed = Math.max(0, requiredDaves - davesInArea);
		const sourceLocation = Number.isFinite(data?.debug?.sourceLat) && Number.isFinite(data?.debug?.sourceLng)
			? ` Source: ${data.debug.sourceLat.toFixed(6)}, ${data.debug.sourceLng.toFixed(6)}.`
			: "";
		const debugText = DAVE_RAVE_DEBUG_ENABLED
			? ` Server counted ${davesInArea}/${requiredDaves}${radiusMeters ? ` within ${radiusMeters}m` : ""}.${sourceLocation}${eligibleNames ? ` Counted: ${eligibleNames}.` : ""}${excludedNames ? ` Excluded nearby: ${excludedNames}.` : ""}`
			: "";
		if (data?.reason === "cooldown" && cooldownRemaining > 0) {
			statusEl.textContent = `Dave Rave cooldown active: ${state.formatCooldownRemaining(cooldownRemaining)}.${debugText}`;
		} else if (data?.reason === "not-enough-daves" || needed > 0) {
			statusEl.textContent = `${needed} more nearby Daves required to start a Dave Rave.${debugText}`;
		} else if (data?.reason === "unavailable") {
			statusEl.textContent = `Dave Rave request denied. Your Dave session is not active yet.${debugText}`;
		} else {
			statusEl.textContent = `Dave Rave request denied. Make sure your location is current and try again.${debugText}`;
		}
	}
});

socket.on("daveRave", (data) => {
	if (data.userId !== userId) {
		showDaveRaveAnimation();
	}
});
