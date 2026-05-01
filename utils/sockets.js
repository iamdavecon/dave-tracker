
export function notifyUser(target, event, payload) {
    if (!target.sockets || target.sockets.size === 0) return;

    for (const socket of target.sockets) {
	console.log("notify : " + socket + " event: " + event + " payload: " + payload);
        socket.emit(event, payload);
    }
}
