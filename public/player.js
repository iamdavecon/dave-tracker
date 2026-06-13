import { getUserId } from './utils/id.js';
import { bindLogEvents } from './utils/log.js';
import { addMap, removeMap } from './utils/map.js';
import { displayItems } from './utils/itemUI.js';
import { BABY_ITEM, getBabyStats } from './utils/babies.js';
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
let isDebugUser = false;
const BLACK_BADGE_RAFFLE_ITEM = "🎟️";
const BEACH_BALL_ITEM = "🏐";
const SAO_ITEM = "𓇲";

let map;
let preserveActionStatusUntil = 0;
let pendingPlayerLoad = null;
let grantTagInteractionActive = false;
let deferredPlayerRefresh = false;
let grantTagSelection = "";

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

function renderTags(tags = [], options = {}) {
	const container = document.getElementById("player-tags");
	container.innerHTML = "";

	tags.forEach(tag => {
		const el = document.createElement("span");
		el.className = `tag tag-${tag}`;
		el.textContent = getTagPlayerLabel(tag, options);
		container.appendChild(el);
	});
}

function formatRelativeTime(timestamp) {
	const elapsedMs = Date.now() - timestamp;
	const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

	if (elapsedSeconds < 60) {
		return "just now";
	}

	const elapsedMinutes = Math.floor(elapsedSeconds / 60);
	if (elapsedMinutes < 60) {
		return `${elapsedMinutes}m ago`;
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) {
		return `${elapsedHours}h ago`;
	}

	const elapsedDays = Math.floor(elapsedHours / 24);
	return `${elapsedDays}d ago`;
}

function renderAdminMeta(dave) {
	const container = document.getElementById("adminMeta");
	if (!container) return;

	container.innerHTML = "";
	container.classList.add("hidden");

	if (!isDebugUser || !Number.isFinite(dave.updatedAt)) {
		return;
	}

	const lastSeen = new Date(dave.updatedAt);
	const row = document.createElement("div");
	row.className = "field admin-meta-row";

	const label = document.createElement("span");
	label.className = "label";
	label.textContent = "Last seen";

	const value = document.createElement("span");
	value.textContent = `${lastSeen.toLocaleString()} (${formatRelativeTime(dave.updatedAt)})`;

	row.appendChild(label);
	row.appendChild(value);
	container.appendChild(row);
	container.classList.remove("hidden");
}

