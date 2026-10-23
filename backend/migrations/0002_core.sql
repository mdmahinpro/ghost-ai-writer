-- 0002_core.sql — full product schema (S1).
-- Portable SQL: SQLite (dev, bundled) and Postgres (prod) both accept it;
-- sqlx rewrites the ? placeholders. No dialect-specific types, no enums
-- (status strings are validated in Rust), no triggers.
--
-- Tenant model: workspace -> website -> (content, integrations, calendars).
-- Accounting model: usage_ledger rows; run/article spend is always DERIVED,
-- never a counter that can drift.

-- ---------------------------------------------------------------- tenancy

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY,
  email        TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  role         TEXT    NOT NULL DEFAULT 'USER',
  status       TEXT    NOT NULL DEFAULT 'ACTIVE',
  password_enc TEXT,
  created_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  role         TEXT    NOT NULL DEFAULT 'OWNER',
  created_at   TEXT    NOT NULL,
  UNIQUE (user_id, workspace_id)
);

-- 0001 shipped a thin `sites` table; this is the website workspace itself.
CREATE TABLE IF NOT EXISTS websites (
  id               INTEGER PRIMARY KEY,
  workspace_id     INTEGER NOT NULL REFERENCES workspaces(id),
  name             TEXT    NOT NULL,
  ghost_mode       TEXT    NOT NULL DEFAULT 'SANDBOX',   -- LIVE | SANDBOX
  ghost_url        TEXT,
  ghost_admin_key_enc TEXT,
  static_site_name TEXT,
  created_at       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_websites_workspace ON websites(workspace_id, id);

CREATE TABLE IF NOT EXISTS integrations (
  id          INTEGER PRIMARY KEY,
  website_id  INTEGER NOT NULL REFERENCES websites(id),
  mode        TEXT    NOT NULL,                          -- GHOST_LIVE | GHOST_SANDBOX | STATIC
  ghost_url   TEXT,
  status      TEXT    NOT NULL DEFAULT 'PENDING',        -- PENDING | CONNECTED | DEGRADED | BROKEN
  verified_at TEXT,
  created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_integrations_website ON integrations(website_id);

-- Ghost post inventory: the ONLY source internal links may point at.
CREATE TABLE IF NOT EXISTS inventory_posts (
  id            INTEGER PRIMARY KEY,
  website_id    INTEGER NOT NULL REFERENCES websites(id),
  ghost_post_id TEXT    NOT NULL,
  slug          TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  url           TEXT    NOT NULL,
  html          TEXT,
  tags          TEXT,
  synced_at     TEXT    NOT NULL,
  UNIQUE (website_id, ghost_post_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_slug ON inventory_posts(website_id, slug);

-- ---------------------------------------------------------------- keys

CREATE TABLE IF NOT EXISTS ai_keys (
  id               INTEGER PRIMARY KEY,
  workspace_id     INTEGER NOT NULL REFERENCES workspaces(id),
  provider         TEXT    NOT NULL,                     -- openai | openrouter
  label            TEXT    NOT NULL,
  key_enc          TEXT    NOT NULL,
  key_hint         TEXT,                                 -- e.g. "••••1icA"
  priority         INTEGER NOT NULL DEFAULT 100,
  daily_allowance  INTEGER,                              -- NULL = unlimited (owner directive)
  allowance_set_at TEXT,
  last_tested_at   TEXT,
  status           TEXT    NOT NULL DEFAULT 'UNVERIFIED',
  created_at       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_keys_workspace ON ai_keys(workspace_id, priority);

-- ---------------------------------------------------------------- content pipeline

CREATE TABLE IF NOT EXISTS runs (
  id           INTEGER PRIMARY KEY,
  website_id   INTEGER NOT NULL REFERENCES websites(id),
  type         TEXT    NOT NULL,                         -- KEYWORDS | TOPIC_PLAN
  source_label TEXT,
  status       TEXT    NOT NULL DEFAULT 'QUEUED',
  publish_mode TEXT    NOT NULL DEFAULT 'published',     -- published | draft
  model_id     TEXT,
  created_at   TEXT    NOT NULL,
  started_at   TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_website ON runs(website_id, id);

CREATE TABLE IF NOT EXISTS plans (
  id             INTEGER PRIMARY KEY,
  website_id     INTEGER NOT NULL REFERENCES websites(id),
  topic          TEXT    NOT NULL,
  pillar_title   TEXT    NOT NULL,
  pillar_summary TEXT,
  pillar_is_item INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'QUEUED',
  engine         TEXT    NOT NULL DEFAULT 'research',
  run_id         INTEGER REFERENCES runs(id),
  error          TEXT,
  created_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plans_website ON plans(website_id, id);

CREATE TABLE IF NOT EXISTS plan_items (
  id         INTEGER PRIMARY KEY,
  plan_id    INTEGER NOT NULL REFERENCES plans(id),
  title      TEXT    NOT NULL,
  summary    TEXT,
  role       TEXT,                                       -- pillar | cluster
  status     TEXT    NOT NULL DEFAULT 'PENDING',
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id, id);

-- 0001 `jobs` was created for the slice; these columns make it a worker queue.
ALTER TABLE jobs ADD COLUMN run_id INTEGER;
ALTER TABLE jobs ADD COLUMN website_id INTEGER;
ALTER TABLE jobs ADD COLUMN plan_item_id INTEGER;
ALTER TABLE jobs ADD COLUMN article_type TEXT;
ALTER TABLE jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN locked_by TEXT;
ALTER TABLE jobs ADD COLUMN lease_until TEXT;
ALTER TABLE jobs ADD COLUMN not_before TEXT;
ALTER TABLE jobs ADD COLUMN last_error TEXT;
ALTER TABLE jobs ADD COLUMN spend_usd REAL NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(status, not_before, lease_until);

-- 0001 `articles` grew into the full record their UI renders.
ALTER TABLE articles ADD COLUMN website_id INTEGER;
ALTER TABLE articles ADD COLUMN keyword TEXT;
ALTER TABLE articles ADD COLUMN engine TEXT NOT NULL DEFAULT 'llm';
ALTER TABLE articles ADD COLUMN ghost_post_id TEXT;
ALTER TABLE articles ADD COLUMN published_at TEXT;
ALTER TABLE articles ADD COLUMN uniqueness_score REAL;
ALTER TABLE articles ADD COLUMN intent_match REAL;
ALTER TABLE articles ADD COLUMN coverage_score REAL;
ALTER TABLE articles ADD COLUMN featured_image_url TEXT;
ALTER TABLE articles ADD COLUMN featured_alt TEXT;
ALTER TABLE articles ADD COLUMN content_json TEXT;
ALTER TABLE articles ADD COLUMN meta_json TEXT;
ALTER TABLE articles ADD COLUMN content_format TEXT;
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(site_id, slug);

CREATE TABLE IF NOT EXISTS article_stages (
  id          INTEGER PRIMARY KEY,
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  idx         INTEGER NOT NULL,                          -- 1..6
  key         TEXT    NOT NULL,                          -- blueprint|draft|revision|metadata|enrichment|validation
  status      TEXT    NOT NULL DEFAULT 'PENDING',
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  cost_usd    REAL    NOT NULL DEFAULT 0,
  error       TEXT,
  payload_json TEXT,
  started_at  TEXT,
  finished_at TEXT,
  UNIQUE (article_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_stages_article ON article_stages(article_id, idx);

-- Image provenance, including the vision verdict and its reason code.
CREATE TABLE IF NOT EXISTS article_images (
  id           INTEGER PRIMARY KEY,
  article_id   INTEGER NOT NULL REFERENCES articles(id),
  role         TEXT    NOT NULL,                         -- FEATURED | CONTENT
  query        TEXT    NOT NULL,
  url          TEXT    NOT NULL,
  alt          TEXT    NOT NULL,
  width        INTEGER,
  height       INTEGER,
  bytes        INTEGER,
  local_path   TEXT,
  status       TEXT    NOT NULL DEFAULT 'PENDING',       -- SELECTED | REJECTED | ...
  reason_code  TEXT,                                     -- BING_PROXY_ERROR | INVALID_IMAGE | QUALITY_REJECTED | IRRELEVANT | UNCERTAIN | SKIPPED_VISION_UNAVAILABLE | SKIPPED_VISION_BUDGET | NO_RELEVANT_IMAGE
  reason       TEXT,
  vision_label TEXT,                                     -- RELEVANT | IRRELEVANT | UNCERTAIN
  vision_conf  REAL,
  created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_article ON article_images(article_id, role);

-- Internal links: inserted locally first, verified only after a read-back.
CREATE TABLE IF NOT EXISTS article_links (
  id                INTEGER PRIMARY KEY,
  article_id        INTEGER NOT NULL REFERENCES articles(id),
  direction         TEXT    NOT NULL DEFAULT 'INCOMING', -- INCOMING | OUTGOING
  target_article_id INTEGER,
  target_slug       TEXT,
  target_title      TEXT,
  anchor            TEXT    NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'LOCAL_INSERTED', -- LOCAL_INSERTED | VERIFIED | BROKEN | REMOVED
  health            TEXT    NOT NULL DEFAULT 'pending',  -- pending | verified | broken
  reason            TEXT,
  verified_at       TEXT,
  created_at        TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_article ON article_links(article_id, status);

-- ---------------------------------------------------------------- research

CREATE TABLE IF NOT EXISTS research_projects (
  id                INTEGER PRIMARY KEY,
  website_id        INTEGER NOT NULL REFERENCES websites(id),
  name              TEXT    NOT NULL,
  description       TEXT,
  breadth           TEXT    NOT NULL DEFAULT 'wide',     -- wide | narrow
  status            TEXT    NOT NULL DEFAULT 'QUEUED',
  stages_requested  INTEGER NOT NULL DEFAULT 11,
  stages_completed  INTEGER NOT NULL DEFAULT 0,
  active_stage      TEXT,
  error             TEXT,
  created_at        TEXT    NOT NULL,
  completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_research_website ON research_projects(website_id, id);

CREATE TABLE IF NOT EXISTS research_stages (
  id             INTEGER PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES research_projects(id),
  key            TEXT    NOT NULL,                       -- description|niche|audiences|problems|topic_map|queries|coverage|clusters
  idx            INTEGER NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'PENDING',
  payload_json   TEXT,
  provenance_json TEXT,
  error          TEXT,
  tokens_in      INTEGER NOT NULL DEFAULT 0,
  tokens_out     INTEGER NOT NULL DEFAULT 0,
  duration_ms    INTEGER NOT NULL DEFAULT 0,
  started_at     TEXT,
  finished_at    TEXT,
  UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS research_entities (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES research_projects(id),
  kind       TEXT    NOT NULL,                           -- niche | audience | problem | query | coverage
  label      TEXT    NOT NULL,
  data_json  TEXT,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_entities ON research_entities(project_id, kind);

-- ---------------------------------------------------------------- calendar

CREATE TABLE IF NOT EXISTS calendars (
  id           INTEGER PRIMARY KEY,
  website_id   INTEGER NOT NULL REFERENCES websites(id),
  timezone     TEXT    NOT NULL DEFAULT 'UTC',
  auto_write   INTEGER NOT NULL DEFAULT 0,
  auto_publish INTEGER NOT NULL DEFAULT 0,
  auto_link    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL
);

ALTER TABLE calendar_entries ADD COLUMN calendar_id INTEGER;
ALTER TABLE calendar_entries ADD COLUMN plan_item_id INTEGER;
ALTER TABLE calendar_entries ADD COLUMN article_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_calendar_entries_cal ON calendar_entries(calendar_id, publish_at);

-- ---------------------------------------------------------------- delivery

CREATE TABLE IF NOT EXISTS static_builds (
  id            INTEGER PRIMARY KEY,
  website_id    INTEGER NOT NULL REFERENCES websites(id),
  build_id      TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'QUEUED',
  pages         INTEGER,
  bytes         INTEGER,
  duration_ms   INTEGER,
  zip_path      TEXT,
  target        TEXT,                                    -- cloudflare_pages | ...
  deployed_at   TEXT,
  created_at    TEXT    NOT NULL,
  UNIQUE (website_id, build_id)
);
CREATE INDEX IF NOT EXISTS idx_builds_website ON static_builds(website_id, id);

-- ---------------------------------------------------------------- ops + money

CREATE TABLE IF NOT EXISTS usage_ledger (
  id          INTEGER PRIMARY KEY,
  ai_key_id   INTEGER REFERENCES ai_keys(id),
  website_id  INTEGER REFERENCES websites(id),
  article_id  INTEGER REFERENCES articles(id),
  stage       TEXT,
  provider    TEXT,
  model_id    TEXT,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  cost_usd    REAL    NOT NULL DEFAULT 0,
  at          TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_website_day ON usage_ledger(website_id, at);
CREATE INDEX IF NOT EXISTS idx_usage_article ON usage_ledger(article_id);

CREATE TABLE IF NOT EXISTS activity_events (
  id           INTEGER PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  website_id   INTEGER,
  kind         TEXT    NOT NULL,
  payload_json TEXT,
  created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_events(workspace_id, id);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  id           INTEGER PRIMARY KEY,
  worker_id    TEXT    NOT NULL,
  version      TEXT    NOT NULL,
  last_tick_at TEXT    NOT NULL,
  jobs_done    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (worker_id)
);

-- Editorial claims contract: a fact may only ship if it is SUPPORTED.
CREATE TABLE IF NOT EXISTS article_claims (
  id             INTEGER PRIMARY KEY,
  article_id     INTEGER NOT NULL REFERENCES articles(id),
  claim          TEXT    NOT NULL,
  support_status TEXT    NOT NULL,                       -- SUPPORTED | UNSUPPORTED | OPINION
  confidence     REAL,
  source         TEXT,
  retrieved_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_claims_article ON article_claims(article_id, support_status);
