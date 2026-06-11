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
const babyCrawlLayer = document.getElementById("babyCrawlLayer");

if (daveId) {
	backLink.href = `/player.html?id=${encodeURIComponent(daveId)}&viewerId=${encodeURIComponent(viewerId)}`;
}

function renderUnavailable(message) {
	babyOwner.textContent = "Babies unavailable";
	babySummary.textContent = message;
	babyStats.innerHTML = "";
	babyActions.innerHTML = "";
	babyStatus.textContent = "";
	babyCrawlLayer.innerHTML = "";
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

function renderCrawlingBabies(count, canReceiveBaby) {
	babyCrawlLayer.innerHTML = "";
	babyCrawlLayer.classList.toggle("baby-crawl-layer-active", count > 0);

	for (let index = 0; index < count; index += 1) {
		const baby = document.createElement(canReceiveBaby ? "button" : "span");
		baby.className = "crawling-baby";
		baby.textContent = "👶";
		baby.style.setProperty("--crawl-start-x", `${8 + ((index * 23) % 84)}vw`);
		baby.style.setProperty("--crawl-start-y", `${16 + ((index * 31) % 68)}vh`);
		baby.style.setProperty("--crawl-mid-x", `${10 + ((index * 41 + 19) % 80)}vw`);
		baby.style.setProperty("--crawl-mid-y", `${14 + ((index * 29 + 37) % 70)}vh`);
		baby.style.setProperty("--crawl-end-x", `${8 + ((index * 53 + 11) % 84)}vw`);
		baby.style.setProperty("--crawl-end-y", `${16 + ((index * 17 + 43) % 68)}vh`);
		baby.style.setProperty("--crawl-duration", `${16 + (index % 7) * 2}s`);
		baby.style.setProperty("--crawl-delay", `${-(index % 5) * 1.7}s`);

		if (canReceiveBaby) {
			baby.type = "button";
			baby.dataset.action = "receiveBaby";
			baby.setAttribute("aria-label", "Receive a baby");
		} else {
			baby.setAttribute("aria-hidden", "true");
		}

		babyCrawlLayer.appendChild(baby);
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
	const canReceiveBaby = !!dave.availableActions?.canReceiveBaby;
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
	renderCrawlingBabies(stats.count, canReceiveBaby);
}

babyActions.onclick = (event) => {
	if (event.target.dataset.action === "receiveBaby") {
		receiveBaby();
	}
};

babyCrawlLayer.onclick = (event) => {
	if (event.target.dataset.action === "receiveBaby") {
		receiveBaby();
	}
};

loadBabies();
