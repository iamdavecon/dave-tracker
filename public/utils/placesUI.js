import { getRange, rangesOverlap } from './distance.js';
import { getAscensionRequiredLevel, maxState } from './state.js';


function metersToPixels(meters, lat, zoom) {
	const metersPerPixel =
		40075016.686 * Math.abs(Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom + 8);

	return meters / metersPerPixel;
}

function createInfluenceSVG({ radiusPx, color, isCanonical }) {
	const edge = "hard"

	return `
    <svg width="${radiusPx * 2}" height="${radiusPx * 2}" viewBox="0 0 ${radiusPx * 2} ${radiusPx * 2}" xmlns="http://www.w3.org/2000/svg">

      <defs>
	<!-- Soft gradient for player influence -->
	<radialGradient id="grad-${color}">
	  <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
	  <stop offset="70%" stop-color="${color}" stop-opacity="0.15"/>
	  <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
	</radialGradient>

	<!-- Subtle pulse animation -->
	<filter id="blur">
	  <feGaussianBlur stdDeviation="${isCanonical ? 0 : 6}" />
	</filter>
      </defs>

      <!-- Influence circle -->
      <circle 
	cx="${radiusPx}" 
	cy="${radiusPx}" 
	r="${radiusPx * 0.95}"
	fill="${isCanonical ? color : `url(#grad-${color})`}"
	opacity="${isCanonical ? 0.15 : 1}"
	filter="${isCanonical ? '' : 'url(#blur)'}"
      />

      ${
	      isCanonical
		      ? `
	<!-- Canonical ring -->
	<circle 
	  cx="${radiusPx}" 
	  cy="${radiusPx}" 
	  r="${radiusPx * 0.95}"
	  fill="none"
	  stroke="${color}"
	  stroke-width="2"
	  opacity="0.6"
	>
	  <animate attributeName="r" values="${radiusPx * 0.9};${radiusPx * 0.95};${radiusPx * 0.9}" dur="4s" repeatCount="indefinite"/>
	</circle>
      `
		      : ""
      }

    </svg>
  `;
}

function svgStringToElement(svgString) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgString, "image/svg+xml");
	return doc.documentElement;
}

function firstEmoji(value = "") {
	return [...value].find(char => /\p{Extended_Pictographic}/u.test(char));
}

function isDavefenceNode(place) {
	return firstEmoji(place?.name) === "🛡";
}

export function addPlace(id, dave, layer, zoom, place, isCanonical, nodeDistanceList, i) {
	const lat = place.lat;
	const lng = place.lng; 
	const radiusMeters = getRange(place);
	//console.log("addPlace: " + JSON.stringify(place, null, 2))

	// --- marker ---
	let name = "";
	if (place.owner) {
		name = "🏙️ "
	}
	name += place.name;
	const marker = L.marker([lat, lng], {
		icon: L.divIcon({
			className: "custom-icon", 
			html: `<div class="canonical-pill center">${name}</div>`,
			iconSize: null,  
			iconAnchor: [0, 0] 
		})
	}).addTo(layer);

	marker.on("click", () => {
		window.location.href = `/place.html?id=${encodeURIComponent(id)}&viewerId=${encodeURIComponent(dave.userId)}`;
	});



	// --- influence overlay ---
	const radiusPx = metersToPixels(radiusMeters, lat, zoom);
	const bounds = L.latLng(lat, lng).toBounds(radiusMeters * 2);

	const svg = createInfluenceSVG({
		radiusPx,
		color: "#fff",   
		isCanonical: 1,
	});

	const overlay = L.svgOverlay(svgStringToElement(svg), bounds, {
		opacity: 1,
		interactive: false
	});

	overlay.addTo(layer);

	//console.log("addPlace: " + JSON.stringify(place, null, 2))
	if (i < 12) {
		// --- Update distance list ---
		const li = document.createElement("li");
		li.classList.add("tappable-list-item");

		// Navigation on click
		li.addEventListener("click", () => {
				window.location.href = `/place.html?id=${encodeURIComponent(id)}&viewerId=${encodeURIComponent(dave.userId)}`;
				});

		const container = document.createElement("div");
		container.style.display = "flex";
		container.style.justifyContent = "space-between";
		container.style.alignItems = "center";

		// Left side: Name
		const nameEl = document.createElement("span");
		nameEl.textContent = name;
		container.appendChild(nameEl);

		if (place.level) {
			const levelEl = document.createElement("span");
			levelEl.textContent = `Level: ${place.level}`;
			levelEl.style.marginLeft = "auto";  
			levelEl.style.textAlign = "center"; 
			levelEl.style.flexGrow = "1"; 
			container.appendChild(levelEl);
		}

		// Right side: Distance + chevron
		const rightSide = document.createElement("div");
		rightSide.style.display = "flex";
		rightSide.style.alignItems = "center";
		rightSide.style.gap = "8px";

		const distance = document.createElement("span");
		distance.textContent = `${Math.round(place.distance)} m`;

		const chevron = document.createElement("span");
		chevron.textContent = ">";
		chevron.style.opacity = "0.5";

		rightSide.appendChild(distance);
		rightSide.appendChild(chevron);

		container.appendChild(rightSide);


		li.appendChild(container);                

		if (isDavefenceNode(place) || rangesOverlap(dave, place)) {
			li.classList.add("in-range");
			li.classList.remove("out-of-range");
		} else {
			li.classList.add("out-of-range");
			li.classList.remove("in-range");
		}

		nodeDistanceList.appendChild(li);
	}
	
}

function addInfluenceOverlay(map, lat, lng, radiusMeters, options = {}) {
	const { color = "#00ffcc", isCanonical = false } = options;

	const zoom = map.getZoom();
	const radiusPx = metersToPixels(radiusMeters, lat, zoom);

	const bounds = L.latLng(lat, lng).toBounds(radiusMeters * 2);

	const svg = createInfluenceSVG({ radiusPx, color, isCanonical });

	const overlay = L.svgOverlay(svg, bounds, {
		opacity: 1,
		interactive: false,
	});

	overlay.addTo(map);

	return overlay;
}

export function bindInfluence(map, config) {
	let overlay = addInfluenceOverlay(map, config.lat, config.lng, config.radius, config);

	map.on("zoomend", () => {
		map.removeLayer(overlay);
		overlay = addInfluenceOverlay(map, config.lat, config.lng, config.radius, config);
	});
}

export function getAscensionText(dave, place) {
	if (dave?.state === "stable") {
		return "";
	}

	const requiredLevel = getAscensionRequiredLevel(dave);
	if (requiredLevel == null) {
		return "";
	}

	const currentMaxState = maxState(dave);
	const hasFragment = (dave.fragmentsCollected?.length ?? 0) > 0;
	if (hasFragment && (place.level ?? 0) >= requiredLevel) {
		const emoji = firstEmoji(place.name);
		if (emoji) {
			switch (emoji) {
				case "🌮": return "CONSUME SACRED TACO";
				case "🌭": return "CONSUME SACRED HOTDOG";
				case "☠️": return "ESCALATE PRIVILEGES";
				case "🛡": return "REQUEST CLEARANCE";
			}
		} 
		switch (currentMaxState) {
			case 0: return "BECOME MORE DAVE";
			case 1: return "REQUEST ELEVATION";
			case 2: return "INSTALL NEW DAVEWARE";
			case 3: return "ENTER RESONANCE";
			case 5: return "ACHIEVE DAVEHOOD";
			case 6: return "PROCEED TO DOPE STATUS";
		}
		
	}

	return "";
	
}
