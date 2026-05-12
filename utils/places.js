import * as state from "../public/utils/state.js";
import { inRange } from "../public/utils/distance.js";
import { getMapData } from "../public/utils/map.js";
import { removeFragment } from './players.js';

function getNewPlace(dave) {
	return {
		id : crypto.randomUUID(),
		lat : dave.lat,
		lng : dave.lng,
		name : dave.name,
		owner : dave.userId,
	}
}

export function registerHandlers(socket, daves, savedPlaces, io) {
	socket.on("dropDavePoint", (sourceId) => {
		//console.log("dropDavePoint");
		const dave = daves[sourceId];
		if (dave) {
			removeFragment(dave);
			state.addTag(dave, "mayor");	
			dave.nodeCount = (dave.nodeCount ?? 0) + 1;
			const newPlace = getNewPlace(dave);
			console.log("dropped: " + JSON.stringify(newPlace, null, 2));
			console.log("from: " + JSON.stringify(dave, null, 2));
			savedPlaces[newPlace.id] = newPlace;
		}
	});

	socket.on("upgradeDavePoint", (sourceId, placeId) => {
		//console.log("upgrade");
		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (dave && place) {
			removeFragment(dave);
			place.level = (place.level ?? 0) + 1;
		} 
	});

	socket.on("setPlaceName", (sourceId, placeId, newName) => {
		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (dave && place && place.owner == sourceId) {
			place.name = newName;	
		}
	});

	socket.on("downgradeDavePoint", (sourceId, placeId) => {
		console.log("downgradeDavePoint");
	});

	socket.on("visitDavePoint", (sourceId, placeId) => {
		console.log("visitDavePoint");
	});

	socket.on("getItem", (sourceId, item) => {
		const dave = daves[sourceId];
		const count = state.add(dave, item); 
		if (item == "🌭" && count == 7) {
			state.addTag(dave, "Timmy");
		}
	});

};

export function getInteraction(me, place) {
	let placeDetails = {
		...place,
		mapData : getMapData(me, place),
		availableActions : state.getPlaceActions(me, place),
	}
	return placeDetails;
}

export function isTooNear(me, savedPlaces) {
	for (const place of Object.values(savedPlaces)) {
		//console.log("\tconsidering : " + place.name + " is " + inRange(place, me));
		if (inRange(place, me)) {
			return true;
		}
	}
	return false;
}

