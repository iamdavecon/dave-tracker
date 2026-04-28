
export function notifyUser(target, event, payload) {
    if (!target.sockets || target.sockets.size === 0) return;

    for (const socket of target.sockets) {
        socket.emit(event, payload);
    }
}
