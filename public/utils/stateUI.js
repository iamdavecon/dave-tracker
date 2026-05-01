import * as state from "./state.js";

let isEditingName = false;

const nameInput = document.getElementById('userName');

nameInput.addEventListener('focus', () => {
	isEditingName = true;
});

nameInput.addEventListener('blur', () => {
	isEditingName = false;
});


function updateButtons(me) {
	if (state.canPatch(me)) {
		const btn = document.getElementById("install-antivirus");
		btn.style.display = "none";
	} else {
		document.getElementById("install-antivirus").onclick = () => {
			window.location.href = "https://iamdavecon.github.io/bb/";
		};
	}
}

export function addStateUI(me, nDaves) {
	//console.log("addStateUI: " + JSON.stringify(me, null, 2));

	if (!isEditingName) {
		nameInput.value = me.name;
	}

	const totalEl = document.getElementById('total');
	totalEl.textContent = nDaves;

	// --- Update state/status --
	const stringValue = state.getState(me).toUpperCase();
	const stateEl = document.getElementById('state');
	stateEl.textContent = stringValue;
	stateEl.className = "value pill " + state.getStateClass(me);

	const infectedCountEl = document.getElementById('infectedCount');
	if (me.infectedUsers) {
		infectedCountEl.textContent = me.infectedUsers.length; 
	} else {
		infectedCountEl.textContent = 0;
	}

	const fragmentsEl = document.getElementById('fragments');

	if (me.fragmentsCollected) {
		fragmentsEl.textContent = me.fragmentsCollected.length;
	} else {
		fragmentsEl.textContent = 0;
	}

	updateButtons()
}
