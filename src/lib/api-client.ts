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
 * The admin bearer token — injected by the build or set at runtime.
 *
 * For deployed apps: set `VITE_GAW_ADMIN_TOKEN` at build time (it becomes
 * baked into the JS bundle — acceptable for an admin-only tool).
 *
 * For dev: paste the Render-generated token into a `.env` file:
 *   VITE_GAW_ADMIN_TOKEN=rw_...
 */
const ADMIN_TOKEN: string | undefined =
  typeof import.meta !== "undefined"
    ? (import.meta as { env?: Record<string, string> }).env?.VITE_GAW_ADMIN_TOKEN
    : undefined;

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
  if (ADMIN_TOKEN) {
    h["Authorization"] = `Bearer ${ADMIN_TOKEN}`;
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