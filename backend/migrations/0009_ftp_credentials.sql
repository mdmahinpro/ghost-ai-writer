-- The cPanel login used to live in browser storage: not encrypted at rest, and it
-- did not follow the account to another browser. It lives here now, sealed with the
-- same AES-256-GCM key that protects provider credentials (`secrets.rs`), so the
-- browser never holds the password again.
--
-- One connection per workspace: the FTP account belongs to the site being published,
-- and the client is pinned to one workspace per site.
CREATE TABLE IF NOT EXISTS ftp_connections (
  workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id),
  host         TEXT    NOT NULL,
  username     TEXT    NOT NULL,
  password_enc TEXT    NOT NULL,
  port         INTEGER NOT NULL DEFAULT 21,
  remote_dir   TEXT    NOT NULL DEFAULT '/public_html',
  public_url   TEXT    NOT NULL DEFAULT '',
  -- 1 = accept a mismatched or self-signed certificate, which shared cPanel hosts
  -- normally present. 0 = verify the chain and name against the public roots.
  trust_cert   INTEGER NOT NULL DEFAULT 1,
  verified_at  TEXT,
  updated_at   TEXT    NOT NULL
);
