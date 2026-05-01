import { getUserId } from './id.js';
import { inRange, getRange } from './distance.js';
import * as state from "./state.js";

const userId = getUserId();
const playerMarkers = {};
let radar = null;

function updateMarker(dave) {
	const stateClass = state.getStateClass(dave);

	const icon = L.divIcon({
		className: "custom-icon",
		html: `<div class="pill center ${stateClass}">
			${dave.name}
		</div>`,
		iconSize: null,
		iconAnchor: [0, 0]
	});

	playerMarkers[dave.userId].setIcon(icon);
}

export function cullNotSeen(map, seen) {
	for (const id in playerMarkers) {
		if (!seen.has(id)) {
			console.log("\tremoving: " + id);
			map.removeLayer(playerMarkers[id]);
			delete playerMarkers[id];
		}
	}
}

function updateRadar(map, dave, me) {
	if (dave.userId !== me.userId) return;

	//console.log("UPDATE ME: " + JSON.stringify(dave, null, 2));

	// Coerce coordinates and range to numbers
	const lat = Number(dave.lat);
	const lng = Number(dave.lng);
	const range = Number(getRange(dave)); // or me.range if preferred
	const radarClass = state.getRadarClass(dave);

	// Validate coordinates
	if (!isFinite(lat) || !isFinite(lng)) {
		console.warn("Invalid coordinates for dave:", dave);
		return;
	}

	if (!radar) {
		// Create the radar circle if it doesn't exist
		radar = L.circle([lat, lng], {
		radius: range,
		className: `radar ${radarClass}`,
		}).addTo(map);
	} else {
		// Update position, radius, and class safely
		radar.setLatLng([lat, lng]);
		radar.setRadius(range);
		radar.setStyle({ className: `radar ${radarClass}` });
	}
}

export function addPlayer(map, me, dave, i) {
	if (!dave.lat || !dave.lng) {
		console.log("\tinvalid user: " + dave.userId);
		return;
	}

	const stateString = state.getState(dave).toUpperCase();
	let marker = {};
	//console.log("UPDATE: " + dave.userId);
	if (playerMarkers[dave.userId]) {
		marker = playerMarkers[dave.userId]
		marker.setLatLng([dave.lat, dave.lng]);
		//console.log("\tmove marker: " + dave.lat, ", " + dave.lng);
	} else {
		//console.log("\tnew marker: " + dave.userId);
		marker = L.marker([dave.lat, dave.lng], {
			icon: L.divIcon({
				className: "custom-icon", 
				iconSize: null, 
				iconAnchor: [0, 0] 
			})
		});
		playerMarkers[dave.userId] = marker;
		marker.addTo(map);
	}
	updateMarker(dave);

	//L.marker([dave.lat, dave.lng], { title: dave.name }).addTo(map);

	updateRadar(map, dave, me);
	if (i < 12) {
		const stateClass = state.getStateClass(dave);

		marker.on("click", () => {
			window.location.href = `/player.html?id=${encodeURIComponent(dave.userId)}&viewerId=${encodeURIComponent(userId)}`;
		});

		// --- Update distance list ---
		const li = document.createElement("li");

		li.classList.add("tappable-list-item");

		// Navigation on click
		li.addEventListener("click", () => {
			window.location.href = `/player.html?id=${encodeURIComponent(dave.userId)}&viewerId=${encodeURIComponent(userId)}`;
		});


		// Create a container div for the layout
		const container = document.createElement("div");
		container.style.display = "flex";
		container.style.alignItems = "center";

		// Left side: Name
		const name = document.createElement("span");
		name.textContent = dave.name;
		container.appendChild(name);

		// Middle: State
		const stateEl = document.createElement("span");
		stateEl.textContent = stateString;
		stateEl.className = stateClass;
		if (stateClass == "ascended" || stateClass == "dope" || stateClass == "awakening" || stateClass == "daveprime") {
			stateEl.style.color = "black";
		} else {
			stateEl.style.color = "white";
		}

		// Optional: prevent row click if you later make this interactive
		stateEl.addEventListener("click", (e) => {
			e.stopPropagation();
		});

		container.appendChild(stateEl);

		if (dave.userId == userId) {
			container.style.justifyContent = "center";
			li.classList.add("current-user");
		} else {
			container.style.justifyContent = "space-between";

			// Right side: Distance + chevron
			const rightSide = document.createElement("div");
			rightSide.style.display = "flex";
			rightSide.style.alignItems = "center";
			rightSide.style.gap = "8px";

			const distance = document.createElement("span");
			distance.textContent = `${Math.round(dave.distance)} m`;

			const chevron = document.createElement("span");
			chevron.textContent = ">";
			chevron.style.opacity = "0.5";

			rightSide.appendChild(distance);
			rightSide.appendChild(chevron);

			container.appendChild(rightSide);


			// Highlight daves in range
			if (inRange(me, dave)) {
				li.classList.add("in-range");
				li.classList.remove("out-of-range");
			} else {
				li.classList.add("out-of-range");
				li.classList.remove("in-range");
			}
		}

		// Append the container to the list item
		li.appendChild(container);

		// Add list item to the distance list
		distanceList.appendChild(li);
	}

}
