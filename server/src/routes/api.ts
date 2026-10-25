import { Router } from "express";
import { pool } from "../db.js";
import { bus } from "../events.js";
import { dbscan, type Pt } from "../dbscan.js";

export const api = Router();

const SEVERITIES = ["critical", "high", "medium", "low"];
const STATUSES = ["open", "acknowledged", "dispatched", "rescued"];

type SosRow = {
  id: string;
  kind: string;
  lat: number;
  lng: number;
  severity: string;
  tags: string[];
  note: string;
  origin_device: string;
  ice: string | null;
  status: string;
  created_at: Date;
};

function rowToSos(r: SosRow) {
  let ice: unknown = null;
  if (r.ice) {
    try {
      ice = JSON.parse(r.ice);
    } catch {
      ice = null;
    }
  }
  return {
    id: r.id,
    kind: r.kind === "help" ? "help" : "emergency",
    lat: Number(r.lat),
    lng: Number(r.lng),
    severity: r.severity,
    tags: r.tags ?? [],
    note: r.note,
    origin: r.origin_device,
    status: r.status,
    ts: new Date(r.created_at).getTime(),
    ice,
  };
}

api.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), uptime: process.uptime() });
});

/* ---------------- Data mule ingest ----------------
 * A phone (or any mesh node) that reaches connectivity pushes its full
 * local CRDT state here. All writes are idempotent (client UUIDs are PKs).
 */
api.post("/sync", async (req, res) => {
  const { deviceId, sos = [], hazards = [], checkins = [], removed = [] } = req.body ?? {};
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });

  try {
    let pushed = 0;

    for (const s of sos) {
      if (!s?.id || !isFinite(s.lat) || !isFinite(s.lng)) continue;
      if (!SEVERITIES.includes(s.severity)) continue;
      const r = await pool.query(
        `INSERT INTO sos_reports (id, kind, lat, lng, severity, tags, note, origin_device, ice, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, to_timestamp($11/1000.0))
         ON CONFLICT (id) DO UPDATE SET
           kind = EXCLUDED.kind,
           lat = EXCLUDED.lat, lng = EXCLUDED.lng,
           severity = EXCLUDED.severity, tags = EXCLUDED.tags, note = EXCLUDED.note,
           origin_device = EXCLUDED.origin_device, ice = EXCLUDED.ice
         RETURNING id, (xmax = 0) AS inserted`,
        // status deliberately not updated: the command centre owns triage state
        [
          String(s.id),
          s.kind === "help" ? "help" : "emergency",
          s.lat,
          s.lng,
          s.severity,
          Array.isArray(s.tags) ? s.tags.map(String) : [],
          String(s.note ?? ""),
          String(s.origin ?? deviceId),
          s.ice ? JSON.stringify(s.ice) : null,
          STATUSES.includes(s.status) ? s.status : "open",
          Number(s.ts) || Date.now(),
        ],
      );
      if (r.rows[0]?.inserted) {
        pushed++;
        bus.emit("event", {
          type: "sos.new",
          id: s.id,
          severity: s.severity,
          lat: s.lat,
          lng: s.lng,
          origin: s.origin ?? deviceId,
        });
      }
    }

    for (const h of hazards) {
      if (!h?.id || !isFinite(h.lat) || !isFinite(h.lng)) continue;
      if (!["flood", "fire", "rubble", "other"].includes(h.kind)) continue;
      const r = await pool.query(
        `INSERT INTO hazard_reports (id, kind, lat, lng, note, origin_device, reported_at)
         VALUES ($1,$2,$3,$4,$5,$6, to_timestamp($7/1000.0))
         ON CONFLICT (id) DO UPDATE SET
           kind = EXCLUDED.kind, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
           note = EXCLUDED.note, origin_device = EXCLUDED.origin_device
         RETURNING id, (xmax = 0) AS inserted`,
        [
          String(h.id),
          h.kind,
          h.lat,
          h.lng,
          String(h.note ?? ""),
          String(h.origin ?? deviceId),
          Number(h.ts) || Date.now(),
        ],
      );
      if (r.rows[0]?.inserted) {
        pushed++;
        bus.emit("event", {
          type: "hazard.new",
          id: h.id,
          kind: h.kind,
          lat: h.lat,
          lng: h.lng,
          origin: h.origin ?? deviceId,
        });
      }
    }

    let removedCount = 0;
    if (Array.isArray(removed) && removed.length > 0) {
      const r = await pool.query(
        `DELETE FROM sos_reports WHERE id = ANY($1::text[])`,
        [removed.map(String)],
      );
      removedCount = r.rowCount ?? 0;
      if (removedCount > 0) bus.emit("event", { type: "sos.removed" });
    }

    for (const c of checkins) {
      if (!c?.deviceId) continue;
      await pool.query(
        `INSERT INTO checkins (device_id, name, lat, lng, checked_at)
         VALUES ($1,$2,$3,$4, to_timestamp($5/1000.0))
         ON CONFLICT (device_id) DO UPDATE SET
           name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng, checked_at = EXCLUDED.checked_at`,
        [
          String(c.deviceId),
          String(c.name ?? "anonymous"),
          isFinite(c.lat) ? c.lat : 0,
          isFinite(c.lng) ? c.lng : 0,
          Number(c.ts) || Date.now(),
        ],
      );
      bus.emit("event", { type: "checkin", name: c.name ?? "anonymous" });
    }

    await pool.query(`INSERT INTO sync_log (device_id, pushed, removed) VALUES ($1,$2,$3)`, [
      String(deviceId),
      pushed,
      removedCount,
    ]);
    bus.emit("event", { type: "sync", deviceId, pushed, removed: removedCount });

    res.json({ ok: true, pushed, removed: removedCount });
  } catch (err: any) {
    console.error("[sync]", err.message);
    res.status(500).json({ error: "sync failed" });
  }
});

