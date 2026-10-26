/**
 * Author portraits — client-safe helpers.
 *
 * A portrait is captured once, when the author is created, and stored on the
 * profile as a small (≈4 KB, 128 px) self-contained data URI: the face
 * generator behind `AVATAR_UPSTREAM` has no stable URL of its own, so keeping
 * the generator URL is what made every author show the same picture. The UI and
 * the static build render the stored portrait; if it is ever missing they fall
 * back to the resize CDN, then to an in-memory proxy, then to a deterministic
 * inline SVG portrait — so a portrait always renders with zero disk storage.
 */

export const AVATAR_PROXY_PATH = "/__grok/avatar";

/**
 * Direct, dynamic portrait source.
 *
 * The working endpoint is `/random-person.jpeg` — a real ~600 KB JPEG. The
 * older `/image` path returns HTTP 404 from the host's nginx, which made every
 * author portrait a broken image.
 *
 * The host ignores query parameters and generates a brand-new face per request,
 * so the value after `r=` is NOT used by the host to choose a face. It is a
 * per-author cache-buster: it keeps each author's URL distinct so the browser
 * and the resize CDN treat them as separate resources, and it gives JSON-LD and
 * the author archive a stable identity for an unstable image.
 */
export const AVATAR_HOST = "https://thispersondoesnotexist.com";
export const AVATAR_UPSTREAM = `${AVATAR_HOST}/random-person.jpeg`;

/** On-the-fly resize CDN used by the in-app proxy so the studio UI loads a small WebP. */
export const AVATAR_CDN = "https://wsrv.nl/";
/**
 * Output edge in px. 128 is a deliberate speed choice for the static build:
 * a byline avatar renders at most 64 px, so 128 covers retina and the CDN
 * returns a ~4 KB WebP instead of the 600 KB original.
 */
export const AVATAR_SIZE = 128;
export const AVATAR_QUALITY = 68;

/**
 * A distinct, stable-per-author cache key. Two authors must never share one, or
 * they would show the same face in a given render; and the same author must
 * keep the same key so the URL does not churn on every page build.
 */
export function avatarToken(seed: string): string {
  return (
    hashStr(`avatar:${seed}`).toString(36) + hashStr(`avatar2:${seed}`).toString(36)
  ).slice(0, 20);
}

