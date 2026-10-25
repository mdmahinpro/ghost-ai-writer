/**
 * cPanel credentials live on the server now, encrypted at rest.
 *
 * The password never comes back to the browser: `load` returns `has_password`, and a
 * blank password on save or test means "use the one on file". This replaces the old
 * flow that kept the login in `localStorage`, where it was neither encrypted nor part
 * of the account.
 */
import { del, get, post } from "./api-client.ts";

export const WORKSPACE_ID = 1;

export type SavedFtp = {
  workspace_id: number;
  host: string;
  username: string;
  port: number;
  remote_dir: string;
  public_url: string;
  trust_cert: boolean;
  has_password: boolean;
  verified_at: string | null;
};

export async function loadFtpCredentials(): Promise<SavedFtp | null> {
  const result = await get<SavedFtp | null>(`/api/v1/ftp/credentials?workspace_id=${WORKSPACE_ID}`);
  if (!result.ok) return null;
  return result.data ?? null;
}

export async function saveFtpCredentials(input: {
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

export async function forgetFtpCredentials(): Promise<boolean> {
  const result = await del<{ removed: boolean }>(`/api/v1/ftp/credentials?workspace_id=${WORKSPACE_ID}`);
  return result.ok && Boolean(result.data?.removed);
}
