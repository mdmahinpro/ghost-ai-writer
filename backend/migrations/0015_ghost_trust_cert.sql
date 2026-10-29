-- Some Ghost installs sit behind a panel that never issued a certificate for
-- the CMS subdomain (Traefik answers with its own default cert), so every client
-- refuses the handshake and the connection can never be tested, synced or
-- published to. The operator can accept that certificate per site; the flag has
-- to live with the connection so the worker publishes over the same terms the
-- test used.
ALTER TABLE websites ADD COLUMN ghost_trust_cert INTEGER NOT NULL DEFAULT 0;
