# Beacon — Offline-First P2P Mesh for Disaster Response

Beacon (formerly LifeLine) is a zero-install-capable emergency platform that keeps
working when cellular and internet infrastructure fail. Phones on the same local
network form a peer-to-peer WebRTC mesh; any device that regains connectivity acts
as a **data mule**, pushing the neighbourhood's data to a responder command centre.

The citizen app separates two kinds of distress, following the "I'm safe / I need
help" convention used by Red Cross, AlertTraveler and QuakeReady:

- **Emergency** — life-threatening SOS. Hold-to-confirm button, shares location and
  the victim's Medical ID (ICE). Red, always the hero of the home screen.
- **Help** — non-urgent assistance (drinking water, food, shelter, medical supplies,
  transport, other). Amber, one tap + optional note. Queued separately for responders.

One Node process plays every infrastructure role: REST API, Postgres persistence,
WebRTC signalling/presence, live dashboard push, and static hosting of the app
(the "captive portal" role — point any phone on the LAN at `http://<host>:8787`).

## Feature map

**Beacon (citizen app, light & calm)**

- Two distinct flows: **Emergency SOS** (hold, red) and **Help request** (categories, amber)
- **Medical ID (ICE)** — blood type, allergies, conditions, next of kin; attached to
  every emergency SOS automatically
- **Shake-to-SOS**, **"I'm safe" check-ins**, **SOS strobe** (Morse flasher + wake-lock)
- Offline map with SOS / help / hazard / shelter markers; tap-to-report hazards
- Mesh chat (neighbourhood + rescue channels), cached survival guides with CPR metronome
- Device status (mesh, sync, battery) lives on the Profile page — the SOS page stays clean

**Beacon Command (responder console, dark & restrained)**

- Operations board: bare-number KPI strip (emergencies / critical / help / safe /
  hazards / shelters / devices), incident map with DBSCAN clusters, dispatch queue
  for critical emergencies, sector-density ranking, live dispatch ticker
- Requests table with **All / Emergencies / Help** tabs, triage status machine, ICE chips
- **Shelter registry** — responder-created shelters propagate to every phone
- Hazard board

## Stack (PERN)

| Layer     | Technology                                             |
| --------- | ------------------------------------------------------ |
| Postgres  | PostgreSQL 16 (Docker), plain SQL schema + seeds       |
| Express   | REST API, static hosting, WS upgrade routing           |
| React     | Vite + TypeScript PWA, Tailwind v4, Inter, Motion, Leaflet |
| Node      | Express 4, `ws` signalling, `pg`                       |
| Mesh      | Yjs CRDT over WebRTC DataChannels, IndexedDB storage   |

## Quick start

Requires Node 20+ and Docker (or any local Postgres). The compose file maps
Postgres to **host port 5433** to avoid clashing with a locally installed Postgres;
`server/.env` (copy from `server/.env.example`) points the server at it.

```bash
# 1. install everything (workspaces)
npm install

# 2. start Postgres
docker compose up -d db

# 3. create schema + demo data
npm run db:init
npm run db:seed

# 4. configure the connection (defaults to localhost:5433)
cp server/.env.example server/.env

# 5a. development (API on :8787, Vite on :5173 with proxy)
npm run dev

# 5b. production (single origin — the "portal" role)
npm run build
npm run start        # serves app + API at http://localhost:8787
```

Open `http://localhost:8787` (or `:5173` in dev). First run asks for a callsign.

**Mesh demo (no internet needed):** build the client, run `npm run start`, then open
the URL from two devices on the same Wi-Fi. The top bar shows linked peers; SOS, chat
and hazards sync directly between them. Toggle airplane mode with Wi-Fi kept on to
prove the P2P path — the `SERVER` chip flips to `OFFLINE` while mesh keeps working.

