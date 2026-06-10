export function playPlasticBabyPassMinigame({
	container = document.body,
	overlay = true,
	onComplete = () => {}
} = {}) {
	return new Promise((resolve) => {
		const root = document.createElement("div");
		root.className = overlay ? "plastic-baby-overlay" : "plastic-baby-page-game";
		root.innerHTML = `
			<div class="plastic-baby-stage">
				<div class="plastic-baby-warning">INCOMING PLASTIC BABY</div>
				<div class="plastic-baby-actor plastic-baby-passer">
					<span class="plastic-baby-person">🙂</span>
					<span class="plastic-baby-chopsticks">🥢</span>
				</div>
				<div class="plastic-baby-actor plastic-baby-receiver">
					<span class="plastic-baby-chopsticks">🥢</span>
					<span class="plastic-baby-person">😐</span>
				</div>
				<button class="plastic-baby-catch" type="button" aria-label="Catch plastic baby">👶</button>
				<div class="plastic-baby-status">Someone is trying to pass you a plastic baby with chopsticks.</div>
			</div>
		`;

		const stage = root.querySelector(".plastic-baby-stage");
		const passer = root.querySelector(".plastic-baby-passer");
		const receiver = root.querySelector(".plastic-baby-receiver");
		const catchButton = root.querySelector(".plastic-baby-catch");
		const status = root.querySelector(".plastic-baby-status");
		let finished = false;
		let misses = 0;
		let moveTimer = null;

		function finish(message, won) {
			if (finished) return;
			finished = true;
			if (moveTimer) {
				clearTimeout(moveTimer);
			}
			status.textContent = message;
			catchButton.classList.toggle("caught", won);
			catchButton.classList.toggle("dropped", !won);
			setTimeout(() => {
				if (overlay) {
					root.remove();
				}
				const result = { won };
				onComplete(result);
				resolve(result);
			}, 900);
		}

		function movePlayers() {
			if (finished) return;
			const passerX = 16 + Math.random() * 18;
			const passerY = 34 + Math.random() * 28;
			const receiverX = 66 + Math.random() * 16;
			const receiverY = 34 + Math.random() * 28;

			passer.style.left = `${passerX}%`;
			passer.style.top = `${passerY}%`;
			receiver.style.left = `${receiverX}%`;
			receiver.style.top = `${receiverY}%`;
			catchButton.style.left = `${passerX + 13}%`;
			catchButton.style.top = `${passerY - 2}%`;
			moveTimer = setTimeout(movePlayers, 520);
		}

		catchButton.addEventListener("click", (event) => {
			event.stopPropagation();
			finish("Plastic baby secured with chopsticks.", true);
		});
		stage.addEventListener("click", () => {
			if (finished) return;
			misses += 1;
			if (misses >= 3) {
				finish("Oh no! You dropped the baby!", false);
				return;
			}
			status.textContent = `${3 - misses} ${misses === 2 ? "try" : "tries"} left. Click the baby, not the air.`;
		});
		if (overlay) {
			container.appendChild(root);
		} else {
			container.replaceChildren(root);
		}
		movePlayers();
	});
}
