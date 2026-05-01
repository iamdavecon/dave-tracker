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
		teamAntivirus += dave.nodeCount;
	}
	score = teamVirus + (teamAntivirus * 2); 

	let daveDetails = {
		userId: dave.userId,
		name: dave.name,  
		score: score,
		teamVirus: teamVirus,
		teamAntivirus: teamAntivirus,
		state: state.getState(dave).toUpperCase()
	};

	return daveDetails;
}


export function getInteraction(me, dave) {
	let daveDetails = { ...dave };
	daveDetails.isMe = me.userId === dave.userId;
	daveDetails.availableActions = state.getUserActions(me, dave);

	daveDetails.mapData = getMapData(me, dave);

	return daveDetails;
}

export function removeFragment(dave) {
	if (dave.fragmentsCollected) {
		dave.fragmentsCollected.shift();
	}

}
