-- Per-site single-dispatch lease, mirroring the TS worker registry.
--
-- The browser tick model differs from the job-level worker model above:
-- many tabs of one studio all try to drive the same site, and exactly one
-- must win per tick. The lease is keyed by site, held by a tickId, and
-- expires so a closed tab cannot wedge the site forever.
CREATE TABLE IF NOT EXISTS worker_leases (
  id                    INTEGER PRIMARY KEY,
  site_id               TEXT    NOT NULL,
  lease_id              TEXT    NOT NULL,           -- the holder's tickId
  lease_ticks           INTEGER NOT NULL DEFAULT 0,
  expires_at            INTEGER NOT NULL DEFAULT 0, -- epoch millis, 0 = released
  last_beat_at          INTEGER NOT NULL DEFAULT 0,
  active_jobs           INTEGER NOT NULL DEFAULT 0,
  next_calendar_pulse_at INTEGER,
  source                TEXT    NOT NULL DEFAULT 'browser',
  UNIQUE (site_id)
);
