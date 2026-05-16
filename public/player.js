import { getUserId, isDebugId} from './utils/id.js';
import { bindLogEvents } from './utils/log.js';
import { addMap } from './utils/map.js';
import { displayItems } from './utils/itemUI.js';
import * as state from "./utils/state.js";

const userId = getUserId();
const socket = io({
    auth: {
        userId: userId
    }
});

const params = new URLSearchParams(window.location.search);
const daveId = params.get("id");
const isDebugUser = isDebugId(userId);

let map;

bindLogEvents(socket);

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
			peppercon: "🌶️PepperCon",
			toxicbbg: "🍖 Toxic BBQ",
			drinks: "🍻Cheers!",
			dod: "🛡 DoD",
			general: "🎖️General"
		};

		el.textContent = LABELS[tag] || tag;
		container.appendChild(el);
	});
}

function emit(event) {
	if (event === "spawnCluster") {
		socket.emit(event, userId, 10);
	} else {
		socket.emit(event, userId, daveId);
	}
	location.reload()
}

async function teleport(freeRoam) {
	const payload = JSON.stringify({
		source: userId,
		targetId: daveId,
		targetType: "player",
		freeRoam: freeRoam
	});
	//console.log("teleport: " + payload);
	const res = await fetch('/api/teleport', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload
	});

	if (res.ok) {
		location.reload();
	}
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
		`;
		statHtml += displayItems(dave);
		document.getElementById("stats").innerHTML = statHtml;
	}

	if (dave.isMe) {
		let actionHtml = "";

		//TODO  ??
		//actionHtml += `<button id="chooseTags">Choose </button> `   

		if (dave.availableActions.hasFragments) {
			if (dave.availableActions.tooNear) {
				actionHtml += `<button disabled=true>Daveify This Spot  (Too near a node)</button> `   
			} else {
				actionHtml += `<button data-action="dropDavePoint">Daveify This Spot</button> `   
			}
		} else {
			actionHtml += `<button disabled=true>Daveify This Spot  (Need more Davefluence)</button> `   
		}

		//  DAVEPRIME (ENABLES CHEATS)
		if (dave.availableActions.davePrime) {
			actionHtml += `<button data-action="spawnCluster">Spawn Civilians</button>`
		}

		if (isDebugUser) {
			if (dave.freeRoam) {
				actionHtml += `<button data-action="exitFreeRoam">Exit Free Roam</button>`
			}
		}

		//  DEBUG
		if (isDebugUser) {
			actionHtml += `<button data-action="increaseRank">Increase Rank</button>`
			actionHtml += `<button data-action="decreaseRank">Decrease Rank</button>`
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

			if (dave.availableActions.canDoonShift) {
				const label = dave.state === "infected" ? "CORRUPT HOST" : "VOID HOST";
				actionHtml += `<button data-action="doonShift">${label}</button>`;
			}

			if (dave.availableActions.canGrantDavePrime) {
				actionHtml += `<button data-action="grantDavePrime">GRANT DAVEPRIME</button>`;
			}

			if (isDebugUser) {
				actionHtml += `<button data-action="teleport">Teleport</button>`;
			}

			addActions(actionHtml);
		} else {
			if (isDebugUser) {
				let actionHtml = "";
				actionHtml += `<button data-action="teleport">Teleport</button>`;
				addActions(actionHtml);
			} else {
				document.getElementById("actions").innerHTML = `OUT OF RANGE`;
			}
		}


		map = addMap(dave.mapData, { socket });
	}
}

loadPlayer();




// INFECTION


socket.on('infectResult', (data) => {
	//console.log("infect result: " + data.sucess);
	if (data.success) {
		location.reload()
	}
});

socket.on('notifyInfected', () => {});


//  STABILIZE


socket.on('stabilizeResult', (data) => {
	if (data.success) {
		location.reload()
	}
});
