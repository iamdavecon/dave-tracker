import { getUserId } from './utils/id.js';
import { bindLogEvents } from './utils/log.js';
import * as dod from './utils/dod.js';

const userId = getUserId();
const socket = io({
	auth: {
		userId
	}
});

const params = new URLSearchParams(window.location.search);
const placeId = params.get("placeId");

const backLink = document.getElementById("backLink");
const form = document.getElementById("dodApplicationForm");
const statusEl = document.getElementById("applicationStatus");
const applicantNameEl = document.getElementById("applicantName");
const nodeNameEl = document.getElementById("nodeName");
const REWARD_LABELS = {
	"🌮": "Taco",
	"🌭": "Hotdog",
	"🍺": "Drink"
};

bindLogEvents(socket);

if (placeId) {
	backLink.href = `/place.html?id=${encodeURIComponent(placeId)}`;
}

async function loadApplicationContext() {
	if (!placeId) {
		statusEl.textContent = "Missing node";
		form.hidden = true;
		return;
	}

	const res = await fetch(`/api/place?id=${encodeURIComponent(placeId)}&viewerId=${encodeURIComponent(userId)}`);
	if (!res.ok) {
		statusEl.textContent = "Node unavailable";
		form.hidden = true;
		return;
	}

	const { place, dave } = await res.json();
	applicantNameEl.textContent = dave.name;
	nodeNameEl.textContent = place.name;

	if (dod.getLevel(dave) > 0 || dod.hasApplication(dave)) {
		statusEl.textContent = "Application on file";
		form.hidden = true;
		return;
	}

	statusEl.textContent = "Ready";
}

form.addEventListener("submit", (event) => {
	event.preventDefault();

	const formData = new FormData(form);
	const application = {
		nodeResponse: formData.get("nodeResponse"),
		operationalAptitude: formData.get("operationalAptitude"),
		borrowedBadge: formData.get("borrowedBadge"),
		fieldEquipment: formData.get("fieldEquipment"),
		dailyHotDogs: formData.get("dailyHotDogs"),
		chainOfCommand: formData.get("chainOfCommand").trim(),
		signalEvents: formData.getAll("signalEvents"),
		signalNoise: formData.get("signalNoise").trim(),
		glitchSymptom: formData.get("glitchSymptom"),
		reflectionPaperwork: formData.get("reflectionPaperwork"),
		voluntaryDisclosure: formData.get("voluntaryDisclosure"),
		oath: formData.get("oath") === "on"
	};

	socket.emit("dodApply", userId, placeId, application);
});

socket.on("dodApplyResult", (result) => {
	if (!result?.ok) {
		statusEl.textContent = result?.error || "Application rejected";
		return;
	}

	const rewards = Object.entries(result.rewards ?? {})
		.map(([item, count]) => `${count} ${REWARD_LABELS[item] ?? "Item"}${count === 1 ? "" : "s"}`)
		.join(", ");

	statusEl.textContent = rewards
		? `Application accepted. Field provisions issued: ${rewards}.`
		: "Application accepted";
	form.hidden = true;
});

loadApplicationContext();
