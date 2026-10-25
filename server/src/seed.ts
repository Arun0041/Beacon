import { pool } from "./db.js";

/** Seeded RNG so demo data is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261011);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const jitter = (base: number, spread: number) => base + (rand() - 0.5) * spread;

/** Demo centre: LPU campus area, Phagwara, Punjab. */
const CENTRE = { lat: 31.2537, lng: 75.7033 };

const HOTSPOTS = [
  { lat: 31.2555, lng: 75.7040, count: 9 },
  { lat: 31.2490, lng: 75.7100, count: 7 },
  { lat: 31.2600, lng: 75.6990, count: 6 },
];

const TAG_POOL = ["trapped", "injured", "medical", "water", "shelter", "fire", "elderly", "child"];
const NOTE_POOL = [
  "Stairwell collapsed, two people inside",
  "Water rising fast, need boat",
  "Elderly woman, no medication access",
  "Roof partially gone, family sheltering",
  "Child separated from parents",
  "Need first aid supplies",
  "Trapped under debris, can hear tapping",
  "Diabetic, insulin needed",
  "Pregnant, contractions started",
  "Structural crack, building unsafe",
];
const DEVICES = ["amar-7f3a", "priya-2c81", "roshan-91de", "fatima-44a2", "gurpreet-6b19", "meera-e057"];

function mkSos(lat: number, lng: number, i: number) {
  const sevRoll = rand();
  const severity = sevRoll < 0.3 ? "critical" : sevRoll < 0.6 ? "high" : sevRoll < 0.85 ? "medium" : "low";
  const tags = [...new Set([pick(TAG_POOL), pick(TAG_POOL)])];
  const statusRoll = rand();
  const status = statusRoll < 0.55 ? "open" : statusRoll < 0.75 ? "acknowledged" : statusRoll < 0.9 ? "dispatched" : "rescued";
  return {
    id: `seed-sos-${i}`,
    kind: "emergency" as const,
    lat: jitter(lat, 0.0022),
    lng: jitter(lng, 0.0026),
    severity,
    tags,
    note: pick(NOTE_POOL),
    origin_device: pick(DEVICES),
    status,
    minutesAgo: Math.floor(rand() * 180),
  };
}

const HELP_NOTES = [
  "Out of drinking water, two families",
  "Need food for 5 people, children included",
  "Roof leaking, need tarpaulin",
  "Insulin finished, pharmacy unreachable",
  "Need transport to relief camp",
  "Baby formula needed urgently",
  "Cannot walk far, need supplies delivered",
  "Phone battery dying, need power bank",
  "Stray cattle in yard, need help",
  "Need blankets, night is cold",
];
const HELP_TAGS = ["water", "food", "shelter", "medical", "transport", "other"];

function mkHelp(i: number) {
  return {
    id: `seed-help-${i}`,
    kind: "help" as const,
    lat: jitter(CENTRE.lat, 0.028),
    lng: jitter(CENTRE.lng, 0.03),
    severity: rand() < 0.3 ? "high" : rand() < 0.7 ? "medium" : "low",
    tags: [pick(HELP_TAGS)],
    note: pick(HELP_NOTES),
    origin_device: pick(DEVICES),
    status: rand() < 0.75 ? "open" : "acknowledged",
    minutesAgo: Math.floor(rand() * 240),
  };
}

const sosList: Array<ReturnType<typeof mkSos> | ReturnType<typeof mkHelp>> = [];
let i = 0;
for (const h of HOTSPOTS) for (let k = 0; k < h.count; k++) sosList.push(mkSos(h.lat, h.lng, i++));
for (let k = 0; k < 14; k++) sosList.push(mkSos(jitter(CENTRE.lat, 0.03), jitter(CENTRE.lng, 0.03), i++));
for (let k = 0; k < 12; k++) sosList.push(mkHelp(i++));