function emit(event) {
	if (event === "spawnCluster") {
		socket.emit(event, userId, 10);
	} else {
		socket.emit(event, userId, daveId);
	}
	if (event === "dropDavePoint") {
		window.location.href = "/";
		return;
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

function redirectToDaveRave(data) {
	const raveUrl = new URL("/dave-rave.html", window.location.origin);
	raveUrl.searchParams.set("userId", userId);
	if (Number.isFinite(data?.davesInArea)) {
		raveUrl.searchParams.set("proximalDaves", String(data.davesInArea));
	}
	if (Number.isFinite(data?.daveravesStarted)) {
		raveUrl.searchParams.set("daveravesStarted", String(data.daveravesStarted));
	}
	window.location.href = raveUrl.toString();
}

function grantTag() {
	const tag = document.getElementById("grantTagSelect")?.value;
	if (!tag) return;

	socket.emit("grantTag", userId, daveId, tag);
	location.reload();
}

function getGrantTagControlHtml() {
	const options = getRecognizedTags()
		.map(({ tag }) => `<option value="${tag}"${tag === grantTagSelection ? " selected" : ""}>${getTagPlayerLabel(tag)}</option>`)
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

function syncGrantTagSelection() {
	const select = document.getElementById("grantTagSelect");
	if (select) {
		grantTagSelection = select.value;
	}
}

function finishGrantTagInteraction() {
	grantTagInteractionActive = false;
	if (deferredPlayerRefresh) {
		deferredPlayerRefresh = false;
		schedulePlayerRefresh();
	}
}

function bindGrantTagControl() {
	const select = document.getElementById("grantTagSelect");
	if (!select) return;

	if (grantTagSelection && Array.from(select.options).some((option) => option.value === grantTagSelection)) {
		select.value = grantTagSelection;
	} else {
		grantTagSelection = select.value;
	}

	select.addEventListener("focus", () => {
		grantTagInteractionActive = true;
	});
	select.addEventListener("pointerdown", () => {
		grantTagInteractionActive = true;
	});
	select.addEventListener("change", () => {
		grantTagSelection = select.value;
	});
	select.addEventListener("blur", () => {
		grantTagSelection = select.value;
		setTimeout(() => {
			if (document.activeElement !== select) {
				finishGrantTagInteraction();
			}
		}, 100);
	});
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

async function toggleVisibility(visible) {
	const statusEl = document.getElementById("actionStatus");
	if (statusEl) {
		statusEl.textContent = visible ? "Becoming visible..." : "Going invisible...";
	}

	const res = await fetch('/api/visibility', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId, visible })
	});

	preserveActionStatusUntil = Date.now() + 3000;
	if (res.ok) {
		const result = await res.json();
		if (result.visible && navigator.geolocation) {
			navigator.geolocation.getCurrentPosition((pos) => {
				socket.emit('location', {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude
				});
			});
		} else if (!result.visible) {
			socket.emit('location', { lat: 0, lng: 0 });
		}
		if (statusEl) {
			statusEl.textContent = result.visible
				? "You are visible again."
				: "You are invisible. Location hidden at 0,0.";
		}
		await loadPlayer();
		return;
	}

	const responseText = await res.text();
	if (statusEl) {
		statusEl.textContent = `Visibility update failed (${res.status}). ${responseText}`;
	}
}

async function setBadgeStatus(status) {
	const statusEl = document.getElementById("actionStatus");
	if (statusEl) {
		statusEl.textContent = "Updating badge status...";
	}

	const res = await fetch('/api/badge-status', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId, status })
	});

	preserveActionStatusUntil = Date.now() + 3000;
	if (res.ok) {
		if (statusEl) {
			statusEl.textContent = status === "need"
				? "Badge request marked."
				: status === "have"
					? "Badge supply marked."
					: "Badge status cleared.";
		}
		await loadPlayer();
		return;
	}

	const result = await res.json().catch(() => ({}));
	if (statusEl) {
		statusEl.textContent = result.error || `Badge status update failed (${res.status}).`;
	}
}

async function removePlayer() {
	const statusEl = document.getElementById("actionStatus");
	const confirmed = window.confirm("Remove this Dave from the active online list?");
	if (!confirmed) {
		return;
	}

	if (statusEl) {
		statusEl.textContent = "Removing Dave...";
	}

	const res = await fetch('/api/admin/remove-player', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId, targetId: daveId })
	});

	preserveActionStatusUntil = Date.now() + 5000;
	if (res.ok) {
		if (statusEl) {
			statusEl.textContent = "Dave removed from active players.";
		}
		window.location.href = `/leaderboard.html?userId=${encodeURIComponent(userId)}`;
		return;
	}

	const result = await res.json().catch(() => ({}));
	if (statusEl) {
		statusEl.textContent = result.error || `Remove failed (${res.status}).`;
	}
}

function getAdminActionHtml() {
	return `<button data-action="admin">su root</button>`;
}

function addActions(actionHtml) {
	const actionsContainer = document.getElementById("actions");
	const statusEl = document.getElementById("actionStatus");

	syncGrantTagSelection();
	actionsContainer.innerHTML = actionHtml;
	bindGrantTagControl();
	if (statusEl && Date.now() >= preserveActionStatusUntil) {
		statusEl.textContent = "";
	}

	actionsContainer.onclick = (e) => {
		const actionTarget = e.target.closest("[data-action]");
		const action = actionTarget?.dataset.action;
		if (!action) return;

		switch (action) {
			case "antivirus":
				window.location.href = "https://iamdavecon.github.io/bb/";
				break;

			case "admin":
				window.location.href = "/admin.html";
				break;

			case "getItemFromUser":
				getItemFromUser(e.target.dataset.item);
				break;

			case "startDaveRave":
				startDaveRave();
				break;

			case "openNearestPlace":
				window.location.href = `/place.html?id=${encodeURIComponent(e.target.dataset.placeId)}&viewerId=${encodeURIComponent(userId)}`;
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
			case "hideMe":
				toggleVisibility(false);
				break;
			case "showMe":
				toggleVisibility(true);
				break;
			case "setBadgeStatus":
				setBadgeStatus(actionTarget.dataset.badgeStatus || null);
				break;
			case "removePlayer":
				removePlayer();
				break;
			default:
				emit(action);
		}
	};
}

