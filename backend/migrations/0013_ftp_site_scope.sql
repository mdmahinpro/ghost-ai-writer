-- A cPanel login belongs to one site, not to the whole account.
--
-- Every row was keyed by workspace_id and the browser only ever sent 1, so all
-- workspaces shared a single login: switching workspace showed the previous
-- site's host, username and public URL. Rows are keyed by (workspace, site) now.
--
-- The table is rebuilt rather than ALTERed because workspace_id is its primary
-- key and SQLite cannot drop that in place. Nothing is lost: every column is
-- copied, and the existing row is claimed for the site whose public URL it
-- serves, so a working connection keeps working.
CREATE TABLE ftp_connections_v2 (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  site_uid     TEXT    NOT NULL DEFAULT '',
  host         TEXT    NOT NULL,
  username     TEXT    NOT NULL,
  password_enc TEXT    NOT NULL,
  port         INTEGER NOT NULL DEFAULT 21,
  remote_dir   TEXT    NOT NULL DEFAULT '/public_html',
  public_url   TEXT    NOT NULL DEFAULT '',
  trust_cert   INTEGER NOT NULL DEFAULT 1,
  verified_at  TEXT,
  updated_at   TEXT    NOT NULL,
  UNIQUE (workspace_id, site_uid)
);

INSERT INTO ftp_connections_v2
  (workspace_id, site_uid, host, username, password_enc, port, remote_dir,
   public_url, trust_cert, verified_at, updated_at)
SELECT workspace_id, '', host, username, password_enc, port, remote_dir,
       public_url, trust_cert, verified_at, updated_at
FROM ftp_connections;

UPDATE ftp_connections_v2
   SET site_uid = COALESCE((
         SELECT s.client_uid
           FROM sites s
          WHERE s.workspace_id = ftp_connections_v2.workspace_id
            AND COALESCE(s.client_uid, '') <> ''
            AND ftp_connections_v2.public_url <> ''
            AND instr(lower(ftp_connections_v2.public_url), lower(s.domain)) > 0
          ORDER BY s.id
          LIMIT 1
       ), '')
 WHERE site_uid = '';

DROP TABLE ftp_connections;
ALTER TABLE ftp_connections_v2 RENAME TO ftp_connections;
