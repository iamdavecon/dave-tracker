import { getUserId } from './id.js';
import { inRange, getRange } from './distance.js';
import * as state from "./state.js";

const BABY_ITEM = "👶";
const playerMarkers = {};
let radar = null;

function getCurrentUserId() {
	return getUserId();
}

function updateMarker(dave, options = {}) {
	const stateClass = state.getStateClass(dave);
	const goonClass = dave.name === "GOON" ? "goon" : "";

	const icon = L.divIcon({
		className: "custom-icon",
		html: `<div class="pill center ${stateClass} ${goonClass}">
			${dave.name}
		</div>`,
		iconSize: null,
		iconAnchor: [0, 0]
	});


	const marker = playerMarkers[dave.userId];
	marker.setLatLng([dave.lat, dave.lng]);
	marker.setIcon(icon);


	//L.marker([dave.lat, dave.lng], { title: dave.name }).addTo(map);
	marker.off("click");
	marker.on("click", () => {
		if (typeof options.onMarkerClick === "function") {
			options.onMarkerClick({
				type: "player",
				id: dave.userId,
				lat: dave.lat,
				lng: dave.lng
			});
			return;
		}

		const userId = getCurrentUserId();
		window.location.href = `/player.html?id=${encodeURIComponent(dave.userId)}&viewerId=${encodeURIComponent(userId)}`;
	});

}

export function cullNotSeen(map, seen) {
	for (const id in playerMarkers) {
		if (!seen.has(id)) {
			map.removeLayer(playerMarkers[id]);
			delete playerMarkers[id];
		}
	}

	if (!seen.has(getCurrentUserId()) && radar) {
		map.removeLayer(radar);
		radar = null;
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

export function hasPlasticBaby(dave) {
	return state.getAmt(dave, BABY_ITEM) > 0;
}

export function addPlayer(map, me, dave, i, options = {}) {
	if (dave.lat == null || dave.lng == null) {
		console.log("\tinvalid user: " + dave.userId);
		return;
	}

	const stateString = state.getState(dave).toUpperCase();
	const userId = getCurrentUserId();
	//console.log("UPDATE: " + dave.userId);
	if (!playerMarkers[dave.userId]) {
		//console.log("\tnew marker: " + dave.userId);
		const marker = L.marker([dave.lat, dave.lng], {
			icon: L.divIcon({
				className: "custom-icon", 
				iconSize: null, 
				iconAnchor: [0, 0] 
			})
		});
		playerMarkers[dave.userId] = marker;
		marker.addTo(map);
	}
	updateMarker(dave, options);


	updateRadar(map, dave, me);
	if (options.showInList !== false && i < 12) {
		const stateClass = state.getStateClass(dave);

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
		const nameWrap = document.createElement("span");
		nameWrap.className = "online-dave-name";
		nameWrap.appendChild(name);

		if (hasPlasticBaby(dave)) {
			const babyIcon = document.createElement("span");
			babyIcon.className = "online-dave-baby";
			babyIcon.textContent = BABY_ITEM;
			babyIcon.title = "Has a plastic baby";
			babyIcon.setAttribute("aria-label", "Has a plastic baby");
			nameWrap.appendChild(babyIcon);
		}

		container.appendChild(nameWrap);

		// Middle: State
		const stateEl = document.createElement("span");
		stateEl.textContent = stateString;
		stateEl.className = stateClass;
		if (["ascended", "dope", "daveprime"].includes(stateClass)) {
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
