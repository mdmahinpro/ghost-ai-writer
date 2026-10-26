/**
 * Ops from the browser: FTP/FTPS, IndexNow, and the three deploy adapters.
 *
 * Every one of these used to be a Node server function. They now call the Rust
 * API, which owns the FTPS client (explicit TLS, protected data channel, TLS 1.2
 * pinned, session reuse), the IndexNow key-file proof, and the provider calls.
 * Credentials still travel per request from Connections and are never stored.
 */
import { post } from "./api-client";

export type FtpStep = { name: string; ok: boolean; ms: number; detail: string };

type FtpTarget = {
  host?: string;
  user?: string;
  password?: string;
  port?: number;
  path?: string;
  via?: "ftps" | "sftp";
};

export async function testFtpLogin(input: {
  data: FtpTarget & { workspace_id?: number; trust_cert?: boolean };
}): Promise<
  | { ok: true; steps: FtpStep[]; via: "ftps" | "sftp"; user: string; banner: string }
  | { ok: false; error: string; steps: FtpStep[] }
> {
  const d = input?.data ?? {};
  const res = await post<{
    ok: boolean;
    steps?: FtpStep[];
    via?: "ftps" | "sftp";
    user?: string;
    banner?: string;
    error?: string;
  }>("/api/v1/ftp/test", {
    host: d.host ?? "",
    port: d.port ?? 21,
    user: d.user ?? "",
    password: d.password ?? "",
    path: d.path ?? "/public_html",
    via: d.via ?? "ftps",
    // Tells the server which sealed password to use when the browser sends none.
    workspace_id: d.workspace_id,
    trust_cert: d.trust_cert,
  });
  if (!res.ok) return { ok: false, error: res.error, steps: [] };
  if (!res.data.ok) {
    return { ok: false, error: res.data.error ?? "FTP sign-in failed.", steps: res.data.steps ?? [] };
  }
  return {
    ok: true,
    steps: res.data.steps ?? [],
    via: res.data.via === "sftp" ? "sftp" : "ftps",
    user: res.data.user ?? d.user ?? "",
    banner: res.data.banner ?? "",
  };
}

export async function uploadFtps(input: {
  data: FtpTarget & { workspace_id?: number; files?: { name: string; base64: string }[] };
}): Promise<{ ok: true; files: number; host: string } | { ok: false; error: string }> {
  const d = input?.data ?? {};
  const res = await post<{ ok: boolean; files?: number; host?: string; error?: string }>(
    "/api/v1/ftp/upload",
    {
      host: d.host ?? "",
      port: d.port ?? 21,
      user: d.user ?? "",
      // Blank means "use the password saved on the server for this workspace".
      password: d.password ?? "",
      path: d.path ?? "/",
      via: d.via ?? "ftps",
      workspace_id: d.workspace_id,
      files: d.files ?? [],
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok) return { ok: false, error: res.data.error ?? "The upload failed." };
  return { ok: true, files: res.data.files ?? 0, host: res.data.host ?? d.host ?? "" };
}

export async function submitIndexNow(input: {
  data: {
    publicUrl?: string;
    key?: string;
    urls?: string[];
    verified?: boolean;
    ftp?: FtpTarget;
  };
}): Promise<
  | { ok: true; status: number; keyLocation: string }
  | { ok: false; status: number; error: string }
> {
  const d = input?.data ?? {};
  const ftp = d.ftp ?? {};
  const res = await post<{ ok: boolean; status?: number; keyLocation?: string; error?: string }>(
    "/api/v1/indexnow",
    {
      public_url: d.publicUrl ?? "",
      key: d.key ?? "",
      urls: (d.urls ?? []).slice(0, 100),
      verified: d.verified === true,
      ftp: {
        host: ftp.host ?? "",
        user: ftp.user ?? "",
        password: ftp.password ?? "",
        port: ftp.port ?? 21,
        path: ftp.path ?? "/",
      },
    },
  );
  if (!res.ok) return { ok: false, status: 0, error: res.error };
  if (!res.data.ok) {
    return { ok: false, status: res.data.status ?? 0, error: res.data.error ?? "IndexNow failed." };
  }
  return { ok: true, status: res.data.status ?? 200, keyLocation: res.data.keyLocation ?? "" };
}

const DEPLOY_HOSTS = {
  cloudflare: "https://api.cloudflare.com",
  vercel: "https://api.vercel.com",
  github: "https://api.github.com",
} as const;

export { DEPLOY_HOSTS };

type DeployFile = { name: string; base64: string };

/** Kept for callers that pre-validate; the API repeats every one of these rules. */
export function readDeployFiles(raw: unknown): { files: DeployFile[]; error?: string } {
  const list = Array.isArray(raw) ? raw : [];
  if (!list.length) return { files: [], error: "No files to deploy." };
  if (list.length > 400) return { files: [], error: "Refusing more than 400 files in one adapter deploy." };
  let total = 0;
  const files: DeployFile[] = [];
  for (const entry of list) {
    const file = entry as { name?: unknown; base64?: unknown };
    const name = typeof file?.name === "string" ? file.name.replace(/\\/g, "/").replace(/^\/+/, "") : "";
    const base64 = typeof file?.base64 === "string" ? file.base64 : "";
    if (!name || name.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(name)) {
      return { files: [], error: `Unsafe file name in the deploy payload: ${name || "(empty)"}` };
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return { files: [], error: `File ${name} is not valid base64.` };
    total += base64.length;
    files.push({ name, base64 });
  }
  if (total > 48_000_000) return { files: [], error: "Deploy payload exceeds the 32 MiB limit." };
  return { files };
}

type AdapterResult =
  | { ok: true; detail: string; url?: string; files: number }
  | { ok: false; error: string };

export async function deployCloudflarePages(input: {
  data: { accountId?: string; token?: string; projectName?: string; files?: DeployFile[] };
}): Promise<AdapterResult> {
  const res = await post<AdapterResult>("/api/v1/deploy/cloudflare", {
    account_id: input?.data?.accountId ?? "",
    token: input?.data?.token ?? "",
    project_name: input?.data?.projectName ?? "",
    files: input?.data?.files ?? [],
  });
  return res.ok ? res.data : { ok: false, error: res.error };
}

export async function deployVercel(input: {
  data: { token?: string; projectName?: string; files?: DeployFile[] };
}): Promise<AdapterResult> {
  const res = await post<AdapterResult>("/api/v1/deploy/vercel", {
    token: input?.data?.token ?? "",
    project_name: input?.data?.projectName ?? "",
    files: input?.data?.files ?? [],
  });
  return res.ok ? res.data : { ok: false, error: res.error };
}

export async function deployGithubPages(input: {
  data: { token?: string; repo?: string; branch?: string; files?: DeployFile[] };
}): Promise<AdapterResult> {
  const res = await post<AdapterResult>("/api/v1/deploy/github", {
    token: input?.data?.token ?? "",
    repo: input?.data?.repo ?? "",
    branch: input?.data?.branch ?? "gh-pages",
    files: input?.data?.files ?? [],
  });
  return res.ok ? res.data : { ok: false, error: res.error };
}
