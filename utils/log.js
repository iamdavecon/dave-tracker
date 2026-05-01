
export function logEvent(message) {
	const logList = document.getElementById("logList");

	const li = document.createElement("li");

	const timestamp = new Date().toLocaleTimeString();

	li.textContent = `[${timestamp}] ${message}`;

	logList.prepend(li);

	const maxLogs = 10;
	while (logList.children.length > maxLogs) {
		logList.removeChild(logList.lastChild);
	}
}

