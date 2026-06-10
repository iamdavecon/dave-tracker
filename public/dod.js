import { getUserId } from './utils/id.js';
import { bindLogEvents } from './utils/log.js';
import { COMMENDATION_THRESHOLD, getCommendations } from './utils/dod.js';

const EXCHANGE_COST = 3;
const userId = getUserId();
const socket = io({
	auth: {
		userId
	}
});

const agentNameEl = document.getElementById("agentName");
const infectionCountEl = document.getElementById("infectionCount");
const fragmentCountEl = document.getElementById("fragmentCount");
const commendationCountEl = document.getElementById("commendationCount");
const exchangeBtn = document.getElementById("exchangeBtn");
const exchangeStatusEl = document.getElementById("exchangeStatus");
const promotionStatusEl = document.getElementById("promotionStatus");

bindLogEvents(socket);

function render(dave) {
	const infections = dave?.infectedUsers?.length ?? 0;
	const fragments = dave?.fragmentsCollected?.length ?? 0;
	const commendations = getCommendations(dave);
	const hasGeneral = Array.isArray(dave?.tags) && dave.tags.includes("general");

	agentNameEl.textContent = dave?.name ?? "Unknown";
	infectionCountEl.textContent = infections;
	fragmentCountEl.textContent = fragments;
	commendationCountEl.textContent = `${Math.min(commendations, COMMENDATION_THRESHOLD)} / ${COMMENDATION_THRESHOLD}`;

	if (!dave || (dave.dodLevel ?? 0) < 1) {
		exchangeBtn.disabled = true;
		exchangeStatusEl.textContent = "DoD credentials not found. This absence has been noted.";
		promotionStatusEl.textContent = "Promotion board sealed pending DoD acceptance.";
		return;
	}

	exchangeBtn.disabled = infections < EXCHANGE_COST;
	exchangeStatusEl.textContent = infections < EXCHANGE_COST
		? `${EXCHANGE_COST - infections} more infections required for reclassification.`
		: "Exchange authorized.";
	promotionStatusEl.textContent = hasGeneral
		? "General classification active."
		: `${Math.max(0, COMMENDATION_THRESHOLD - commendations)} commendations required for General classification.`;
}

async function loadDave() {
	const res = await fetch("/api/data");
	if (!res.ok) {
		exchangeStatusEl.textContent = "Console unavailable.";
		return;
	}

	const { daves } = await res.json();
	render(daves[userId]);
}

exchangeBtn.addEventListener("click", () => {
	exchangeBtn.disabled = true;
	exchangeStatusEl.textContent = "Submitting reclassification packet...";
	socket.emit("dodExchangeInfections", userId);
});

socket.on("dodExchangeResult", (result) => {
	exchangeStatusEl.textContent = result?.ok
		? "Exchange approved. Fragment issued."
		: result?.error || "Exchange denied.";
	loadDave();
});

socket.on("update", loadDave);

loadDave();
