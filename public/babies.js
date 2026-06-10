import { getUserId } from './utils/id.js';
import { getBabyStats } from './utils/babies.js';
import * as state from "./utils/state.js";

const params = new URLSearchParams(window.location.search);
const userId = getUserId();
const daveId = params.get("id");
const viewerId = params.get("viewerId") || userId;

const socket = io({
	auth: {
		userId
	}
});

const backLink = document.getElementById("backLink");
const babyOwner = document.getElementById("babyOwner");
const babySummary = document.getElementById("babySummary");
const babyStats = document.getElementById("babyStats");
const babyActions = document.getElementById("babyActions");
const babyStatus = document.getElementById("babyStatus");

if (daveId) {
	backLink.href = `/player.html?id=${encodeURIComponent(daveId)}&viewerId=${encodeURIComponent(viewerId)}`;
}

function renderUnavailable(message) {
	babyOwner.textContent = "Babies unavailable";
	babySummary.textContent = message;
	babyStats.innerHTML = "";
	babyActions.innerHTML = "";
	babyStatus.textContent = "";
}

function receiveBaby() {
	babyStatus.textContent = "Preparing baby transfer...";

	socket.emit("startReceiveBaby", userId, daveId, (result) => {
		if (!result?.ok) {
			babyStatus.textContent = result?.error || "Unable to receive baby.";
			return;
		}

		window.location.href = `/baby-pass.html?claim=receiveBaby&returnTo=${encodeURIComponent(window.location.href)}`;
	});
}

function renderActions(dave) {
	babyActions.innerHTML = "";
	babyStatus.textContent = "";

	if (dave.availableActions?.canReceiveBaby) {
		babyActions.innerHTML = `<button data-action="receiveBaby">Receive a baby</button>`;
	}
}

async function loadBabies() {
	if (!daveId) {
		renderUnavailable("This baby link is missing or expired.");
		return;
	}

	const res = await fetch(`/api/dave?id=${encodeURIComponent(daveId)}&viewerId=${encodeURIComponent(viewerId)}`);
	const dave = await res.json();

	if (!res.ok) {
		renderUnavailable(dave.error ?? "Unable to load this Dave.");
		return;
	}

	const stats = getBabyStats(dave, state);
	babyOwner.textContent = `${dave.name}'s Babies`;
	babySummary.textContent = stats.hasActivity
		? "Plastic baby activity"
		: "No plastic baby activity yet.";
	babyStats.innerHTML = `
		<div class="field">
			<span class="label">Current Babies</span>
			<span>${stats.count}</span>
		</div>
		<div class="field">
			<span class="label">Babies Received</span>
			<span>${stats.received}</span>
		</div>
		<div class="field">
			<span class="label">Babies Lost</span>
			<span>${stats.lost}</span>
		</div>
	`;
	renderActions(dave);
}

babyActions.onclick = (event) => {
	if (event.target.dataset.action === "receiveBaby") {
		receiveBaby();
	}
};

loadBabies();
