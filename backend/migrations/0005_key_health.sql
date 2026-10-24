-- 0005_key_health.sql — key demotion instead of exclusion (Rule 4).
--
-- Their engine never drops a key because of a local flag: only the provider can
-- truly say a key is spent or rejected. A key that is paused (`disabled`) or
-- inside a live 429 window (`cooldown_until`) is ordered BEHIND the healthy keys
-- so it is tried last as a failover, never removed from the pool. That is what
-- makes "unlimited" work: a second key always exists to catch a rate-limited
-- first one.
--
--   disabled      — the provider answered 401/403: the key is rejected, and
--                   only a human re-enables it.
--   cooldown_until — set 12s ahead on HTTP 429. Not a ban: after it passes the
--                   key is healthy again and returns to priority order.
--   last_error / last_error_at — the exact status and provider message, kept so
--                   the keys screen can show why a key was demoted.

ALTER TABLE ai_keys ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_keys ADD COLUMN cooldown_until TEXT;
ALTER TABLE ai_keys ADD COLUMN last_error TEXT;
ALTER TABLE ai_keys ADD COLUMN last_error_at TEXT;
ALTER TABLE ai_keys ADD COLUMN last_used_at TEXT;

-- The pool scan orders by health then priority; index the health column too so
-- a large key list does not force a sort on every stage.
CREATE INDEX IF NOT EXISTS idx_ai_keys_pool ON ai_keys(workspace_id, role, disabled, priority);
