import * as state from "../public/utils/state.js";
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

	socket.on("downgradeDavePoint", (sourceId, placeId) => {
		console.log("downgradeDavePoint");
	});

	socket.on("visitDavePoint", (sourceId, placeId) => {
		console.log("visitDavePoint");
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
