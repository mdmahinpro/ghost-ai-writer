import { createServerFn } from "@tanstack/react-start";
import { post } from "./api-client";
import net from "node:net";
import tls from "node:tls";
import { isPrivateHost } from "./engine";
import { indexNowKeyFile } from "./static-site";
import { sftpList, sftpUpload } from "./sftp-io";

function safe(error: unknown): string {
  const msg = error instanceof Error ? error.message : "Request failed.";
  return msg.replace(/PASS\s+\S+/gi, "PASS •••").slice(0, 320);
}

async function publicHost(host: string): Promise<void> {
  if (!host || host.includes("/") || isPrivateHost(host)) throw new Error("That host is not allowed.");
  const dns = await import("node:dns/promises");
  const records = await dns.lookup(host, { all: true });
  for (const record of records) {
    const address = record.address.toLowerCase().replace(/^::ffff:/, "");
    if (isPrivateHost(address) || address === "::1") throw new Error("That host resolves to a private address.");
  }
}

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function armSocket(socket: net.Socket, ms: number, message: string) {
  socket.setTimeout(ms);
  socket.once("timeout", () => socket.destroy(new Error(message)));
}

function readReply(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => {
      socket.off("data", onData);
      reject(new Error("FTP timed out."));
    }, 8000);
    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] ?? "";
      if (/^\d{3} /.test(last)) {
        clearTimeout(timer);
        socket.off("data", onData);
        resolve(buf.trim());
      }
    };
    socket.on("data", onData);
  });
}

async function loginFtp(secure: tls.TLSSocket, user: string, password: string): Promise<string> {
  const names = user.endsWith(".com") ? [user, user.slice(0, -".com".length)] : [user];
  let last = "530 Login incorrect.";
  for (const name of names) {
    secure.write(`USER ${name}\r\n`);
    const userReply = await readReply(secure);
    if (userReply.includes("230")) return name;
    if (!userReply.includes("331")) {
      last = userReply.split(/\r?\n/).filter(Boolean).pop() ?? last;
      continue;
    }
    secure.write(`PASS ${password}\r\n`);
    const passReply = await readReply(secure);
    if (passReply.includes("230")) return name;
    last = (passReply.split(/\r?\n/).filter(Boolean).pop() ?? last).replace(/PASS\s+\S+/gi, "PASS");
  }
  throw new Error(`FTP rejected the password for ${user}. ${last} Hostinger shows a .com on the account name, but the login is the same name without .com.`);
}

export const submitIndexNow = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input as {
      publicUrl?: string;
      key?: string;
      urls?: string[];
      verified?: boolean;
      ftp?: { host?: string; user?: string; password?: string; port?: number; path?: string; via?: string };
    } | null;
    const publicUrl = String(raw?.publicUrl ?? "").trim();
    const key = String(raw?.key ?? "").trim();
    const urls = Array.isArray(raw?.urls) ? raw.urls.map((url) => String(url)).slice(0, 100) : [];
    if (!/^https:\/\//.test(publicUrl)) throw new Error("Set a public https URL before submitting IndexNow.");
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("IndexNow key must be 8–128 letters, numbers, or dashes.");
    if (!urls.length) throw new Error("There are no article URLs to submit.");
    const ftp = raw?.ftp;
    return {
      publicUrl: publicUrl.replace(/\/$/, ""),
      key,
      urls,
      verified: raw?.verified === true,
      ftp: {
        host: String(ftp?.host ?? "").trim(),
        user: String(ftp?.user ?? "").trim(),
        password: String(ftp?.password ?? ""),
        port: Number(ftp?.port ?? 21) || 21,
        path: String(ftp?.path ?? "/").trim() || "/",
        via: ftp?.via === "sftp" ? "sftp" : "ftps",
      },
    };
  })
  .handler(async ({ data }) => {
    try {
      if (!data.verified || !data.ftp.host || !data.ftp.user || !data.ftp.password) {
        return {
          ok: false as const,
          status: 0,
          error: "cPanel hosting is not verified. Verify Explicit-TLS FTPS on Connections before submitting IndexNow. Bing was not called.",
        };
      }
      const file = indexNowKeyFile(data.key);
      if (!file) return { ok: false as const, status: 0, error: "IndexNow key must be 8–128 letters, numbers, or dashes." };
      const origin = new URL(data.publicUrl);
      if (data.ftp.host !== "preview-cpanel") await publicHost(origin.hostname);
      const uploaded = await uploadFtps({
        data: {
          host: data.ftp.host,
          user: data.ftp.user,
          password: data.ftp.password,
          port: data.ftp.port,
          path: data.ftp.path,
          via: data.ftp.via,
          files: [{ name: file.name, base64: Buffer.from(file.text, "utf8").toString("base64") }],
        },
      });
      if (!uploaded.ok) {
        return { ok: false as const, status: 0, error: `The key file was not uploaded. ${uploaded.error} Bing was not called.` };
      }
      const keyLocation = `${data.publicUrl}/${file.name}`;
      if (data.ftp.host !== "preview-cpanel") {
        const probe = await fetch(keyLocation, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (probe.status >= 300 && probe.status < 400) {
          return { ok: false as const, status: probe.status, error: `The key file at ${keyLocation} redirected. Bing was not called.` };
        }
        const body = probe.status === 200 ? (await probe.text()).trim() : "";
        if (probe.status !== 200 || body !== data.key) {
          return {
            ok: false as const,
            status: probe.status,
            error: `The key file at ${keyLocation} did not return the key (HTTP ${probe.status}). Bing was not called.`,
          };
        }
      } else if (file.text.trim() !== data.key) {
        return { ok: false as const, status: 0, error: "The key file contents do not match the IndexNow key. Bing was not called." };
      }
      if (data.ftp.host === "preview-cpanel") return { ok: true as const, status: 200, keyLocation };
      const response = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: origin.hostname,
          key: data.key,
          keyLocation,
          urlList: data.urls,
        }),
      });
      if (response.status >= 300 && response.status < 400) return { ok: false as const, status: response.status, error: "IndexNow redirected. Blocked." };
      if (response.ok || response.status === 202) return { ok: true as const, status: response.status, keyLocation };
      return { ok: false as const, status: response.status, error: `IndexNow returned HTTP ${response.status}.` };
    } catch (error) {
      return { ok: false as const, status: 0, error: safe(error) };
    }
  });