**Endpoints:** `GET /api/stats`, `GET /api/sos[?status=]`, `PATCH /api/sos/:id/status`,
`GET /api/hazards`, `GET/POST /api/shelters`, `GET /api/cluster?eps=150&minPts=3`,
`POST /api/sync` (mule ingest: SOS + hazards + check-ins), `GET /api/health`.
WebSockets: `/ws/mesh` (signalling), `/ws/live` (dashboard push).

## How the mesh works

```
phone A ←→ phone B ←→ phone C        Yjs updates over WebRTC DataChannels
   ↓         ↓         ↓             (server never sees mesh payloads)
        portal server                 REST POST /api/sync when reachable
             ↓                        (any device can be the mule)
        Postgres → dashboard          DBSCAN clustering, triage queue
```

- **Discovery & signalling** — `/ws/mesh` tracks presence and relays SDP/ICE. Peers use
  empty `iceServers` (host candidates only): the connection is genuinely LAN-local.
- **Replication** — one `Y.Doc` holds SOS, hazards and chat. Full state is exchanged when
  a DataChannel opens; incremental updates are gossiped to every other peer. Received
  updates are rebroadcast (epidemic protocol) and Yjs state vectors make re-delivery
  idempotent — no manual dedup.
- **Persistence** — `y-indexeddb` survives reloads/crashes; storage is marked persistent.
- **Mule sync** — every device polls `/api/health`; on reachability it pushes local state
  (idempotent upserts keyed by client UUID) and pulls server-side triage status changes
  back into the CRDT.
- **Routing constraint (known, by design):** browsers cannot create Wi-Fi links themselves,
  so peers must share a network first. The portal server on a battery-powered router is the
  software stand-in for the planned portable "RescuePod" hardware.

## Repository layout

```
server/                 Express + Postgres + signalling
  src/index.ts          HTTP server, static hosting, WS upgrade
  src/routes/api.ts     REST: sync ingest, queries, cluster, stats
  src/dbscan.ts         geographic DBSCAN (haversine, metres)
  src/ws.ts             /ws/mesh signalling + /ws/live dashboard push
  src/schema.sql        DDL (sos_reports, hazard_reports, sync_log)
  src/seed.ts           reproducible demo dataset (Phagwara/LPU area)
client/
  src/lib/net.ts        mesh engine: Y.Doc, WebRTC peers, gossip, mule merge
  src/lib/sync.ts       data-mule sync agent (push + pull reconciliation)
  src/pages/field/      SOS hold-button, map, chat, survival wiki
  src/pages/dash/       command centre: overview, SOS queue, hazards
  public/sw.js          app-shell service worker (HTTPS/localhost only)
```

## Field-app vs. dashboard

- `/` — field mode: hold-to-broadcast SOS (GPS with manual pin fallback), offline map with
  hazard reporting, broadcast channels, cached first-aid wiki with a 110 BPM CPR metronome.
- `/dashboard` — command mode: KPI row, live incident map with DBSCAN cluster circles,
  priority queue, full SOS table with triage status transitions, hazard board.

## Known constraints (deliberate, documented)

- **Secure contexts:** service workers and browser geolocation require HTTPS or localhost.
  On plain-HTTP LAN deployments the app runs per-session from the portal; SOS falls back
  to manual pin placement. The hardened field build wraps the same UI as an Android APK
  (Capacitor) — next milestone.
- **Identity** is a device-local callsign, not authenticated accounts. v2 adds mesh-native
  key pairs and report-signing.
- **Chat identity** is callsign-based; duplicates possible. v2 adds per-device suffixes.
- **PostGIS** not required yet — DBSCAN runs in-process. Swap when datasets outgrow it.

## Next milestones

1. Contraction of hazard-weighted offline routing (A* in WASM over OSM graph extracts).
2. Capacitor APK field build + distribution page on the portal.
3. Mesh simulator (500 virtual nodes) for delivery-ratio/latency evaluation.
4. Signed reports + N-of-M hazard consensus to defend against spoofing.
5. Battery-aware relay election and gateway election for shared uplinks.
