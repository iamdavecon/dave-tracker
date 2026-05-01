import { getUserId } from './id.js';
import { inRange, getRange } from './distance.js';
import * as state from "./state.js";

const userId = getUserId();
const playerMarkers = {};
let radar;

export function updateMarker(dave) {
	const stateClass = state.getStateClass(dave);
	console.log(`UM\t${dave.name}`);

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

export function addPlayer(map, me, dave, i) {
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


	if (dave.userId == userId) {
		const radarClass = state.getRadarClass(dave);
		const range = getRange(dave);
		if (radar) {
			radar.setLatLng([me.lat, me.lng]);
			radar.setRadius(me.range);
			const el = radar.getElement();
			if (!el) {
				return;
			}

			el.setAttribute("class", `radar ${radarClass}`);

		} else {
			radar = L.circle([dave.lat, dave.lng], {
				radius: range,
				className: `radar ${radarClass}`,
			}).addTo(map);
		}
	} 
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