const hazardList = [
  { kind: "flood", lat: 31.2520, lng: 75.7065, note: "Drain overflow, street waist-deep" },
  { kind: "flood", lat: 31.2505, lng: 75.7090, note: "Underpass fully submerged" },
  { kind: "flood", lat: 31.2570, lng: 75.7010, note: "River bank seeping onto road" },
  { kind: "fire", lat: 31.2540, lng: 75.7025, note: "LPG cylinder leak, smoke visible" },
  { kind: "fire", lat: 31.2610, lng: 75.7005, note: "Transformer fire, live wires down" },
  { kind: "rubble", lat: 31.2558, lng: 75.7045, note: "Building facade collapsed on road" },
  { kind: "rubble", lat: 31.2495, lng: 75.7095, note: "Debris blocking main exit" },
  { kind: "rubble", lat: 31.2598, lng: 75.6998, note: "Fallen tree + power pole" },
  { kind: "other", lat: 31.2510, lng: 75.7000, note: "Bridge closed, cracks visible" },
  { kind: "other", lat: 31.2620, lng: 75.7040, note: "Gas smell in alley" },
].map((h, j) => ({
  id: `seed-hz-${j}`,
  ...h,
  lat: jitter(h.lat, 0.0004),
  lng: jitter(h.lng, 0.0004),
  origin_device: pick(DEVICES),
  minutesAgo: Math.floor(rand() * 240),
}));

await pool.query("TRUNCATE sos_reports, hazard_reports, sync_log, checkins, shelters");

for (const s of sosList) {
  await pool.query(
    `INSERT INTO sos_reports (id, kind, lat, lng, severity, tags, note, origin_device, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() - ($10 || ' minutes')::interval, now() - ($10 || ' minutes')::interval)`,
    [s.id, s.kind, s.lat, s.lng, s.severity, s.tags, s.note, s.origin_device, s.status, s.minutesAgo],
  );
}

for (const h of hazardList) {
  await pool.query(
    `INSERT INTO hazard_reports (id, kind, lat, lng, note, origin_device, reported_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() - ($7 || ' minutes')::interval)`,
    [h.id, h.kind, h.lat, h.lng, h.note, h.origin_device, h.minutesAgo],
  );
}

await pool.query(
  `INSERT INTO sync_log (device_id, pushed, removed, received_at) VALUES
   ('amar-7f3a', 12, 0, now() - interval '18 minutes'),
   ('priya-2c81', 9, 1, now() - interval '6 minutes')`,
);

const shelters = [
  { name: "Government Senior Sec. School, Phagwara", capacity: 320, lat: 31.2562, lng: 75.7008, contact: "Block officer · 98765 00001" },
  { name: "Community Centre — Model Town", capacity: 150, lat: 31.2501, lng: 75.7062, contact: "Ward office · 98765 00002" },
  { name: "Gurudwara Langar Hall", capacity: 500, lat: 31.2596, lng: 75.7041, contact: "Volunteer desk · 98765 00003" },
  { name: "LPU Campus Relief Point (Gate 2)", capacity: 800, lat: 31.2532, lng: 75.7022, contact: "Campus control · 98765 00004" },
];
for (const s of shelters) {
  await pool.query(
    `INSERT INTO shelters (id, name, capacity, lat, lng, contact) VALUES ($1,$2,$3,$4,$5,$6)`,
    [`seed-shelter-${s.name.slice(0, 12).replace(/\W/g, "")}`, s.name, s.capacity, s.lat, s.lng, s.contact],
  );
}

await pool.query(
  `INSERT INTO checkins (device_id, name, lat, lng, checked_at) VALUES
   ('priya-2c81', 'priya', 31.2505, 75.7092, now() - interval '22 minutes'),
   ('gurpreet-6b19', 'gurpreet', 31.2588, 75.7019, now() - interval '40 minutes')`,
);

console.log(
  `[seed] ${sosList.length} SOS, ${hazardList.length} hazards, ${shelters.length} shelters, 2 check-ins inserted`,
);
await pool.end();
