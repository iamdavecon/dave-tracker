import { getUserId } from './utils/id.js';
import { getItemDefinition } from './utils/itemUI.js';
import * as state from "./utils/state.js";

const params = new URLSearchParams(window.location.search);
const userId = getUserId();
const daveId = params.get("id");
const viewerId = params.get("viewerId") || userId;
const item = params.get("item");
const TACO_GET_LABEL = "Get a Taco";

const socket = io({
	auth: {
		userId
	}
});

const itemDefinition = getItemDefinition(item);
const backLink = document.getElementById("backLink");
const itemIcon = document.getElementById("itemIcon");
const itemName = document.getElementById("itemName");
const itemOwner = document.getElementById("itemOwner");
const itemStats = document.getElementById("itemStats");
const itemActions = document.getElementById("itemActions");
const itemStatus = document.getElementById("itemStatus");

if (daveId) {
	backLink.href = `/player.html?id=${encodeURIComponent(daveId)}&viewerId=${encodeURIComponent(viewerId)}`;
}

function renderUnavailable(message) {
	itemName.textContent = "Item unavailable";
	itemOwner.textContent = message;
	itemStats.innerHTML = "";
	itemActions.innerHTML = "";
}

function renderActions(dave) {
	itemActions.innerHTML = "";

	if (!dave.isMe) {
		return;
	}

	const amount = state.getAmt(dave, item);
	if (amount > 0) {
		itemActions.innerHTML += `<button data-action="becomeItem">Become a ${itemDefinition.item}</button>`;
	}

	if (itemDefinition?.getLabel !== TACO_GET_LABEL) {
		return;
	}

	if (dave.availableActions?.canEatTaco) {
		itemActions.innerHTML += `<button data-action="eatTaco">Eat a taco</button>`;
		return;
	}

	const remaining = dave.availableActions?.tacoRangeBoostRemaining ?? 0;
	if (remaining > 0) {
		itemActions.innerHTML += `<button disabled>Eat a taco (${state.formatCooldownRemaining(remaining)} boost)</button>`;
	}
}

async function loadItem() {
	if (!daveId || !itemDefinition) {
		renderUnavailable("This item link is missing or expired.");
		return;
	}

	const res = await fetch(`/api/dave?id=${encodeURIComponent(daveId)}&viewerId=${encodeURIComponent(viewerId)}`);
	const dave = await res.json();

	if (!res.ok) {
		renderUnavailable(dave.error ?? "Unable to load this Dave.");
		return;
	}

	const amount = state.getAmt(dave, item);
	itemIcon.textContent = itemDefinition.item;
	itemName.textContent = itemDefinition.label;
	itemOwner.textContent = `${dave.name} has ${amount}.`;
	itemStats.innerHTML = `
		<div class="field">
			<span class="label">Count</span>
			<span>${amount}</span>
		</div>
	`;

	renderActions(dave);
}

itemActions.onclick = (event) => {
	const action = event.target.dataset.action;
	if (action === "becomeItem") {
		itemStatus.textContent = `Becoming a ${itemDefinition.item}...`;
		socket.emit("becomeItem", userId, item, (result) => {
			if (!result?.ok) {
				itemStatus.textContent = result?.error || "Unable to update handle.";
				return;
			}

			itemStatus.textContent = `You are now ${result.name}.`;
			loadItem();
		});
		return;
	}

	if (action !== "eatTaco") {
		return;
	}

	itemStatus.textContent = "Eating taco...";
	socket.emit("eatTaco", userId);
};

socket.on("update", () => {
	loadItem();
});

loadItem();
