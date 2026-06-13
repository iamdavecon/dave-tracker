import { getUserId } from "./utils/id.js";
import {
	canAttemptPlaceFragmentChallenge,
	getPlaceFragmentChallengeCooldownRemaining,
	getPlaceFragmentChallengeForAction,
	getPlaceFragmentChallengeForPlaceName
} from "./utils/placeChallenges.js";
import * as state from "./utils/state.js";

const params = new URLSearchParams(window.location.search);
const placeId = params.get("placeId");
const returnTo = params.get("returnTo") || (placeId ? `/place.html?id=${encodeURIComponent(placeId)}` : "/");
const userId = getUserId();
const socket = io({
	auth: {
		userId
	}
});

const canvas = document.getElementById("solderCanvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("solderStatus");
const metersEl = document.getElementById("solderMeters");
const doneEl = document.getElementById("solderDone");
const backLink = document.getElementById("backLink");
const returnButton = document.getElementById("returnButton");

const PAD_RADIUS = 22;
const TARGET_SOLDER = 100;
const MAX_HEAT_DISPLAY = 124;
const COOL_RATE = 18;
const HEAT_RATE = 72;
const SOLDER_RATE = 42;
const hardwareChallenge = getPlaceFragmentChallengeForAction("hardwareHacking");

let pads = [];
let pointer = { x: 210, y: 260, active: false, visible: false };
let finished = false;
let started = false;
let lastTime = performance.now();

backLink.href = returnTo;
returnButton.addEventListener("click", () => {
	window.location.href = returnTo;
});

function stopBeforePlay(message) {
	finished = true;
	statusEl.textContent = message;
	doneEl.hidden = false;
}

async function checkSolderingAvailability() {
	if (!placeId) {
		stopBeforePlay("No HHV node selected.");
		return;
	}

	try {
		const res = await fetch(`/api/place?id=${encodeURIComponent(placeId)}&viewerId=${encodeURIComponent(userId)}`);
		const payload = await res.json();
		const { place, dave } = payload;
		const challenge = getPlaceFragmentChallengeForPlaceName(place?.name);
		if (!res.ok || !place || !dave || challenge?.action !== "hardwareHacking" || !place.mapData?.inRange) {
			stopBeforePlay("HHV soldering is not available here.");
			return;
		}
		if (!canAttemptPlaceFragmentChallenge(dave, hardwareChallenge)) {
			const remaining = state.formatCooldownRemaining(getPlaceFragmentChallengeCooldownRemaining(dave, hardwareChallenge));
			stopBeforePlay(`HHV soldering cooldown active: ${remaining}.`);
		}
	} catch (error) {
		stopBeforePlay("Could not check HHV soldering. Try again in a moment.");
	}
}

function getViewWidth() {
	return canvas.width / (window.devicePixelRatio || 1);
}

function getViewHeight() {
	return canvas.height / (window.devicePixelRatio || 1);
}

function layoutPads() {
	const width = getViewWidth();
	const height = getViewHeight();
	const centerX = width / 2;
	const top = Math.max(100, height * 0.22);
	const gap = Math.min(82, Math.max(56, (height - 220) / 4));
	pads = [
		{ id: "vcc", x: centerX - 92, y: top, solder: pads[0]?.solder ?? 0, heat: pads[0]?.heat ?? 0 },
		{ id: "sig", x: centerX + 92, y: top + gap * 0.55, solder: pads[1]?.solder ?? 0, heat: pads[1]?.heat ?? 0 },
		{ id: "gnd", x: centerX - 78, y: top + gap * 1.65, solder: pads[2]?.solder ?? 0, heat: pads[2]?.heat ?? 0 },
		{ id: "io", x: centerX + 74, y: top + gap * 2.55, solder: pads[3]?.solder ?? 0, heat: pads[3]?.heat ?? 0 },
		{ id: "led", x: centerX, y: top + gap * 3.55, solder: pads[4]?.solder ?? 0, heat: pads[4]?.heat ?? 0 }
	];
}

function resizeCanvas() {
	const rect = canvas.getBoundingClientRect();
	const scale = window.devicePixelRatio || 1;
	canvas.width = Math.max(320, Math.round(rect.width * scale));
	canvas.height = Math.round(520 * scale);
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	layoutPads();
}

function setPointer(event, active) {
	if (finished) return;
	const rect = canvas.getBoundingClientRect();
	pointer = {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
		active,
		visible: true
	};
	if (active) {
		started = true;
		statusEl.textContent = "Tin each pad until every joint turns silver.";
	}
}

canvas.addEventListener("pointerdown", (event) => {
	canvas.setPointerCapture(event.pointerId);
	setPointer(event, true);
});

canvas.addEventListener("pointermove", (event) => {
	setPointer(event, pointer.active);
});

canvas.addEventListener("pointerup", (event) => {
	setPointer(event, false);
});

canvas.addEventListener("pointercancel", () => {
	pointer.active = false;
});

function getTargetPad() {
	return pads.find((pad) => {
		const dx = pointer.x - pad.x;
		const dy = pointer.y - pad.y;
		return Math.hypot(dx, dy) <= PAD_RADIUS + 12;
	});
}

function finish(won, message) {
	if (finished) return;
	finished = true;
	statusEl.textContent = message;
	doneEl.hidden = false;

	if (!placeId) {
		return;
	}

	socket.emit("finishSolderingGame", userId, placeId, won, (result) => {
		if (!result?.ok) {
			statusEl.textContent = result?.error || "The badge rejects this solder joint.";
			return;
		}
		statusEl.textContent = result.granted
			? `Badge soldered. 𓇲 SAOs: ${result.saoCount}.`
			: message;
	});
}

function update(deltaMs) {
	if (!started) {
		return;
	}

	const targetPad = pointer.active ? getTargetPad() : null;
	for (const pad of pads) {
		if (pad === targetPad && pad.solder < TARGET_SOLDER) {
			pad.heat = Math.min(150, pad.heat + HEAT_RATE * deltaMs / 1000);
			if (pad.heat >= 42) {
				pad.solder = Math.min(TARGET_SOLDER, pad.solder + SOLDER_RATE * deltaMs / 1000);
			}
		} else {
			pad.heat = Math.max(0, pad.heat - COOL_RATE * deltaMs / 1000);
		}
	}

	const completed = pads.filter((pad) => pad.solder >= TARGET_SOLDER).length;
	const hottest = Math.max(...pads.map((pad) => pad.heat));
	metersEl.textContent = `Joints ${completed}/${pads.length} | Heat ${Math.round(hottest)}%`;

	if (completed === pads.length) {
		finish(true, "Clean joints. Badge boots.");
	}
}

function drawTrace(from, to) {
	ctx.strokeStyle = "#2ee66b";
	ctx.lineWidth = 6;
	ctx.lineCap = "round";
	ctx.globalAlpha = 0.42;
	ctx.beginPath();
	ctx.moveTo(from.x, from.y);
	ctx.lineTo((from.x + to.x) / 2, from.y);
	ctx.lineTo((from.x + to.x) / 2, to.y);
	ctx.lineTo(to.x, to.y);
	ctx.stroke();
	ctx.globalAlpha = 1;
}

function draw() {
	const width = getViewWidth();
	const height = getViewHeight();
	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = "#07100d";
	ctx.fillRect(0, 0, width, height);

	ctx.fillStyle = "#10241b";
	ctx.strokeStyle = "#1f6f46";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.roundRect(34, 54, width - 68, height - 96, 18);
	ctx.fill();
	ctx.stroke();

	for (let index = 1; index < pads.length; index += 1) {
		drawTrace(pads[index - 1], pads[index]);
	}

	ctx.font = "700 13px sans-serif";
	ctx.textAlign = "center";
	ctx.fillStyle = "#9be8b1";
	ctx.fillText("DLK", width / 2, 88);

	for (const pad of pads) {
		const solderRatio = pad.solder / TARGET_SOLDER;
		const heatRatio = Math.min(1, pad.heat / MAX_HEAT_DISPLAY);
		ctx.fillStyle = "#c47a25";
		ctx.beginPath();
		ctx.arc(pad.x, pad.y, PAD_RADIUS, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = `rgba(255, ${Math.round(220 - heatRatio * 110)}, ${Math.round(110 - heatRatio * 80)}, 0.7)`;
		ctx.beginPath();
		ctx.arc(pad.x, pad.y, PAD_RADIUS * heatRatio, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = "#d7e3ea";
		ctx.beginPath();
		ctx.arc(pad.x, pad.y, PAD_RADIUS * solderRatio, 0, Math.PI * 2);
		ctx.fill();

		ctx.strokeStyle = pad.solder >= TARGET_SOLDER ? "#d7e3ea" : "#ffd479";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(pad.x, pad.y, PAD_RADIUS + 2, 0, Math.PI * 2);
		ctx.stroke();

		ctx.fillStyle = "#d9ffe5";
		ctx.font = "700 11px sans-serif";
		ctx.fillText(pad.id.toUpperCase(), pad.x, pad.y + PAD_RADIUS + 18);
	}

	if (pointer.visible && pointer.active) {
		ctx.strokeStyle = "#ffcf5a";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(pointer.x, pointer.y, 14, 0, Math.PI * 2);
		ctx.stroke();
	}
}

function tick(now) {
	const deltaMs = Math.min(34, now - lastTime);
	lastTime = now;
	if (!finished) {
		update(deltaMs);
	}
	draw();
	requestAnimationFrame(tick);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
checkSolderingAvailability();
requestAnimationFrame(tick);
