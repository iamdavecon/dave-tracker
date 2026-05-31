import * as state from "../public/utils/state.js";
import { getMapData } from "../public/utils/map.js"


export function summarizeDave(dave) {
	let score = 0;
	let teamVirus = 0;
	let teamAntivirus = 0;

	if (dave.infectedUsers) {
		teamVirus += dave.infectedUsers.length; 
	}
	if (dave.fragmentsCollected) {
		teamAntivirus += dave.fragmentsCollected.length;
	}
	if (dave.nodeCount) {
		teamAntivirus += (dave.nodeCount * 5);
	}
	score = teamVirus + (teamAntivirus * 2); 

	let daveDetails = {
		userId: dave.userId,
		name: dave.name,  
		score: score,
		teamVirus: teamVirus,
		teamAntivirus: teamAntivirus,
		state: state.getState(dave).toUpperCase(),
		tags: Array.isArray(dave.tags) ? dave.tags : []
	};

	return daveDetails;
}

export function getLinkedDaveSummaries(dave, allDaves = {}) {
	const linkedIds = Array.isArray(dave?.linkedDaves) ? dave.linkedDaves : [];

	return linkedIds
		.map((id) => allDaves[id])
		.filter(Boolean)
		.map((linkedDave) => ({
			userId: linkedDave.userId,
			name: linkedDave.name,
			state: state.getState(linkedDave).toUpperCase()
		}));
}


export function getInteraction(me, dave, allDaves = {}) {
	let daveDetails = { ...dave };
	daveDetails.isMe = me.userId === dave.userId;
	daveDetails.availableActions = state.getUserActions(me, dave);
	daveDetails.linkedDaves = daveDetails.isMe ? getLinkedDaveSummaries(dave, allDaves) : [];

	daveDetails.mapData = getMapData(me, dave);

	return daveDetails;
}

export function removeFragment(dave) {
	if (dave.fragmentsCollected) {
		dave.fragmentsCollected.shift();
	}

}