// VPS: Bing Webmaster status poll. Add a server cron after the move; browser builds cannot poll standing submission status.

export type FtpStep = { name: string; ok: boolean; ms: number; detail: string };

function pushStep(steps: FtpStep[], name: string, started: number, ok: boolean, detail: string) {
  steps.push({ name, ok, ms: Date.now() - started, detail });
}

function tlsOptions(host: string, session?: Buffer) {
  return {
    rejectUnauthorized: false,
    minVersion: "TLSv1.2" as const,
    maxVersion: "TLSv1.2" as const,
    servername: /^\d+\.\d+\.\d+\.\d+$/.test(host) ? undefined : host,
    session,
  };
}

function parsePasv(reply: string, fallbackHost: string): { host: string; port: number } | null {
  const match = reply.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!match) return null;
  const ip = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
  const port = Number(match[5]) * 256 + Number(match[6]);
  return { host: isPrivateHost(ip) ? fallbackHost : ip, port };
}

export const testFtpLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input as { host?: string; user?: string; password?: string; port?: number; path?: string } | null;
    const host = String(raw?.host ?? "").trim();
    const user = String(raw?.user ?? "").trim();
    const password = String(raw?.password ?? "");
    const path = String(raw?.path ?? "/").trim().replace(/^\/?public_html$/, "/") || "/";
    const port = Number(raw?.port ?? 21) || 21;
    if (!host || !user || !password) throw new Error("Host, username, and password are required.");
    if (user.length > 80 || password.length > 200 || host.length > 200) throw new Error("FTP fields are too long.");
    if (port < 1 || port > 65535) throw new Error("FTP port is not valid.");
    return { host, user, password, port, path };
  })
  .handler(async ({ data }) => {
    const steps: FtpStep[] = [];
    let plain: net.Socket | null = null;
    let secure: tls.TLSSocket | null = null;
    try {
      const configStarted = Date.now();
      pushStep(steps, "CONFIG", configStarted, true, "host, username, password and remote path present");

      const dnsStarted = Date.now();
      await publicHost(data.host);
      pushStep(steps, "DNS", dnsStarted, true, "resolves to a public address");

      const tcpStarted = Date.now();
      plain = net.connect({ host: data.host, port: data.port, timeout: 8000 });
      armSocket(plain, 8000, "Could not reach that host on the FTP port. Check the hostname and port.");
      const greetingPromise = readReply(plain);
      await new Promise<void>((resolve, reject) => {
        plain!.once("connect", () => resolve());
        plain!.once("error", reject);
      });
      const hello = await greetingPromise;
      if (!/^220/.test(hello)) throw new Error("The server did not greet as FTP.");
      pushStep(steps, "TCP", tcpStarted, true, "connected; server says 220 FTP ready");

      const tlsStarted = Date.now();
      plain.write("AUTH TLS\r\n");
      const auth = await readReply(plain);
      if (!auth.includes("234")) throw new Error("This host does not offer explicit TLS on that port.");
      secure = tls.connect({ socket: plain, ...tlsOptions(data.host) });
      armSocket(secure, 8000, "Explicit TLS started, but the handshake did not finish.");
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          secure!.once("secureConnect", () => resolve());
          secure!.once("error", reject);
        }),
        8000,
        "Explicit TLS started, but the handshake did not finish.",
      );
      pushStep(steps, "TLS", tlsStarted, true, "explicit TLS established");

      const authStarted = Date.now();
      const account = await loginFtp(secure, data.user, data.password);
      data.user = account;
      pushStep(steps, "AUTH", authStarted, true, `the FTP account accepted ${account}`);

      const settingsStarted = Date.now();
      secure.write("PBSZ 0\r\n");
      await readReply(secure);
      secure.write("PROT P\r\n");
      const prot = await readReply(secure);
      if (!prot.includes("200")) throw new Error("The server refused a protected data channel.");
      pushStep(steps, "SETTINGS", settingsStarted, true, "protected data channel negotiated");

      const listStarted = Date.now();
      let listing = "";
      try {
        secure.write("PASV\r\n");
        const pasv = await readReply(secure);
        const endpoint = parsePasv(pasv, data.host);
        if (!endpoint) throw new Error("The server did not open a passive port.");
        if (data.path === "public_html" || data.path === "/public_html") data.path = "/";
        listing = await listProtected(endpoint.host, endpoint.port, secure, data.path);
      } catch (error) {
        try {
          const listing = await sftpList(data.host, data.user, data.password, data.path);
          const entries = listing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
          pushStep(steps, "LIST", listStarted, true, `${entries} entries over SFTP port 65002. Passive FTP is blocked, so files use SFTP.`);
          secure.write("QUIT\r\n");
          secure.end();
          return {
            ok: true as const,
            steps,
            via: "sftp" as const,
            user: data.user,
            banner: `cPanel verified over SFTP (${data.host}:65002, ${data.path} readable). Passive FTP ports are blocked.`,
          };
        } catch (sftpError) {
          pushStep(steps, "LIST", listStarted, false, safe(error));
          const mainUser = data.user.includes(".") ? data.user.split(".")[0] : "";
          const hint = mainUser
            ? ` Try the main Hostinger username ${mainUser} on port 65002, or upload the ZIP in hPanel → Files → File Manager → public_html.`
            : " Upload the ZIP in hPanel → Files → File Manager → public_html.";
          throw new Error(`Signed in on FTP, but the data port is blocked and SFTP on port 65002 refused this user (${safe(sftpError)}).${hint}`);
        }
      }
      const entries = listing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
      pushStep(steps, "LIST", listStarted, true, `${entries} entries readable in ${data.path}`);

      secure.write("QUIT\r\n");
      secure.end();
      return { ok: true as const, steps, via: "ftps" as const, user: data.user, banner: `cPanel verified over FTPS (${data.host}:${data.port}, ${data.path} readable)` };
    } catch (error) {
      const failed = steps.some((step) => !step.ok) ? steps : [...steps, { name: "STOP", ok: false, ms: 0, detail: safe(error) }];
      try {
        secure?.destroy();
        plain?.destroy();
      } catch {
        /* already closed */
      }
      return { ok: false as const, error: safe(error), steps: failed };
    }
  });

