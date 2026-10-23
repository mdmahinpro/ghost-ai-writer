-- 0003_worker.sql — queue leases and resumable stage progress (S2).
-- A job is claimed with a time-boxed lease. If the worker dies, the lease
-- expires and another worker re-claims the same job, continuing from
-- stage_index instead of re-running finished stages.

ALTER TABLE jobs ADD COLUMN stage_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN claimed_at TEXT;

-- Claim scan: status + not_before + id. Lease expiry is filtered in the query
-- because it compares against the current time, not a stored constant.
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs(status, not_before, id);

-- Audit of every stage advance, so "resumed from stage 4" is provable, not claimed.
CREATE TABLE IF NOT EXISTS job_events (
  id         INTEGER PRIMARY KEY,
  job_id     INTEGER NOT NULL REFERENCES jobs(id),
  worker_id  TEXT,
  kind       TEXT NOT NULL,          -- CLAIMED | LEASE_RENEWED | STAGE_DONE | COMPLETED | RETRY | FAILED | LEASE_EXPIRED
  stage_index INTEGER,
  detail     TEXT,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_job_events ON job_events(job_id, id);
