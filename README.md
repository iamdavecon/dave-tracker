## Prereqs
- Node.js 18+

## Install
```bash
npm install
```

## Run
```bash
npm start
# then visit
http://localhost:3000
```

## How it works
- Server: Node + Express over HTTPS and Socket.io for real-time messaging.
- Client: `navigator.geolocation.watchPosition` sends your position; `deviceorientation` events compute device **heading**.
- Arrow rotation = **bearing to nearest user – your heading** (normalized to 0–360°).

