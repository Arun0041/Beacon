CREATE TABLE IF NOT EXISTS sos_reports (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL DEFAULT 'emergency'
                CHECK (kind IN ('emergency','help')),
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  severity      TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  tags          TEXT[] NOT NULL DEFAULT '{}',
  note          TEXT NOT NULL DEFAULT '',
  origin_device TEXT NOT NULL DEFAULT 'unknown',
  ice           TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','acknowledged','dispatched','rescued')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- idempotent upgrades for databases created before these columns existed
ALTER TABLE sos_reports ADD COLUMN IF NOT EXISTS ice TEXT;
ALTER TABLE sos_reports ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'emergency';

CREATE INDEX IF NOT EXISTS idx_sos_status   ON sos_reports (status);
CREATE INDEX IF NOT EXISTS idx_sos_created  ON sos_reports (created_at);

CREATE TABLE IF NOT EXISTS hazard_reports (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('flood','fire','rubble','other')),
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  origin_device TEXT NOT NULL DEFAULT 'unknown',
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_log (
  id          BIGSERIAL PRIMARY KEY,
  device_id   TEXT NOT NULL,
  pushed      INTEGER NOT NULL DEFAULT 0,
  removed     INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkins (
  device_id  TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT 'anonymous',
  lat        DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng        DOUBLE PRECISION NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shelters (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  capacity   INTEGER NOT NULL DEFAULT 0,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  contact    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