export const uploadFtps = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input as { host?: string; user?: string; password?: string; port?: number; path?: string; via?: string; files?: { name?: string; base64?: string }[] } | null;
    const host = String(raw?.host ?? "").trim();
    const user = String(raw?.user ?? "").trim();
    const password = String(raw?.password ?? "");
    const path = String(raw?.path ?? "/").trim().replace(/^\/?public_html$/, "/") || "/";
    const port = Number(raw?.port ?? 21) || 21;
    const files = Array.isArray(raw?.files) ? raw.files : [];
    if (!host || !user || !password) throw new Error("Host, username, and password are required.");
    if (!files.length) throw new Error("There are no files to upload.");
    if (files.length > 80) throw new Error("Too many files for one upload.");
    const clean = files.map((file) => {
      const name = String(file?.name ?? "").replace(/^\/+/, "");
      if (!name || name.includes("..") || !/^[a-zA-Z0-9._/-]+$/.test(name)) throw new Error("A file path is not safe to upload.");
      const base64 = String(file?.base64 ?? "");
      if (base64.length > 2_000_000) throw new Error(`${name} is too large to upload from this panel.`);
      return { name, base64 };
    });
    const via = raw?.via === "sftp" ? "sftp" : "ftps";
    return { host, user, password, port, path, via, files: clean };
  })
  .handler(async ({ data }) => {
    if (data.host === "preview-cpanel") return { ok: true as const, files: data.files.length };
    let plain: net.Socket | null = null;
    let secure: tls.TLSSocket | null = null;
    try {
      if (data.via === "sftp") {
        const files = await sftpUpload(data.host, data.user, data.password, data.path, data.files);
        return { ok: true as const, files };
      }
      await publicHost(data.host);
      plain = net.connect({ host: data.host, port: data.port, timeout: 8000 });
      armSocket(plain, 8000, "Could not reach that host on the FTP port. Check the hostname and port.");
      const greetingPromise = readReply(plain);
      await new Promise<void>((resolve, reject) => {
        plain!.once("connect", () => resolve());
        plain!.once("error", reject);
      });
      const hello = await greetingPromise;
      if (!/^220/.test(hello)) throw new Error("The server did not greet as FTP.");
      plain.write("AUTH TLS\r\n");
      const auth = await readReply(plain);
      if (!auth.includes("234")) throw new Error("This host does not offer explicit TLS on that port.");
      secure = tls.connect({ socket: plain, ...tlsOptions(data.host) });
      armSocket(secure, 8000, "Explicit TLS started, but the handshake did not finish.");
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          secure!.once("secureConnect", () => resolve());
          secure!.once("error", reject);
        }),
        8000,
        "Explicit TLS started, but the handshake did not finish.",
      );
      const account = await loginFtp(secure, data.user, data.password);
      data.user = account;
      secure.write("PBSZ 0\r\n");
      await readReply(secure);
      secure.write("PROT P\r\n");
      const prot = await readReply(secure);
      if (!prot.includes("200")) throw new Error("The server refused a protected data channel.");
      secure.write("TYPE I\r\n");
      await readReply(secure);
      if (data.path && data.path !== "/") {
        secure.write(`CWD ${data.path}\r\n`);
        const cwd = await readReply(secure);
        if (!cwd.includes("250")) throw new Error("Could not open the remote directory.");
      }
      const made = new Set<string>();
      for (const file of data.files) {
        const parts = file.name.split("/").slice(0, -1);
        let dir = "";
        for (const part of parts) {
          dir = dir ? `${dir}/${part}` : part;
          if (made.has(dir)) continue;
          secure.write(`MKD ${dir}\r\n`);
          await readReply(secure);
          made.add(dir);
        }
        await storeOne(data.host, secure, file.name, Buffer.from(file.base64, "base64"));
      }
      secure.write("QUIT\r\n");
      secure.end();
      return { ok: true as const, files: data.files.length };
    } catch (error) {
      try {
        secure?.destroy();
        plain?.destroy();
      } catch {
        /* already closed */
      }
      return { ok: false as const, error: safe(error) };
    }
  });

