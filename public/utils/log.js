const MAX_LOGS = 20;
let logSocket;

function getMessage(entry) {
	return typeof entry === "string" ? entry : entry?.message;
}

function getTimestamp(entry) {
	return typeof entry === "object" && entry?.timestamp
		? new Date(entry.timestamp)
		: new Date();
}

export function logEvent(entry) {
	const logList = document.getElementById("logList");
	const message = getMessage(entry);

	if (!logList || !message) {
		return;
	}

	if (typeof entry === "string" && logSocket?.connected) {
		logSocket.emit("logEvent", message);
		return;
	}

	const li = document.createElement("li");
	const timestamp = getTimestamp(entry).toLocaleTimeString();

	li.textContent = `[${timestamp}] ${message}`;

	logList.prepend(li);

	while (logList.children.length > MAX_LOGS) {
		logList.removeChild(logList.lastChild);
	}
}

export async function bindLogEvents(socket) {
	const logList = document.getElementById("logList");

	if (!logList) {
		return;
	}

	logSocket = socket;

	try {
		const res = await fetch("/api/logs");
		if (res.ok) {
			const entries = await res.json();
			entries.slice().reverse().forEach(logEvent);
		}
	} catch {
		// Log history is nice to have; realtime events still work if it fails.
	}

	socket?.off?.("logEvent", logEvent);
	socket?.on?.("logEvent", logEvent);
}
