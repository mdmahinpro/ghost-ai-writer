/**
 * API client for gaw-api (Rust backend).
 *
 * All server-side operations that used to run through TanStack Start's
 * `createServerFn` now go through this thin fetch wrapper to gaw-api.
 *
 * In dev: the Vite dev server serves the SPA but the API lives on its own port.
 * In prod: the SPA is served alongside the API (or via the same Render service).
 *
 * Admin auth: `GAW_ADMIN_TOKEN` is sent as a Bearer token in the Authorization
 * header. The Rust `require_token` middleware compares it to the server-side
 * `GAW_ADMIN_TOKEN` env var. When that var is unset (fully public sandbox),
 * every request passes.
 */

const API_BASE =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_GAW_API) ||
  "https://gaw-api.onrender.com";

/**
 * Absolute URL for an API-served path.
 *
 * Placed images come back as `/media/<hash>.jpg` because the API serves them;
 * the page lives on another origin, so previews and exported HTML need the host.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * The admin bearer token — held for this browser session only.
 *
 * It is deliberately NOT read from `import.meta.env`: a `VITE_*` value is
 * inlined into the JS bundle at build time, so "setting it in .env when
 * hosting" publishes the credential to anyone who can load the page. The token
 * is pasted into the UI instead, kept in `sessionStorage`, and cleared when the
 * tab closes.
 */
const TOKEN_KEY = "gaw_admin_token";

/** `undefined` = not read yet; distinguishes "no token" from "not loaded". */
let tokenCache: string | undefined;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Private mode / blocked storage: stay in memory for this page view.
    return null;
  }
}

/** The token in use right now, or "" when none has been entered. */
export function getAdminToken(): string {
  if (tokenCache !== undefined) return tokenCache;
  const store = storage();
  tokenCache = store?.getItem(TOKEN_KEY) ?? "";
  return tokenCache;
}

/** Save (or, with an empty string, forget) the token for this session. */
export function setAdminToken(value: string): void {
  const token = value.trim();
  tokenCache = token;
  const store = storage();
  try {
    if (token) store?.setItem(TOKEN_KEY, token);
    else store?.removeItem(TOKEN_KEY);
  } catch {
    // Memory copy is still authoritative for this page view.
  }
  tokenRejected = false;
  notifyTokenState();
}

export function hasAdminToken(): boolean {
  return getAdminToken().length > 0;
}

/**
 * True when the backend refused the token we hold.
 *
 * The gate distinguishes this from "no token yet" so a mistyped token reads as
 * "that was rejected" instead of silently doing nothing.
 */
let tokenRejected = false;

export function isTokenRejected(): boolean {
  return tokenRejected;
}

/**
 * Fired when the API answers 401, so the UI can ask for a token instead of
 * showing an empty app. A wrong token looks exactly like no token from here.
 */
type TokenListener = () => void;
const tokenListeners = new Set<TokenListener>();

export function onTokenStateChange(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

function notifyTokenState(): void {
  for (const listener of tokenListeners) listener();
}

/** Standard timeout for every API call (seconds). */
const TIMEOUT_S = 30;

/** The Rust backend returns errors shaped like this. */
export type ApiErrorBody = { error?: string };

/** A successful Rust API call. */
export type ApiResult<T = unknown> = {
  ok: true;
  data: T;
};

/** A failed Rust API call. */
export type ApiFailure = {
  ok: false;
  status: number;
  error: string;
};

/**
 * Every API call returns one of these, discriminated on `ok`.
 *
 * Callers should do:
 *   const res = await get("/api/v1/worker");
 *   if (!res.ok) throw new Error(res.error);
 *   // res.data is typed
 */
export type ApiResponse<T = unknown> = ApiResult<T> | ApiFailure;

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAdminToken();
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }
  return h;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_S * 1000);

  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      method,
      headers: authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: "manual",
    });

    const text = await resp.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        status: resp.status,
        error: `non-JSON response (HTTP ${resp.status}): ${text.slice(0, 200)}`,
      };
    }

    if (!resp.ok) {
      if (resp.status === 401) {
        // The stored token is missing or no longer valid; let the UI ask again.
        tokenRejected = getAdminToken().length > 0;
        notifyTokenState();
      }
      // The API reports failures as {"error": {"code", "message"}}; older paths
      // used a bare string. Render the message either way — a raw object here
      // reaches the UI as "[object Object]".
      const failed = json as { error?: string | { code?: string; message?: string } } | null;
      const err =
        typeof failed?.error === "string"
          ? failed.error
          : failed?.error?.message || `HTTP ${resp.status}`;
      return { ok: false, status: resp.status, error: err };
    }

    return { ok: true, data: json as T };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, status: 0, error: "Request timed out" };
    }
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "Network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Type-safe helpers ----

export function get<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>("GET", path);
}

export function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>("POST", path, body);
}

export function del<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>("DELETE", path);
}