function getBadgeIndicatorClass(badgeStatus) {
	if (badgeStatus === "need") {
		return "badge-indicator badge-indicator-need";
	}

	if (badgeStatus === "have") {
		return "badge-indicator badge-indicator-have";
	}

	return "badge-indicator hidden";
}

function renderBadgeIndicator(badgeStatus) {
	const indicator = document.getElementById("playerBadgeIndicator");
	if (!indicator) return;

	indicator.className = getBadgeIndicatorClass(badgeStatus);
	indicator.title = badgeStatus === "need"
		? "Needs badges"
		: badgeStatus === "have"
			? "Has badges"
			: "";
	indicator.setAttribute("aria-label", indicator.title);
}

function getBadgeControlsHtml(badgeStatus) {
	const needActive = badgeStatus === "need";
	const haveActive = badgeStatus === "have";

	return `
		<div class="badge-controls" aria-label="Badge status">
			<button
				class="badge-toggle badge-toggle-need ${needActive ? "active" : ""}"
				data-action="setBadgeStatus"
				data-badge-status="${needActive ? "" : "need"}"
				aria-pressed="${needActive}"
			>I need badges</button>
			<button
				class="badge-toggle badge-toggle-have ${haveActive ? "active" : ""}"
				data-action="setBadgeStatus"
				data-badge-status="${haveActive ? "" : "have"}"
				aria-pressed="${haveActive}"
			>I have badges</button>
		</div>
	`;
}

