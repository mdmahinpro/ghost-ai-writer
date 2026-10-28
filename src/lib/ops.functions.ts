/**
 * Ops from the browser: FTP/FTPS, IndexNow, and the three deploy adapters.
 *
 * Every one of these used to be a Node server function. They now call the Rust
 * API, which owns the FTPS client (explicit TLS, protected data channel, TLS 1.2
 * pinned, session reuse), the IndexNow key-file proof, and the provider calls.
 * Credentials still travel per request from Connections and are never stored.
 */
import { LONG_CALL_S, get, post } from "./api-client.ts";
import { WORKSPACE_ID } from "./ftp-credentials.ts";

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
  data: FtpTarget & { workspace_id?: number; trust_cert?: boolean; site_uid?: string };
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
    site_uid: d.site_uid,
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
  data: FtpTarget & { workspace_id?: number; site_uid?: string; files?: { name: string; base64: string }[] };
}): Promise<
  | {
      ok: true;
      files: number;
      host: string;
      /** What the server's CMS push did as part of the upload, when it got that far. */
      ghost?: { ok: boolean; mode?: string; pushed?: number; published?: number; failed?: string[]; error?: string };
    }
  | { ok: false; error: string }
> {
  const d = input?.data ?? {};
  const res = await post<{
    ok: boolean;
    files?: number;
    host?: string;
    error?: string;
    /**
     * The CMS push the server does as part of the upload. Absent means the
     * upload did not get far enough to try; present with `ok: false` means the
     * files are live and the CMS refused, with its own reason.
     */
    ghost?: { ok: boolean; mode?: string; pushed?: number; published?: number; failed?: string[]; error?: string };
  }>(
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
    // A build is tens of files written one at a time; the standard 30-second cap
    // aborted real uploads mid-transfer.
    LONG_CALL_S,
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok) return { ok: false, error: res.data.error ?? "The upload failed." };
  return {
    ok: true,
    files: res.data.files ?? 0,
    host: res.data.host ?? d.host ?? "",
    ghost: res.data.ghost,
  };
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

export function forgetArticles(input: {
  data: { site_ref: string; slugs: string[] };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // Fire-and-forget from the article list: the studio drops the rows locally and
  // this keeps the server's copy in step, so the CMS mirror stops pushing them.
  return forgetArticlesRequest(input.data);
}

/**
 * What the calendar automation would do next, without doing any of it.
 *
 * The three switches live on the server (`calendar::pulse`), so the dry run has
 * to as well: a client-side guess would eventually disagree with the thing it is
 * describing, which is worse than no preview at all.
 */
export async function previewCalendar(): Promise<CalendarPreview> {
  const res = await get<{
    now_ms: number;
    items: CalendarPlanItem[];
    next_write_at: number | null;
    next_publish_at: number | null;
    skipped_no_site: number;
    calendars: { id: string; autoGenerate: boolean; autoPublish: boolean; autoReweave: boolean }[];
  }>(`/api/v1/calendar/preview?workspace_id=${WORKSPACE_ID}`);
  if (!res.ok) return { ok: false, error: res.error ?? "The preview could not be read." };
  return { ok: true, ...res.data };
}

export type CalendarPlanItem = {
  calendar_id: string;
  action: string;
  item_id: string;
  title: string;
  due_at: number;
};

export type CalendarPreview =
  | {
      ok: true;
      now_ms: number;
      items: CalendarPlanItem[];
      next_write_at: number | null;
      next_publish_at: number | null;
      skipped_no_site: number;
      calendars: { id: string; autoGenerate: boolean; autoPublish: boolean; autoReweave: boolean }[];
    }
  | { ok: false; error: string };

async function forgetArticlesRequest(payload: {
  site_ref: string;
  slugs: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await post<{ ok: boolean; error?: string }>("/api/v1/articles/forget", payload);
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok) return { ok: false, error: res.data.error ?? "The server refused the delete." };
  return { ok: true };
}

/**
 * Humanize one article on the server, and give it a byline if it has none.
 *
 * The Fix buttons used to run the humanizer in the tab, which meant the work
 * died with the tab and every other reader of that article still saw the old
 * prose. The server owns it now: the row is rewritten once, for everyone.
 */
export async function repairArticle(input: {
  data: { workspace_id: number; article_id: number; site_ref: string };
}): Promise<
  | {
      ok: true;
      markdown: string;
      score: number;
      passes: number;
      note: string;
      authorName: string;
      authorSlug: string;
      authorBeat: string;
      authorCity: string;
    }
  | { ok: false; error: string }
> {
  const res = await post<{
    ok: boolean;
    error?: string;
    article?: {
      markdown: string;
      score: number;
      passes: number;
      note: string;
      authorName: string;
      authorSlug: string;
      authorBeat: string;
      authorCity: string;
    };
  }>("/api/v1/articles/repair", input.data);
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok || !res.data.article) {
    return { ok: false, error: res.data.error ?? "The server refused the repair." };
  }
  return { ok: true, ...res.data.article };
}

export async function mirrorArticlesToCms(input: {
  data: { site_ref: string; website_id?: number };
}): Promise<
  | { ok: true; mode: string; url: string; pushed: number; failed: string[] }
  | { ok: false; error: string }
> {
  const res = await post<{
    ok: boolean;
    mode?: string;
    url?: string;
    pushed?: number;
    failed?: string[];
    error?: string;
  }>("/api/v1/ghost/mirror", input.data, LONG_CALL_S);
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.data.ok) return { ok: false, error: res.data.error ?? "The CMS refused the request." };
  return {
    ok: true,
    mode: res.data.mode ?? "",
    url: res.data.url ?? "",
    pushed: res.data.pushed ?? 0,
    failed: res.data.failed ?? [],
  };
}

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
