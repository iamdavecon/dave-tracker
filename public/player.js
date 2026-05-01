import { getUserId } from './utils/id.js';
import { logEvent } from './utils/log.js';
import { addMap } from './utils/map.js';
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

function renderTags(tags = []) {
	const container = document.getElementById("player-tags");
	container.innerHTML = "";

	tags.forEach(tag => {
		const el = document.createElement("span");
		el.className = `tag tag-${tag}`;
		// Pretty label
		const LABELS = {
			mayor: "🏛 Mayor",
			doon: "💀 DOON",
			dod: "🛡 DoD"
		};

		el.textContent = LABELS[tag] || tag;
		container.appendChild(el);
	});
}

function emit(event) {
	socket.emit(event, userId, daveId);
	switch(event) {
		case "spawnCluster":
			logEvent("BOTS SPAWNED");
			break;	

		default:
			location.reload()
	}
}

async function teleport(freeRoam) {
	const payload = JSON.stringify({
		source: userId,
		targetId: daveId,
		targetType: "player",
		freeRoam: freeRoam
	});
	//console.log("teleport: " + payload);
	await fetch('/api/teleport', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload
	});

	logEvent("Teleported");
}

function addActions(actionHtml) {
	const actionsContainer = document.getElementById("actions");

	actionsContainer.innerHTML = actionHtml;

	actionsContainer.onclick = (e) => {
		const action = e.target.dataset.action;
		if (!action) return;

		switch (action) {
			case "antivirus":
				window.location.href = "https://iamdavecon.github.io/bb/";
				break;

			case "teleport":
				teleport(true);
				break;
			case "exitFreeRoam":
				logEvent("DONE");
				teleport(false);
				break;	
			default:
				emit(action);
		}
	};
}

async function loadPlayer() {
	if (!daveId) return;

	const res = await fetch(`/api/dave?id=${encodeURIComponent(daveId)}&viewerId=${encodeURIComponent(userId)}`);
	const dave = await res.json();
	//console.log("loading: " + JSON.stringify(dave, null, 2));


	// --- Populate fields ---
	document.getElementById("playerName").textContent = dave.name;

	const stateEl = document.getElementById("playerState");
	stateEl.textContent = dave.state.toUpperCase();
	stateEl.className = "state-pill " + dave.state.toLowerCase();

	if (dave.tags) {
		renderTags(dave.tags);
	}

	let infectedCount = 0;
	if (dave.infectedUsers) {
		infectedCount = dave.infectedUsers.length; 
	}
	let fragments = 0;
	if (dave.fragmentsCollected) {
		fragments = dave.fragmentsCollected.length; 
	}
	const nodes = dave.nodeCount ?? 0;
 
	document.getElementById("stats").innerHTML = `
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

	`;	

	if (dave.isMe) {
		let actionHtml = "";

		//TODO  ??
		//actionHtml += `<button id="chooseTags">Choose </button> `   

		if (dave.availableActions.hasFragments) {
			actionHtml += `<button data-action="dropDavePoint">Daveify This Spot</button> `   
		} else {
			actionHtml += `<button disabled=true>Daveify This Spot  (Need more Davefluence)</button> `   
		}

		//  DAVEPRIME (CHEATS)
		if (dave.availableActions.davePrime) {
			actionHtml += `<button data-action="spawnCluster">Spawn Civilians</button>`
			if (dave.freeRoam) {
				actionHtml += `<button data-action="exitFreeRoam">Exit Free Roam</button>`
			}

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

			if (dave.availableActions.canPatch) {
				if (dave.availableActions.canBePatched) {
					actionHtml += `<button data-action="stabilize">STABILIZE HOST</button>`;
				}
			} else {
				actionHtml += `<button data-action="antivirus">ANTIVIRUS REQUIRED</button>`;
			}

			if (dave.availableActions.canAscend) {
				actionHtml += `<button data-action="ascend">ASCEND</button>`;
			}

			if (dave.availableActions.canDaveputize) {
				actionHtml += `<button data-action="daveputize">DAVEPUTIZE</button>`;
			}

			if (dave.availableActions.davePrime) {
				actionHtml += `<button data-action="teleport">Teleport & Free Roam</button>`;
			}

			addActions(actionHtml);
		} else {
			if (dave.availableActions.davePrime) {
				let actionHtml = "";
				actionHtml += `<button data-action="teleport">Teleport & Free Roam</button>`;
				addActions(actionHtml);
			} else {
				document.getElementById("actions").innerHTML = `OUT OF RANGE`;
			}
		}


		map = addMap(dave.mapData);
	}
}

loadPlayer();




// INFECTION


socket.on('infectResult', (data) => {
	//console.log("infect result: " + data.sucess);
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
		location.reload()
	}
});