function storeOne(host: string, control: tls.TLSSocket, name: string, bytes: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    void (async () => {
      let raw: net.Socket | null = null;
      try {
        control.write("PASV\r\n");
        const pasv = await readReply(control);
        const endpoint = parsePasv(pasv, host);
        if (!endpoint) throw new Error("The server did not open a passive port.");
        raw = net.connect({ host: endpoint.host, port: endpoint.port, timeout: 8000 });
        armSocket(raw, 8000, `Upload timed out for ${name}.`);
        await new Promise<void>((ok, fail) => {
          raw!.once("connect", () => ok());
          raw!.once("error", fail);
        });
        const data = tls.connect({ socket: raw, ...tlsOptions(host, control.getSession() || undefined) });
        const timer = setTimeout(() => {
          data.destroy();
          reject(new Error(`Upload timed out for ${name}.`));
        }, 20000);
        let buf = "";
        const onControl = (chunk: Buffer) => {
          buf += chunk.toString("utf8");
          if (/^550 /m.test(buf) || /\n550 /.test(buf)) {
            clearTimeout(timer);
            control.off("data", onControl);
            data.destroy();
            reject(new Error(`The server refused ${name}.`));
            return;
          }
          if (/^226 /m.test(buf) || /\n226 /.test(buf)) {
            clearTimeout(timer);
            control.off("data", onControl);
            data.end();
            resolve();
          }
        };
        control.on("data", onControl);
        data.once("error", (error) => {
          clearTimeout(timer);
          control.off("data", onControl);
          reject(error instanceof Error ? error : new Error("Data channel failed."));
        });
        control.write(`STOR ${name}\r\n`);
        data.once("secureConnect", () => data.end(bytes));
      } catch (error) {
        raw?.destroy();
        reject(error instanceof Error ? error : new Error("Upload failed."));
      }
    })();
  });
}

