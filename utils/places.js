import * as state from "../public/utils/state.js";
import { inRange } from "../public/utils/distance.js";
import { getMapData } from "../public/utils/map.js";
import { removeFragment } from './players.js';

function hasFragment(dave) {
	return (dave?.fragmentsCollected?.length ?? 0) > 0;
}

function getNewPlace(dave) {
	return {
		id : crypto.randomUUID(),
		lat : dave.lat,
		lng : dave.lng,
		name : dave.name,
		owner : dave.userId,
	}
}

export function registerHandlers(socket, daves, savedPlaces, io, logEvent = () => {}) {
	socket.on("dropDavePoint", (sourceId) => {
		//console.log("dropDavePoint");
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		if (!dave || !hasFragment(dave) || !Number.isFinite(dave.lat) || !Number.isFinite(dave.lng) || isTooNear(dave, savedPlaces)) {
			return;
		}

		removeFragment(dave);
		state.addTag(dave, "mayor");	
		dave.nodeCount = (dave.nodeCount ?? 0) + 1;
		const newPlace = getNewPlace(dave);
		//console.log("dropped: " + JSON.stringify(newPlace, null, 2));
		//console.log("from: " + JSON.stringify(dave, null, 2));
		savedPlaces[newPlace.id] = newPlace;
		logEvent(`${dave.name} daveified a new node: ${newPlace.name}.`, {
			userId: dave.userId,
			placeId: newPlace.id
		});
		io.emit("update");
	});

	socket.on("upgradeDavePoint", (sourceId, placeId) => {
		//console.log("upgrade");
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (!dave || !place || !inRange(dave, place) || !state.getPlaceActions(dave, place).canUpgrade) {
			return;
		}

		removeFragment(dave);
		place.level = (place.level ?? 0) + 1;
		logEvent(`${dave.name} upgraded ${place.name} to level ${place.level}.`, {
			userId: dave.userId,
			placeId
		});
		io.emit("update");
	});

	socket.on("setPlaceName", (sourceId, placeId, newName) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		const place = savedPlaces[placeId];
		if (dave && place && place.owner == sourceId) {
			const oldName = place.name;
			place.name = newName;	
			logEvent(`${dave.name} renamed ${oldName} to ${place.name}.`, {
				userId: dave.userId,
				placeId
			});
		}
	});

	socket.on("downgradeDavePoint", (sourceId, placeId) => {
		console.log("downgradeDavePoint");
	});

	socket.on("visitDavePoint", (sourceId, placeId) => {
		console.log("visitDavePoint");
	});

	socket.on("getItem", (sourceId, item) => {
		if (sourceId !== socket.userId) {
			return;
		}

		const dave = daves[sourceId];
		if (!dave) {
			return;
		}
		const count = state.add(dave, item); 
		//console.log("GETITEM: " + item + " => " + count);
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