function renderMapArea(dave) {
	const mapArea = document.getElementById("mapArea");
	const mapEl = document.getElementById("map");
	const visibilityMapAction = document.getElementById("visibilityMapAction");
	const showOnMapBtn = document.getElementById("showOnMapBtn");

	if (!mapArea || !mapEl || !visibilityMapAction) {
		return;
	}

	mapArea.classList.add("hidden");
	mapEl.classList.add("hidden");
	visibilityMapAction.classList.add("hidden");

	if (dave.isMe && dave.visible === false) {
		removeMap(mapEl);
		mapArea.classList.remove("hidden");
		visibilityMapAction.classList.remove("hidden");
		if (showOnMapBtn) {
			showOnMapBtn.onclick = () => toggleVisibility(true);
		}
		return;
	}

	if (dave.isMe && dave.visible !== false) {
		mapArea.classList.remove("hidden");
		mapEl.classList.remove("hidden");
		map = addMap(dave.mapData, {
			socket,
			showDaveRaveRange: true,
			raveCount: dave.availableActions?.davesInArea ?? 0,
			canStartDaveRave: !!dave.availableActions?.canStartDaveRave
		});
		return;
	}

	if (!dave.isMe && dave.visible !== false) {
		mapArea.classList.remove("hidden");
		mapEl.classList.remove("hidden");
		map = addMap(dave.mapData, { socket });
		return;
	}

	removeMap(mapEl);
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
	isDebugUser = !!dave.isDebugUser;
	//console.log("loading: " + JSON.stringify(dave, null, 2));

	if (!res.ok) {
		document.getElementById("playerName").textContent = "Dave unavailable";
		document.getElementById("actions").innerHTML = "";
		document.getElementById("actionStatus").textContent = dave.error ?? "Unable to load this Dave.";
		renderAdminMeta({});
		return;
	}


	// --- Populate fields ---
	document.getElementById("playerName").textContent = dave.name;
	renderMapArea(dave);

	const stateEl = document.getElementById("playerState");
	const stateValue = state.getState(dave);
	stateEl.textContent = stateValue.toUpperCase();
	stateEl.className = "state-pill " + stateValue.toLowerCase();
	renderBadgeIndicator(dave.badgeStatus);

	if (dave.tags) {
		renderTags(dave.tags);
	}
	renderAdminMeta(dave);

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
		const babyStats = getBabyStats(dave, state);
		const blackBadgeRaffleTickets = state.getAmt(dave, BLACK_BADGE_RAFFLE_ITEM);
		const beachBalls = state.getAmt(dave, BEACH_BALL_ITEM);
		const saos = state.getAmt(dave, SAO_ITEM);
		const babyHref = `/babies.html?id=${encodeURIComponent(dave.userId || daveId)}&viewerId=${encodeURIComponent(userId)}`;
		const babyRow = babyStats.hasActivity
			? `<a class="field item-row" href="${babyHref}">
				<span class="label">👶 Babies</span>
				<span>${babyStats.count}</span>
			</a>`
			: `<div class="field">
				<span class="label">👶 Babies</span>
				<span>${babyStats.count}</span>
			</div>`;
		const beachBallRow = beachBalls > 0
			? `<a class="field item-row" href="/linecon.html">
				<span class="label">🏐 Beach Balls</span>
				<span>${beachBalls}</span>
			</a>`
			: `<div class="field">
				<span class="label">🏐 Beach Balls</span>
				<span>${beachBalls}</span>
			</div>`;

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
			${babyRow}
			<div class="field">
				<span class="label">▧ Dave Raves</span>
				<span>${dave.daveravesStarted ?? 0}</span>
			</div>
			<div class="field">
				<span class="label">🎟️ Black Badge Raffle</span>
				<span>${blackBadgeRaffleTickets}</span>
			</div>
			<div class="field">
				<span class="label">𓇲 SAOs</span>
				<span>${saos}</span>
			</div>
			${beachBallRow}
		`;
		statHtml += displayItems(dave, null, { userId: dave.userId || daveId, viewerId: userId });
		document.getElementById("stats").innerHTML = statHtml;
	}

	if (dave.isMe) {
		renderQrLink(dave);
		renderLinkedDaves(dave.linkedDaves);

		let actionHtml = getBadgeControlsHtml(dave.badgeStatus);
		const nearestPlace = dave.availableActions.nearestPlace;
		if (nearestPlace?.id) {
			actionHtml += `<button data-action="openNearestPlace" data-place-id="${nearestPlace.id}">Daveify This Spot</button> `   
		} else {
			if (dave.availableActions.hasFragments) {
				actionHtml += `<button data-action="dropDavePoint">Daveify This Spot</button> `   
			} else {
				actionHtml += `<button disabled=true>Daveify This Spot  (Need more Davefluence)</button> `   
			}
		}

		if (dave.visible !== false) {
			actionHtml += `<button data-action="hideMe">Hide Me</button>`;
		}


		//  DAVEPRIME (ENABLES CHEATS)
		if (dave.availableActions.davePrime) {
			actionHtml += `<button data-action="spawnCluster">Spawn Civilians</button>`
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
			actionHtml += getAdminActionHtml();
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

			if (dave.availableActions.canIntroduceDaveTangent) {
				actionHtml += `<button data-action="introduceDaveTangent">Give DaveTangent a high five</button>`;
			}

			if (dave.availableActions.canClaimGoonRaffle) {
				actionHtml += `<button data-action="claimGoonRaffle">Black badge raffle!?  Thanks!</button>`;
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

			const firstItem = dave.availableActions.firstItem;
			if (dave.availableActions.canGetFirstItem && firstItem?.item) {
				actionHtml += `<button data-action="getItemFromUser" data-item="${firstItem.item}">${firstItem.getLabel}</button>`;
			} else if (firstItem?.item) {
				const remaining = state.formatCooldownRemaining(dave.availableActions.firstItemCooldownRemaining);
				actionHtml += `<button disabled>${firstItem.getLabel} (${remaining})</button>`;
			}

			if (isDebugUser) {
				actionHtml += getAdminActionHtml();
				actionHtml += `<button data-action="teleport">Teleport</button>`;
				actionHtml += `<button data-action="removePlayer">Remove Player</button>`;
			}

			addActions(actionHtml);
		} else {
			if (isDebugUser) {
				let actionHtml = "";
				if (!dave.isBot && dave.availableActions.canGrantTag) {
					actionHtml += getGrantTagControlHtml();
				}
				actionHtml += getAdminActionHtml();
				actionHtml += `<button data-action="teleport">Teleport</button>`;
				actionHtml += `<button data-action="removePlayer">Remove Player</button>`;
				addActions(actionHtml);
			} else {
				document.getElementById("actions").innerHTML = `OUT OF RANGE`;
			}
		}

	}
}

loadPlayer();

function schedulePlayerRefresh() {
	if (grantTagInteractionActive) {
		deferredPlayerRefresh = true;
		return;
	}

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
		redirectToDaveRave(data);
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
