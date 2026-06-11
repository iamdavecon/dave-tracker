const params = new URLSearchParams(window.location.search);
const userId = params.get("userId");

function count(row) {
	return Number(row?.infectionsSpread) || 0;
}

function rowUrl(row) {
	const viewer = userId ? `&viewerId=${encodeURIComponent(userId)}` : "";
	return `/player.html?id=${encodeURIComponent(row.userId)}${viewer}`;
}

function renderRows(leaderboard) {
	const rowsEl = document.getElementById("infectionRows");
	rowsEl.innerHTML = "";

	leaderboard
		.slice()
		.sort((a, b) => count(b) - count(a) || String(a.name || "").localeCompare(String(b.name || "")))
		.forEach((row, index) => {
			const link = document.createElement("a");
			link.className = "status-row";
			link.href = rowUrl(row);

			const rank = document.createElement("span");
			rank.className = "status-row-rank";
			rank.textContent = `#${index + 1}`;

			const name = document.createElement("span");
			name.className = "status-row-name";
			name.textContent = row.name || "unknown";

			const value = document.createElement("span");
			value.className = "status-row-value virus";
			value.textContent = count(row);

			link.append(rank, name, value);
			rowsEl.appendChild(link);
		});
}

async function loadInfections() {
	const res = await fetch(`/api/leaderboard?viewerId=${encodeURIComponent(userId || "")}`);
	const { summary, leaderboard } = await res.json();
	const me = leaderboard.find(row => row.userId === userId);

	document.getElementById("personalInfections").textContent = count(me);
	document.getElementById("networkInfections").textContent = summary?.totalInfectionsSpread || 0;
	renderRows(leaderboard);
	document.getElementById("updated").textContent = new Date().toLocaleTimeString();
}

loadInfections();
setInterval(loadInfections, 3000);
