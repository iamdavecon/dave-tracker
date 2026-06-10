import { playPlasticBabyPassMinigame } from "./utils/plasticBabyPass.js";
import { getUserId } from "./utils/id.js";

const params = new URLSearchParams(window.location.search);
const returnTo = params.get("returnTo") || "/";
const claim = params.get("claim");
const userId = getUserId();
const socket = io({
	auth: {
		userId
	}
});
const backLink = document.getElementById("backLink");
const returnButton = document.getElementById("returnButton");
const doneEl = document.getElementById("babyPassDone");
const mountEl = document.getElementById("babyPassMount");

backLink.href = returnTo;
returnButton.addEventListener("click", () => {
	window.location.href = returnTo;
});

playPlasticBabyPassMinigame({
	container: mountEl,
	overlay: false,
	onComplete(result) {
		if (claim === "plasticBabyPass") {
			socket.emit("finishPlasticBabyPass", userId, !!result?.won);
		} else if (claim === "receiveBaby") {
			socket.emit("finishReceiveBaby", userId, !!result?.won);
		}
		doneEl.hidden = false;
	}
});
