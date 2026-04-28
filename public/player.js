const params = new URLSearchParams(window.location.search);
const daveId = params.get("id");

async function loadPlayer() {
	if (!daveId) return;

	const res = await fetch(`/api/dave?id=${encodeURIComponent(daveId)}`);
	const dave = await res.json();
	console.log("loading: " + JSON.stringify(dave, null, 2));


	// --- Populate fields ---
	document.getElementById("playerName").textContent = dave.name;

	const stateEl = document.getElementById("playerState");
	stateEl.textContent = dave.state.toUpperCase();
	stateEl.className = "state-pill " + dave.state.toLowerCase();

	document.getElementById("stats").innerHTML = `
		<div class="field">
			<span class="label">Score</span>
			<span>${dave.score}</span>
		</div>
		<div class="field">
			<span class="label">Infected</span>
			<span>${dave.teamVirus}</span>
		</div>
		<div class="field">
			<span class="label">Ascended</span>
			<span>${dave.teamAntivirus}</span>
		</div>
	`;	
}

loadPlayer();
