-- P1 schema v1: the six models the vertical slice needs.
-- Portable SQL (no dialect-specific types) so the same file runs on SQLite (dev)
-- and Postgres (prod) with only the placeholder style changed by sqlx.

CREATE TABLE IF NOT EXISTS workspaces (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id            INTEGER PRIMARY KEY,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id),
  domain        TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sites_workspace ON sites(workspace_id);

CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id),
  site_id       INTEGER NOT NULL REFERENCES sites(id),
  keyword       TEXT    NOT NULL,
  stage         TEXT    NOT NULL DEFAULT 'intent',
  status        TEXT    NOT NULL DEFAULT 'pending',
  created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_workspace ON jobs(workspace_id, id);

CREATE TABLE IF NOT EXISTS articles (
  id          INTEGER PRIMARY KEY,
  job_id      INTEGER NOT NULL REFERENCES jobs(id),
  site_id     INTEGER NOT NULL REFERENCES sites(id),
  title       TEXT    NOT NULL,
  slug        TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'draft',
  created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_site ON articles(site_id, id);

CREATE TABLE IF NOT EXISTS api_keys (
  id               INTEGER PRIMARY KEY,
  workspace_id     INTEGER NOT NULL REFERENCES workspaces(id),
  provider         TEXT    NOT NULL,
  label            TEXT    NOT NULL,
  allowance_daily  INTEGER,
  created_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_entries (
  id          INTEGER PRIMARY KEY,
  site_id     INTEGER NOT NULL REFERENCES sites(id),
  status      TEXT    NOT NULL DEFAULT 'SCHEDULED',
  publish_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calendar_site ON calendar_entries(site_id, publish_at);
