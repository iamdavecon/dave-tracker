import { getUserId } from './utils/id.js';
import * as state from "./utils/state.js";

const userId = getUserId();
const socket = io({
    auth: {
        userId: userId
    }
});

const params = new URLSearchParams(window.location.search);
const daveId = params.get("id");

let map;

function createPill(label, state = "neutral", isYou = false) {
	return L.divIcon({
		className: "",
		html: `
			<div class="map-pill ${state} ${isYou ? "you" : ""}">
				${label}
			</div>
		`,
		iconSize: null
	});
}

function logEvent(message) {
	const logList = document.getElementById("logList");

	const li = document.createElement("li");

	const timestamp = new Date().toLocaleTimeString();

	li.textContent = `[${timestamp}] ${message}`;

	logList.prepend(li);

	const maxLogs = 10;
	while (logList.children.length > maxLogs) {
		logList.removeChild(logList.lastChild);
	}
}

async function loadPlayer() {
	if (!daveId) return;

	const res = await fetch(`/api/dave?id=${encodeURIComponent(daveId)}&viewerId=${encodeURIComponent(userId)}`);
	const dave = await res.json();
	console.log("loading: " + JSON.stringify(dave, null, 2));


	// --- Populate fields ---
	document.getElementById("playerName").textContent = dave.name;

	const stateEl = document.getElementById("playerState");
	stateEl.textContent = dave.state.toUpperCase();
	stateEl.className = "state-pill " + dave.state.toLowerCase();

	document.getElementById("stats").innerHTML = `
		<div class="field">
			<span class="label">Score</span>
			<span>${dave.score}</span>
		</div>
		<div class="field">
			<span class="label">Infected</span>
			<span>${dave.teamVirus}</span>
		</div>
		<div class="field">
			<span class="label">Ascended</span>
			<span>${dave.teamAntivirus}</span>
		</div>
	`;	

	if (dave.isMe) {
		let actionHtml = "";

		//TODO  ??
		//actionHtml += `<button id="chooseTags">CHOOSE TAGS</button> `   



		if (dave.availableActions.dropPin) {
			actionHtml += `<button id="davePoint">Daveify This Spot</button> `   
		} else {
			actionHtml += `<button disabled=true>Daveify This Spot  (Need more Davefluence)</button> `   
		}

		//  DAVEPRIME (CHEATS)
		if (dave.availableActions.davePrime) {
			actionHtml += `<button id="spawnCluster">SPAWN CLUSTER</button>`
		}

		document.getElementById("actions").innerHTML = actionHtml;

		const davePoint = document.getElementById("davePoint");
		if (davePoint) {
			 davePoint.addEventListener("click", () => {
				socket.emit("dropDavePoint", userId);
			});
		}
		const spawnBtn = document.getElementById("spawnCluster");
		if (spawnBtn) {
			 spawnBtn.addEventListener("click", () => {
				 logEvent("BOTS SPAWNED");
				socket.emit("spawnCluster", userId);
			});
		}

	} else  {
		if (dave.inRange) {
			let actionHtml = "";

			// Basic infect button
			actionHtml += `<button id="infectBtn">TRANSMIT VIRUS</button>`;

			// Conditional stabilize button
			if (dave.availableActions.canAscend) {
				actionHtml += `<button id="stabilizeBtn">STABILIZE HOST</button>`;
			} else {
				actionHtml += `<button id="stabilizeBtn">ANTIVIRUS REQUIRED</button>`;
			}

			// Conditional other actions
			if (dave.availableActions.canAscend) {
				actionHtml += `<button id="ascend">ASCEND</button>`;
			}

			if (dave.availableActions.canDaveputize) {
				actionHtml += `<button id="daveputize">DAVEPUTIZE</button>`;
			}

			if (actionHtml.trim().length === 0) {
				actionHtml = `You must advance to unlock options`;
			}

			// Add buttons to DOM
			const actionsContainer = document.getElementById("actions");
			actionsContainer.innerHTML = actionHtml;

			// Add event listeners AFTER elements exist
			const infectBtn = document.getElementById("infectBtn");
			if (infectBtn) {
				if (dave.availableActions.canInfect) {
					infectBtn.addEventListener("click", () => {
						console.log("emit infect");
						socket.emit("infect", userId, daveId);
					});
				} else {
					infectBtn.disabled = true;
				}
			}

			const stabilizeBtn = document.getElementById("stabilizeBtn");
			if (stabilizeBtn) {
				if (dave.availableActions.canAscend) {
					stabilizeBtn.addEventListener("click", () => {
						socket.emit("stabilize");
					});
				} else {
					stabilizeBtn.addEventListener("click", () => {
						window.location.href = "https://iamdavecon.github.io/bb/";
					});
				}
			}

			const ascendBtn = document.getElementById("ascend");
			if (ascendBtn) {
				ascendBtn.addEventListener("click", () => {
					socket.emit("ascend");
				});
			}

			const daveputizeBtn = document.getElementById("daveputize");
			if (daveputizeBtn) {
				daveputizeBtn.addEventListener("click", () => {
					socket.emit("daveputize");
				});
			}

		} else {
			document.getElementById("actions").innerHTML = `OUT OF RANGE`;
		}



		// --- init map ---
		map = L.map("map");

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: "© OpenStreetMap"
		}).addTo(map);

		// --- markers ---
		const meMarker = L.marker([dave.viewerLat, dave.viewerLon], {
			icon: createPill("YOU", "", true)
		}).addTo(map);

		const targetMarker = L.marker([dave.targetLat, dave.targetLon], {
			icon: createPill(dave.name, dave.state?.toLowerCase())
		}).addTo(map);

		//L.marker([dave.targetLat, dave.targetLon], { title: dave.icon }).addTo(map);


		// --- fit bounds to both ---
		const group = new L.featureGroup([meMarker, targetMarker]);
		map.fitBounds(group.getBounds(), { padding: [30, 30] });

		// --- draw connection line ---
		L.polyline(
			[
				[dave.viewerLat, dave.viewerLon],
				[dave.targetLat, dave.targetLon]
			],
			{ color: "white", opacity: 0.5 }
		).addTo(map);
	}
}

loadPlayer();




// INFECTION


socket.on('infectResult', (data) => {
	console.log("infect result: " + data.sucess);
	if (data.success) {
		logEvent(`Host infected`);
		location.reload()
	}
});

socket.on('notifyInfected', (data) => {
	logEvent(`You have been infected by ${data.by}!`);
});


//  STABILIZE


socket.on('stabilizeResult', (data) => {
	if (data.success) {
		logEvent(`Fragment acquired`);
	}
});



