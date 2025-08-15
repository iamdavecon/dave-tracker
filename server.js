const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Nearby Viewers Game WS server\n');
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();

function keyFor({ siteId, gridMeters, cellId }) {
  return `${siteId}::${gridMeters}::${cellId}`;
}

function joinRoom(ws, roomKey) {
  if (!rooms.has(roomKey)) rooms.set(roomKey, new Set());
  rooms.get(roomKey).add(ws);
  ws._roomKey = roomKey;
  broadcastCount(roomKey);
}

function leaveRoom(ws) {
  const roomKey = ws._roomKey;
  if (!roomKey) return;
  const set = rooms.get(roomKey);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(roomKey);
    else broadcastCount(roomKey);
  }
  ws._roomKey = null;
}

function broadcast(roomKey, payload) {
  const set = rooms.get(roomKey);
  if (!set) return;
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }
}

function broadcastCount(roomKey) {
  const set = rooms.get(roomKey);
  const count = set ? set.size : 0;
  broadcast(roomKey, { type: 'count', count });
}

function heartbeat() { this.isAlive = true; }

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'join') {
        const { siteId, gridMeters, cellId } = msg;
        if (!siteId || !gridMeters || !cellId) return;
        if (ws._roomKey) leaveRoom(ws);
        joinRoom(ws, keyFor({ siteId, gridMeters, cellId }));
        ws.send(JSON.stringify({ type: 'joined', siteId, gridMeters, cellId }));
      } else if (msg.type === 'switch') {
        const { siteId, gridMeters, cellId } = msg;
        if (!siteId || !gridMeters || !cellId) return;
        if (ws._roomKey === keyFor({ siteId, gridMeters, cellId })) return;
        leaveRoom(ws);
        joinRoom(ws, keyFor({ siteId, gridMeters, cellId }));
        ws.send(JSON.stringify({ type: 'joined', siteId, gridMeters, cellId }));
      }
    } catch {}
  });

  ws.on('close', () => leaveRoom(ws));
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(interval));

server.listen(PORT, () => {
  console.log('WS server listening on :' + PORT);
});
