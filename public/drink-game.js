import { getUserId } from "./utils/id.js";
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

const canvas = document.getElementById("drinkCanvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("drinkStatus");
const metersEl = document.getElementById("drinkMeters");
const doneEl = document.getElementById("drinkDone");
const backLink = document.getElementById("backLink");
const returnButton = document.getElementById("returnButton");

const DRINK_ITEM = "🍺";
const COCKTAIL_ITEM = "🍸";
const TARGET_FILL = 70;
const MAX_SPILL = 34;
const CUP_WIDTH = 86;
const CUP_HEIGHT = 96;
const DROPLET_RADIUS = 5;

let cupX = canvas.width / 2;
let fill = 0;
let spill = 0;
let finished = false;
let lastTime = performance.now();
let pourX = canvas.width * 0.5;
let pourDrift = 1;
let spawnTimer = 0;
let droplets = [];
let started = false;

backLink.href = returnTo;
returnButton.addEventListener("click", () => {
	window.location.href = returnTo;
});

function firstEmoji(value = "") {
	return [...value].find(char => /\p{Extended_Pictographic}/u.test(char));
}

function stopBeforePlay(message) {
	finished = true;
	statusEl.textContent = message;
	doneEl.hidden = false;
}

async function checkDrinkAvailability() {
	if (!placeId) {
		stopBeforePlay("No drink node selected.");
		return;
	}

	try {
		const res = await fetch(`/api/place?id=${encodeURIComponent(placeId)}&viewerId=${encodeURIComponent(userId)}`);
		const payload = await res.json();
		const { place, dave } = payload;
		if (!res.ok || !place || !dave || firstEmoji(place.name) !== COCKTAIL_ITEM || !place.mapData?.inRange) {
			stopBeforePlay("Get a drink is not available here.");
			return;
		}
		if (!state.canGet(dave, DRINK_ITEM)) {
			const remaining = state.formatCooldownRemaining(state.getCooldownRemaining(dave, DRINK_ITEM));
			stopBeforePlay(`Get a drink cooldown active: ${remaining}.`);
		}
	} catch (error) {
		stopBeforePlay("Could not check drink cooldown. Try again in a moment.");
	}
}

function resizeCanvas() {
	const rect = canvas.getBoundingClientRect();
	const scale = window.devicePixelRatio || 1;
	canvas.width = Math.max(320, Math.round(rect.width * scale));
	canvas.height = Math.round(520 * scale);
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	cupX = Math.min(Math.max(cupX, CUP_WIDTH / 2 + 10), rect.width - CUP_WIDTH / 2 - 10);
}

function getViewWidth() {
	return canvas.width / (window.devicePixelRatio || 1);
}

function getViewHeight() {
	return canvas.height / (window.devicePixelRatio || 1);
}

function placeCup(clientX) {
	if (finished) return;
	const rect = canvas.getBoundingClientRect();
	cupX = Math.min(Math.max(clientX - rect.left, CUP_WIDTH / 2 + 10), rect.width - CUP_WIDTH / 2 - 10);
	started = true;
	statusEl.textContent = "Fill the cup";
}

canvas.addEventListener("click", (event) => {
	placeCup(event.clientX);
});

canvas.addEventListener("pointermove", (event) => {
	if (event.buttons === 1 || event.pointerType === "touch") {
		placeCup(event.clientX);
	}
});

function finish(won, message) {
	if (finished) return;
	finished = true;
	statusEl.textContent = message;
	doneEl.hidden = false;

	if (!placeId) {
		return;
	}

	socket.emit("finishDrinkGame", userId, placeId, won, (result) => {
		if (!result?.ok) {
			statusEl.textContent = result?.error || "The bartender refuses to acknowledge this transaction.";
			return;
		}
		statusEl.textContent = result.granted
			? "Drink secured. (Try not to make this your whole personality.)"
			: message;
	});
}

function update(deltaMs) {
	if (!started) {
		return;
	}

	const width = getViewWidth();
	const height = getViewHeight();
	const cupTop = height - CUP_HEIGHT - 22;
	const cupLeft = cupX - CUP_WIDTH / 2;
	const cupRight = cupX + CUP_WIDTH / 2;

	pourX += pourDrift * deltaMs * 0.055;
	if (pourX < 42 || pourX > width - 42) {
		pourDrift *= -1;
		pourX = Math.min(Math.max(pourX, 42), width - 42);
	}

	spawnTimer += deltaMs;
	while (spawnTimer >= 48) {
		spawnTimer -= 48;
		droplets.push({
			x: pourX + (Math.random() - 0.5) * 16,
			y: 34,
			speed: 170 + Math.random() * 70
		});
	}

	droplets = droplets.filter((drop) => {
		drop.y += drop.speed * deltaMs / 1000;
		if (drop.y >= cupTop + 8 && drop.y <= cupTop + 26 && drop.x >= cupLeft + 10 && drop.x <= cupRight - 10) {
			fill = Math.min(100, fill + 3.2);
			return false;
		}
		if (drop.y > height - 6) {
			spill = Math.min(100, spill + 2.8);
			return false;
		}
		return true;
	});

	metersEl.textContent = `Fill ${Math.round(fill)}% | Spill ${Math.round(spill)}%`;

	if (fill >= TARGET_FILL) {
		finish(true, "Drink secured.");
	} else if (spill >= MAX_SPILL) {
		finish(false, "Too much hit the floor. No drink this time.");
	}
}

function draw() {
	const width = getViewWidth();
	const height = getViewHeight();
	const cupTop = height - CUP_HEIGHT - 22;
	const cupLeft = cupX - CUP_WIDTH / 2;

	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = "#080808";
	ctx.fillRect(0, 0, width, height);

	ctx.strokeStyle = "#5cff9d";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(pourX - 18, 22);
	ctx.lineTo(pourX + 18, 22);
	ctx.lineTo(pourX + 10, 38);
	ctx.lineTo(pourX - 10, 38);
	ctx.closePath();
	ctx.stroke();

	ctx.fillStyle = "#35d6ff";
	for (const drop of droplets) {
		ctx.beginPath();
		ctx.arc(drop.x, drop.y, DROPLET_RADIUS, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.fillStyle = "rgba(53, 214, 255, 0.65)";
	const liquidHeight = (CUP_HEIGHT - 18) * (fill / 100);
	ctx.fillRect(cupLeft + 12, cupTop + CUP_HEIGHT - 10 - liquidHeight, CUP_WIDTH - 24, liquidHeight);

	ctx.strokeStyle = "#ffd700";
	ctx.lineWidth = 2;
	const markY = cupTop + CUP_HEIGHT - 10 - ((CUP_HEIGHT - 18) * (TARGET_FILL / 100));
	ctx.beginPath();
	ctx.moveTo(cupLeft + 6, markY);
	ctx.lineTo(cupLeft + CUP_WIDTH - 6, markY);
	ctx.stroke();

	ctx.strokeStyle = "#f5f5f5";
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(cupLeft + 8, cupTop + 8);
	ctx.lineTo(cupLeft + 18, cupTop + CUP_HEIGHT);
	ctx.lineTo(cupLeft + CUP_WIDTH - 18, cupTop + CUP_HEIGHT);
	ctx.lineTo(cupLeft + CUP_WIDTH - 8, cupTop + 8);
	ctx.stroke();

	ctx.fillStyle = "#777";
	ctx.fillRect(0, height - 8, width, 8);
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
checkDrinkAvailability();
requestAnimationFrame(tick);
