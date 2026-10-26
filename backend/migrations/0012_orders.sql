-- Orders: a package bought by a workspace, renewable, and cancellable while it
-- is still the current one.
--
-- These rows are the record of what a workspace paid for, so they are never
-- deleted — a cancelled order keeps its place and its cancellation time, which
-- is what "track or cancel an order" has to be able to show afterwards.
CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id  INTEGER NOT NULL,
    package       TEXT NOT NULL,
    articles      INTEGER NOT NULL,
    price_cents   INTEGER NOT NULL,
    currency      TEXT NOT NULL DEFAULT 'USD',
    -- placed → active → (expired | cancelled). Renewing places a new order and
    -- extends the active window from whichever is later: today or the old end.
    status        TEXT NOT NULL DEFAULT 'placed',
    tracking      TEXT NOT NULL,
    placed_at     TEXT NOT NULL,
    active_until  TEXT,
    cancelled_at  TEXT,
    renewed_from  INTEGER,
    note          TEXT
);

CREATE INDEX IF NOT EXISTS orders_workspace_idx ON orders (workspace_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS orders_tracking_idx ON orders (tracking);
