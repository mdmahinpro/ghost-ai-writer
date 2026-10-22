/**
 * Author-portrait proxy — server side, zero disk.
 *
 * Fetches the CDN-resized portrait (small WebP) into memory, caches it per seed
 * with an ETag (so browsers/CDNs revalidate cheaply), and answers with a
 * deterministic inline-SVG portrait when the upstream host is unreachable.
 * Nothing is ever written to the filesystem.
 *
 * Used by:
 *  - the Vite dev middleware (vite.config.ts) for `npm run dev`
 *  - `server/middleware/avatar-proxy.ts` (Nitro) for the deployed build
 */
import { avatarCdnUrl, portraitSvg } from "./avatar.ts";

export const AVATAR_PATH = "/__grok/avatar";

type CachedPortrait = {
  bytes: Uint8Array;
  contentType: string;
  etag: string;
  source: "live" | "fallback";
  at: number;
};

/** In-memory LRU-ish cache. Bounded so a long-lived server cannot grow without limit. */
const CACHE = new Map<string, CachedPortrait>();
const CACHE_MAX = 256;

function remember(seed: string, entry: CachedPortrait): void {
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest !== undefined) CACHE.delete(oldest);
  }
  CACHE.set(seed, entry);
}

function svgEntry(seed: string, name: string, size: number, reason: string): CachedPortrait {
  const bytes = new TextEncoder().encode(portraitSvg(seed, name, size));
  return {
    bytes,
    contentType: "image/svg+xml; charset=utf-8",
    etag: `"avatar-${seed}-${size}-fallback-${reason.length}"`,
    source: "fallback",
    at: Date.now(),
  };
}

async function fetchPortrait(seed: string, size: number): Promise<CachedPortrait> {
  // Fetch the already-resized portrait from the image CDN (small WebP cropped to
  // `size`), never the ~550 KB upstream JPEG. Nothing touches disk.
  const upstream = avatarCdnUrl(seed, size);
  const response = await fetch(upstream, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
      "User-Agent": "GhostAIWriter/1.0 (operator studio; author portraits)",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) throw new Error(`Unexpected content type ${type}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 256) throw new Error("Truncated portrait stream");
  return {
    bytes,
    contentType: type,
    etag: `"avatar-${seed}-${size}-${bytes.byteLength}-${Math.round(Date.now() / 86_400_000)}"`,
    source: "live",
    at: Date.now(),
  };
}

/** Resolve one portrait, preferring the in-memory cache and the live host. */
export async function avatarBytes(seed: string, size: number, name = ""): Promise<CachedPortrait> {
  const key = `${seed}:${size}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  try {
    const live = await fetchPortrait(seed, size);
    remember(key, live);
    return live;
  } catch (error) {
    const fallback = svgEntry(seed, name, size, error instanceof Error ? error.message : "offline");
    remember(key, fallback);
    return fallback;
  }
}

/** HTTP handler shared by the dev middleware and the Nitro middleware. */
export async function handleAvatarRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawSeed = (url.searchParams.get("seed") ?? "").trim();
  const seed = /^[a-z0-9]{1,40}$/i.test(rawSeed) ? rawSeed : null;
  const size = Math.min(512, Math.max(48, Math.round(Number(url.searchParams.get("size")) || 256)));
  if (!seed) return new Response("Bad seed", { status: 400, headers: { "cache-control": "no-store" } });

  const name = (url.searchParams.get("n") ?? "").replace(/[^\w\s.-]/g, "").slice(0, 60);
  const entry = await avatarBytes(seed, size, name);
  const etag = entry.etag;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, "cache-control": "public, max-age=86400" } });
  }
  return new Response(entry.bytes.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "content-type": entry.contentType,
      "cache-control": "public, max-age=86400",
      etag,
      "x-avatar-source": entry.source,
    },
  });
}
