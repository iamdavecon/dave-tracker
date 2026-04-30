function metersToPixels(meters, lat, zoom) {
	const metersPerPixel =
		40075016.686 * Math.abs(Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom + 8);

	return meters / metersPerPixel;
}

function createInfluenceSVG({ radiusPx, color, isCanonical }) {
	const edge = isCanonical ? "hard" : "soft";

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

export function addPlace(id, userId, layer, zoom, place, isCanonical) {
	const lat = place.lat;
	const lng = place.lon; 
	const radiusMeters = place.influence || 100;

	// --- marker ---
	const marker = L.marker([lat, lng], {
		icon: L.divIcon({
			className: "custom-icon", 
			html: `<div class="canonical-pill center">${place.name}</div>`,
			iconSize: null,  
			iconAnchor: [0, 0] 
		})
	}).addTo(layer);

	marker.on("click", () => {
		window.location.href = `/place.html?id=${encodeURIComponent(id)}&viewerId=${encodeURIComponent(userId)}`;
	});



	// --- influence overlay ---
	const radiusPx = metersToPixels(radiusMeters, lat, zoom);
	const bounds = L.latLng(lat, lng).toBounds(radiusMeters * 2);

	const svg = createInfluenceSVG({
		radiusPx,
		color: "#fff",   
		isCanonical: isCanonical,
	});

	const overlay = L.svgOverlay(svgStringToElement(svg), bounds, {
		opacity: 1,
		interactive: false
	});

	overlay.addTo(layer);

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
