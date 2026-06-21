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

## Local source archive

Travelogue and hacker-con source material is cached under [`local-archive/drive`](local-archive/drive/README.md). Search that local text first for future clue-writing or context questions (for example, `rg -i "badge|linecon" local-archive/drive/text`) instead of making new Google Drive calls. The manifest maps stable Drive IDs to human-readable titles and records extraction coverage.
