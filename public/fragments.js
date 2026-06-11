const BASES = ["A", "C", "G", "T"];
const CHUNK_SIZE = 512;
const params = new URLSearchParams(window.location.search);
const userId = params.get("userId");

let sequence = "";
let chunkIndex = 0;
let hasRenderedSequence = false;

function fragmentCount(row) {
	return Number(row?.fragmentsCollected) || 0;
}

function makeSequence(length) {
	const parts = [];
	const batchSize = 65536;

	for (let offset = 0; offset < length; offset += batchSize) {
		const cryptoValues = new Uint8Array(Math.min(batchSize, length - offset));
		crypto.getRandomValues(cryptoValues);
		parts.push(Array.from(cryptoValues, value => BASES[value % BASES.length]).join(""));
	}

	return parts.join("");
}

function gcPercent(value) {
	if (!value.length) {
		return 0;
	}
	const gc = [...value].filter(base => base === "G" || base === "C").length;
	return Math.round((gc / value.length) * 100);
}

function renderMap() {
	const map = document.getElementById("sequenceMap");
	const chunks = Math.max(1, Math.ceil(sequence.length / CHUNK_SIZE));
	map.innerHTML = "";

	for (let index = 0; index < chunks; index += 1) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = index === chunkIndex ? "sequence-map-tile active" : "sequence-map-tile";
		button.setAttribute("aria-label", `Go to sequence block ${index + 1}`);
		button.addEventListener("click", () => {
			chunkIndex = index;
			renderSequence();
		});
		map.appendChild(button);
	}
}

function renderSequence() {
	hasRenderedSequence = true;
	const view = document.getElementById("sequenceView");
	const start = chunkIndex * CHUNK_SIZE;
	const chunk = sequence.slice(start, start + CHUNK_SIZE);
	view.innerHTML = "";

	[...chunk].forEach((base, index) => {
		const span = document.createElement("span");
		span.className = `base base-${base.toLowerCase()}`;
		span.textContent = base;
		span.title = `${base} ${start + index + 1}`;
		view.appendChild(span);
	});

	const end = sequence.length === 0 ? 0 : start + chunk.length;
	document.getElementById("chunkLabel").textContent = `${sequence.length === 0 ? 0 : start + 1}-${end} / ${sequence.length}`;
	document.getElementById("gcLabel").textContent = `GC ${gcPercent(chunk)}%`;
	document.getElementById("previousChunk").disabled = chunkIndex === 0;
	document.getElementById("nextChunk").disabled = start + CHUNK_SIZE >= sequence.length;
	renderMap();
}

async function loadFragments() {
	const res = await fetch(`/api/leaderboard?viewerId=${encodeURIComponent(userId || "")}`);
	const { summary, leaderboard } = await res.json();
	const me = leaderboard.find(row => row.userId === userId);
	const totalFragments = fragmentCount(me);
	const nextLength = totalFragments * 32;

	document.getElementById("personalFragments").textContent = totalFragments;
	document.getElementById("networkFragments").textContent = summary?.totalFragmentsCollected || 0;
	document.getElementById("sequenceLength").textContent = nextLength;

	if (sequence.length !== nextLength || !hasRenderedSequence) {
		sequence = makeSequence(nextLength);
		chunkIndex = 0;
		renderSequence();
	}
}

document.getElementById("previousChunk").addEventListener("click", () => {
	chunkIndex = Math.max(0, chunkIndex - 1);
	renderSequence();
});

document.getElementById("nextChunk").addEventListener("click", () => {
	chunkIndex = Math.min(Math.ceil(sequence.length / CHUNK_SIZE) - 1, chunkIndex + 1);
	renderSequence();
});

document.getElementById("sequenceView").addEventListener("keydown", (event) => {
	if (event.key === "ArrowLeft") {
		document.getElementById("previousChunk").click();
	}
	if (event.key === "ArrowRight") {
		document.getElementById("nextChunk").click();
	}
});

loadFragments();
setInterval(loadFragments, 3000);
