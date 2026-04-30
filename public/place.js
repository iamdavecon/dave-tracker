import { getUserId } from './utils/id.js';
import * as state from "./utils/state.js";

const userId = getUserId();
const socket = io({
    auth: {
        userId: userId
    }
});

const params = new URLSearchParams(window.location.search);
const placeId = params.get("id");


async function loadPlace() {
	if (!placeId) return;

	const res = await fetch(`/api/place?id=${encodeURIComponent(placeId)}&viewerId=${encodeURIComponent(userId)}`);
	const place = await res.json();

	console.log("loading: " + JSON.stringify(place, null, 2));


	// --- Populate fields ---
	document.getElementById("name").textContent = place.name;
}


loadPlace();