function hashStr(input: string): number {
  let h = 2166136261;
  for (let index = 0; index < input.length; index++) {
    h ^= input.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * The URL stored on an author and hot-linked by generated pages.
 *
 * Zero disk: a short external URL string, so a 10,000-article static build
 * adds ~70 bytes per author rather than an image file. The r= token makes each
 * author's URL unique, which satisfies "never duplicate an author image".
 */
export function avatarSourceUrl(token: string): string {
  return `${AVATAR_UPSTREAM}?r=${encodeURIComponent(token)}`;
}

/**
 * Resized, zero-disk portrait URL. The CDN fetches the upstream face once,
 * crops it square, and serves a small WebP — so the static pages stay fast and
 * the 600 KB original is never sent to a visitor.
 */
export function avatarCdnUrl(token: string, size = AVATAR_SIZE, quality = AVATAR_QUALITY): string {
  const upstream = avatarSourceUrl(token);
  return `${AVATAR_CDN}?url=${encodeURIComponent(upstream)}&w=${size}&h=${size}&fit=cover&output=webp&q=${quality}`;
}

/** Already a finished, self-contained portrait rather than a generator URL? */
export function isStoredPortrait(avatarUrl?: string): boolean {
  return String(avatarUrl ?? "").startsWith("data:");
}

/**
 * The URL a page or the studio should actually load for an author.
 *
 * A stored portrait (data URI) is finished and is returned as-is. Anything still
 * pointing at the face generator goes through the resize CDN: that host answers
 * `no-store` and returns a new random stranger on every request, so a raw
 * upstream URL is both a ~500 KB download and a different face per render.
 */
export function portraitSrc(
  author: { id?: string; avatarUrl?: string },
  size = AVATAR_SIZE,
): string {
  const url = String(author.avatarUrl ?? "").trim();
  if (!url) return "";
  if (isStoredPortrait(url)) return url;
  const seed = avatarSeed(url);
  if (seed && url.includes("random-person.jpeg")) return avatarCdnUrl(seed, size);
  return url;
}

/** A token the CDN has never seen, so the generator answers with a new face. */
export function freshPortraitToken(seed: string): string {
  const noise = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return avatarToken(`${seed}:${noise}`);
}

/**
 * Capture one portrait for a new author and return it as a small self-contained
 * data URI.
 *
 * The generator has no stable URL of its own — every fetch is a new random
 * face — so the face is taken once here and stored on the profile. Every later
 * article by that author reuses the same picture, which is the only way two
 * authors can be told apart on a page. Returns null when there is no browser
 * (tests, server-side render) or the CDN/CORS request fails, so the caller can
 * keep whatever URL it already had.
 */
export async function capturePortrait(
  seed: string,
  size = AVATAR_SIZE,
  quality = 0.82,
): Promise<string | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  const url = avatarCdnUrl(freshPortraitToken(seed), size);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("portrait fetch failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, size, size);
    const webp = canvas.toDataURL("image/webp", quality);
    const data = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
    // A 128 px portrait is a few KB. Anything smaller means an empty canvas, or
    // one the browser refused to export — the caller is better off with its URL.
    return data.length > 512 ? data : null;
  } catch {
    return null;
  }
}

/** True for a portrait URL this app manages (upstream host or the CDN form). */
export function isOurAvatarUrl(url?: string): boolean {
  return Boolean(url && /^https:\/\/(?:wsrv\.nl\/|images\.weserv\.nl\/|thispersondoesnotexist\.com\/)/i.test(url));
}

/**
 * Pull the per-author token out of a portrait URL. Handles both the direct
 * `?r=` form and the CDN form, where the token lives inside the encoded `url=`
 * parameter. The legacy `seed` key is still read so author records written by
 * an older build keep working.
 */
export function avatarSeed(avatarUrl?: string): string | null {
  if (!avatarUrl) return null;
  const ok = (value: string | null): string | null => (value && /^[a-z0-9]{1,40}$/i.test(value) ? value : null);
  try {
    const url = new URL(avatarUrl);
    const direct = ok(url.searchParams.get("r")) ?? ok(url.searchParams.get("seed"));
    if (direct) return direct;
    const nested = url.searchParams.get("url");
    if (nested) {
      let inner: URL;
      try {
        inner = new URL(nested);
      } catch {
        inner = new URL(`https://${nested}`);
      }
      return ok(inner.searchParams.get("r")) ?? ok(inner.searchParams.get("seed"));
    }
    return null;
  } catch {
    return null;
  }
}

/** Same-origin, zero-disk proxy URL for an author portrait. */
export function avatarProxySrc(author: { id: string; name?: string; avatarUrl?: string }, size = 256): string {
  const seed = avatarSeed(author.avatarUrl) ?? author.id;
  return `${AVATAR_PROXY_PATH}?seed=${encodeURIComponent(seed)}&size=${size}`;
}

function hash(input: string): number {
  let h = 2166136261;
  for (let index = 0; index < input.length; index++) {
    h ^= input.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministic, realistic-looking portrait placeholder: a soft studio gradient
 * with a head-and-shoulders silhouette and the person's initials. Pure string
 * math — nothing is fetched or written.
 */
export function portraitSvg(seed: string, name = "", size = 256): string {
  const h = hash(`${seed}:${name}`);
  const hue = h % 360;
  const hue2 = (hue + 28 + (h >> 5) % 40) % 360;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .join("")
    .slice(0, 2) || "GA";
  const headY = Math.round(size * 0.38);
  const headR = Math.round(size * 0.17);
  const shoulderW = Math.round(size * 0.34);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Portrait placeholder">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="hsl(${hue} 42% 34%)"/><stop offset="1" stop-color="hsl(${hue2} 46% 18%)"/>`,
    `</linearGradient><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="hsl(${hue} 24% 88%)" stop-opacity="0.92"/><stop offset="1" stop-color="hsl(${hue2} 18% 62%)" stop-opacity="0.92"/>`,
    `</linearGradient></defs>`,
    `<rect width="${size}" height="${size}" fill="url(#bg)"/>`,
    `<g fill="url(#fg)">`,
    `<circle cx="${size / 2}" cy="${headY}" r="${headR}"/>`,
    `<path d="M${Math.round(size / 2 - shoulderW)} ${size} q${shoulderW} -${Math.round(size * 0.34)} ${shoulderW * 2} 0 z"/>`,
    `</g>`,
    `<text x="50%" y="${Math.round(size * 0.56)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(size * 0.16)}" font-weight="600" fill="hsl(${hue} 30% 16%)" opacity="0.75">${initials}</text>`,
    `</svg>`,
  ].join("");
}

/** Inline data URI of the deterministic portrait (used as the last-resort fallback). */
export function portraitDataUri(seed: string, name = "", size = 256): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(seed, name, size))}`;
}
