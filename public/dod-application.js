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
	document.getElementById("codename").value = dave.name;
}

form.addEventListener("submit", (event) => {
	event.preventDefault();

	const formData = new FormData(form);
	const application = {
		codename: formData.get("codename").trim(),
		corruptionDisclosure: formData.get("corruptionDisclosure").trim(),
		nodeResponse: formData.get("nodeResponse"),
		operationalAptitude: formData.get("operationalAptitude"),
		chainOfCommand: formData.get("chainOfCommand").trim(),
		signalEvents: formData.getAll("signalEvents"),
		signalNoise: formData.get("signalNoise").trim(),
		checksum: formData.get("checksum").trim(),
		glitchSymptom: formData.get("glitchSymptom"),
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

	statusEl.textContent = "Application accepted";
	form.hidden = true;
});

loadApplicationContext();