function listProtected(host: string, port: number, control: tls.TLSSocket, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const raw = net.connect({ host, port, timeout: 8000 });
    armSocket(raw, 8000, "The data connection did not open. Passive FTP ports may be blocked.");
    let body = "";
    let controlBuf = "";
    let settled = false;
    let data: tls.TLSSocket | null = null;
    const timer = setTimeout(() => finish(new Error("Listing the remote directory timed out.")), 10000);
    const finish = (error?: Error, value?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      control.off("data", onControl);
      data?.destroy();
      raw.destroy();
      if (error) reject(error);
      else resolve(value ?? body);
    };
    const onControl = (chunk: Buffer) => {
      controlBuf += chunk.toString("utf8");
      if (/^550 /m.test(controlBuf) || /\n550 /.test(controlBuf)) {
        finish(new Error("The server refused to list that directory."));
        return;
      }
      if (/^226 /m.test(controlBuf) || /\n226 /.test(controlBuf)) finish(undefined, body);
    };
    control.on("data", onControl);
    raw.once("error", (error) => finish(error instanceof Error ? error : new Error("Data channel failed.")));
    raw.once("connect", () => {
      const target = path.trim();
      control.write(!target || target === "/" ? "LIST\r\n" : `LIST ${target}\r\n`);
      data = tls.connect({ socket: raw, ...tlsOptions(host, control.getSession() || undefined) });
      data.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      data.once("end", () => {
        if (/226 |150 |125 /.test(controlBuf) || body.length) finish(undefined, body);
      });
      data.once("error", (error) => finish(error instanceof Error ? error : new Error("Data channel failed.")));
    });
  });
}

// ---------------------------------------------------------------------------
// Rule 6 — API deploy adapters (Cloudflare Pages, Vercel, GitHub Pages)
// All hosts are hardcoded https origins: no user-supplied host can be reached.
// ---------------------------------------------------------------------------

export type DeployFile = { name: string; base64: string };

const DEPLOY_HOSTS = {
  cloudflare: "https://api.cloudflare.com",
  vercel: "https://api.vercel.com",
  github: "https://api.github.com",
} as const;

export { DEPLOY_HOSTS };

/** Shared payload validation for every adapter. */
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
    if (!name || name.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(name)) return { files: [], error: `Unsafe file name in the deploy payload: ${name || "(empty)"}` };
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

function adapterError(error: unknown): AdapterResult {
  return { ok: false, error: safe(error) };
}

/**
 * The three adapters now run on the Rust API.
 *
 * They only ever existed to reach a provider from the page's origin; the token
 * still travels with each request as a Connections setting and is never stored
 * server-side. Payload validation (unsafe names, base64, the 32 MiB cap) is
 * repeated in `deploy.rs` so a bad payload is refused before any upload.
 */
type DeployPayloadFile = { name: string; base64: string };

export async function deployCloudflarePages(input: {
  data: { accountId?: string; token?: string; projectName?: string; files?: DeployPayloadFile[] };
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
  data: { token?: string; projectName?: string; files?: DeployPayloadFile[] };
}): Promise<AdapterResult> {
  const res = await post<AdapterResult>("/api/v1/deploy/vercel", {
    token: input?.data?.token ?? "",
    project_name: input?.data?.projectName ?? "",
    files: input?.data?.files ?? [],
  });
  return res.ok ? res.data : { ok: false, error: res.error };
}

export async function deployGithubPages(input: {
  data: { token?: string; repo?: string; branch?: string; files?: DeployPayloadFile[] };
}): Promise<AdapterResult> {
  const res = await post<AdapterResult>("/api/v1/deploy/github", {
    token: input?.data?.token ?? "",
    repo: input?.data?.repo ?? "",
    branch: input?.data?.branch ?? "gh-pages",
    files: input?.data?.files ?? [],
  });
  return res.ok ? res.data : { ok: false, error: res.error };
}
