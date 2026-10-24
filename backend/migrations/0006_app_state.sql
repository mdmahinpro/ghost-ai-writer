CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    generation INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_state_workspace
    ON app_state(workspace_id);