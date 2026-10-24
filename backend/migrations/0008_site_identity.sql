-- Site identity bridge.
--
-- The browser is the source of truth for what a "site" is: the store creates
-- one with a uid string (`site_1a2b3c`) the moment the user adds it, and every
-- job, article and run in the UI is scoped by that string. The Rust tables key
-- on numeric ids, created either by seeding or by this endpoint. Until now the
-- two universes had no correspondence, so server-run jobs could not be
-- attributed to a site the UI knew about.
--
-- `client_uid` records the browser's id on the server row, so a site keeps one
-- identity in both places. It is nullable because seeded and legacy rows have
-- no browser counterpart, and unique per workspace so an ensure call is
-- idempotent rather than creating a duplicate site on every page load.
--
-- `website_id` links the site to its `websites` row. Intake previously assumed
-- `website_id = site_id`, which only held because seeding happened to number
-- both tables identically; recording the real link removes that accident.
ALTER TABLE sites ADD COLUMN client_uid TEXT;
ALTER TABLE sites ADD COLUMN website_id INTEGER REFERENCES websites(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_client_uid
  ON sites(workspace_id, client_uid)
  WHERE client_uid IS NOT NULL;
