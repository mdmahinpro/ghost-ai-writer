/**
 * cPanel credentials live on the server now, encrypted at rest.
 *
 * The password never comes back to the browser: `load` returns `has_password`, and a
 * blank password on save or test means "use the one on file". This replaces the old
 * flow that kept the login in `localStorage`, where it was neither encrypted nor part
 * of the account.
 */
import { del, get, post } from "./api-client.ts";

/**
 * Fallback tenant id. Every site is its own workspace in the UI; the server
 * still stores the studio snapshot under workspace 1, so this is only the
 * account-level default, never the site a connection belongs to.
 */
export const WORKSPACE_ID = 1;

export type SavedFtp = {
  workspace_id: number;
  /** The browser site this login belongs to. */
  site_uid: string;
  host: string;
  username: string;
  port: number;
  remote_dir: string;
  public_url: string;
  trust_cert: boolean;
  has_password: boolean;
  verified_at: string | null;
};

/**
 * Read the cPanel connection saved for one site.
 *
 * The site is part of the address: before this, every workspace fetched the
 * single account-level row, so a new workspace opened the previous site's host,
 * username and public URL.
 */
export async function loadFtpCredentials(siteUid = "", workspaceId = WORKSPACE_ID): Promise<SavedFtp | null> {
  const query = new URLSearchParams({ workspace_id: String(workspaceId), site_uid: siteUid });
  const result = await get<SavedFtp | null>(`/api/v1/ftp/credentials?${query.toString()}`);
  if (!result.ok) return null;
  return result.data ?? null;
}

export async function saveFtpCredentials(input: {
  siteUid?: string;
  host: string;
  username: string;
  password: string;
  port: number;
  remoteDir: string;
  publicUrl: string;
  trustCert: boolean;
  verified?: boolean;
}): Promise<{ ok: true; saved: SavedFtp } | { ok: false; error: string }> {
  const result = await post<SavedFtp>("/api/v1/ftp/credentials", {
    workspace_id: WORKSPACE_ID,
    site_uid: input.siteUid ?? "",
    host: input.host,
    username: input.username,
    password: input.password,
    port: input.port,
    remote_dir: input.remoteDir,
    public_url: input.publicUrl,
    trust_cert: input.trustCert,
    verified: input.verified ?? false,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, saved: result.data };
}

export async function forgetFtpCredentials(siteUid = ""): Promise<boolean> {
  const query = new URLSearchParams({ workspace_id: String(WORKSPACE_ID), site_uid: siteUid });
  const result = await del<{ removed: boolean }>(`/api/v1/ftp/credentials?${query.toString()}`);
  return result.ok && Boolean(result.data?.removed);
}