/* ---------------- Reads ---------------- */

api.get("/sos", async (req, res) => {
  const { status, since, kind } = req.query;
  const params: unknown[] = [];
  const where: string[] = [];
  if (status && STATUSES.includes(String(status))) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (kind === "emergency" || kind === "help") {
    params.push(kind);
    where.push(`kind = $${params.length}`);
  }
  if (since) {
    params.push(new Date(Number(since)));
    where.push(`created_at >= $${params.length}`);
  }
  const sql = `SELECT * FROM sos_reports ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 500`;
  const r = await pool.query(sql, params);
  res.json(r.rows.map(rowToSos));
});

api.patch("/sos/:id/status", async (req, res) => {
  const { status } = req.body ?? {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "bad status" });
  const r = await pool.query(
    `UPDATE sos_reports SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`,
    [status, req.params.id],
  );
  if (!r.rowCount) return res.status(404).json({ error: "not found" });
  bus.emit("event", { type: "sos.status", id: req.params.id, status });
  res.json(rowToSos(r.rows[0]));
});

api.get("/hazards", async (_req, res) => {
  const r = await pool.query(`SELECT * FROM hazard_reports ORDER BY reported_at DESC LIMIT 500`);
  res.json(
    r.rows.map((h: any) => ({
      id: h.id,
      kind: h.kind,
      lat: Number(h.lat),
      lng: Number(h.lng),
      note: h.note,
      origin: h.origin_device,
      ts: new Date(h.reported_at).getTime(),
    })),
  );
});

/* Shelter registry — responder-managed, propagated to every phone via sync. */
api.get("/shelters", async (_req, res) => {
  const r = await pool.query(`SELECT * FROM shelters ORDER BY created_at ASC LIMIT 200`);
  res.json(
    r.rows.map((s: any) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      lat: Number(s.lat),
      lng: Number(s.lng),
      contact: s.contact,
    })),
  );
});

api.post("/shelters", async (req, res) => {
  const { id, name, capacity, lat, lng, contact } = req.body ?? {};
  if (!name || !isFinite(lat) || !isFinite(lng)) {
    return res.status(400).json({ error: "name, lat and lng are required" });
  }
  const shelterId = id ? String(id) : `shelter-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  await pool.query(
    `INSERT INTO shelters (id, name, capacity, lat, lng, contact)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, capacity = EXCLUDED.capacity,
       lat = EXCLUDED.lat, lng = EXCLUDED.lng, contact = EXCLUDED.contact`,
    [shelterId, String(name), Math.max(0, Math.floor(Number(capacity) || 0)), lat, lng, String(contact ?? "")],
  );
  bus.emit("event", { type: "shelter.new", name });
  res.json({ ok: true, id: shelterId });
});

/* DBSCAN clustering of open SOS reports — the heat-map primitive. */
api.get("/cluster", async (req, res) => {
  const eps = Math.min(Math.max(Number(req.query.eps) || 150, 30), 2000);
  const minPts = Math.min(Math.max(Number(req.query.minPts) || 3, 1), 20);
  const r = await pool.query(`SELECT id, lat, lng, severity FROM sos_reports WHERE status IN ('open','acknowledged','dispatched')`);
  const points: Pt[] = r.rows.map((p: any) => ({
    id: p.id,
    lat: Number(p.lat),
    lng: Number(p.lng),
    severity: p.severity,
  }));
  res.json({ eps, minPts, total: points.length, clusters: dbscan(points, eps, minPts) });
});

api.get("/stats", async (_req, res) => {
  const [sos, hazards, devices, lastSync, safe, shelterCount] = await Promise.all([
    pool.query(`SELECT status, severity, kind, count(*)::int AS n FROM sos_reports GROUP BY status, severity, kind`),
    pool.query(`SELECT count(*)::int AS n FROM hazard_reports`),
    pool.query(`SELECT count(DISTINCT origin_device)::int AS n FROM sos_reports`),
    pool.query(`SELECT max(received_at) AS t FROM sync_log`),
    pool.query(`SELECT count(*)::int AS n FROM checkins`),
    pool.query(`SELECT count(*)::int AS n FROM shelters`),
  ]);

  const byStatus: Record<string, number> = {};
  let open = 0;
  let critical = 0;
  let emergencies = 0;
  let helpRequests = 0;
  for (const row of sos.rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + row.n;
    if (["open", "acknowledged", "dispatched"].includes(row.status)) {
      open += row.n;
      if (row.kind === "help") helpRequests += row.n;
      else emergencies += row.n;
    }
    if (row.status === "open" && row.severity === "critical") critical += row.n;
  }

  res.json({
    open,
    critical,
    emergencies,
    helpRequests,
    byStatus,
    hazards: hazards.rows[0].n,
    devices: devices.rows[0].n,
    safe: safe.rows[0].n,
    shelters: shelterCount.rows[0].n,
    lastSync: lastSync.rows[0].t,
  });
});
