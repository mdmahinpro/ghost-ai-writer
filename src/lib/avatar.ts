/**
 * Author portraits — client-safe helpers.
 *
 * The stored `avatarUrl` stays a tiny external URL string (zero disk). The UI
 * renders it with `referrerPolicy="no-referrer"` and falls back, in order, to
 * the in-memory server proxy (`/__grok/avatar`) and then to a deterministic
 * inline SVG portrait, so a portrait always renders even when the upstream AI
 * portrait host is blocked (ORB/CORP/referrer) or offline.
 */

export const AVATAR_PROXY_PATH = "/__grok/avatar";

/**
 * Direct, dynamic portrait source. `thispersondoesnotexist.com/image` returns a
 * brand-new face on every request, so the byline portrait changes over time and
 * is never a stored face. The token in `?seed=` only identifies the author in
 * JSON-LD and the author archive; the host itself produces the image.
 */
export const AVATAR_HOST = "https://thispersondoesnotexist.com";
export const AVATAR_UPSTREAM = `${AVATAR_HOST}/image`;

/** On-the-fly resize CDN used by the in-app proxy so the studio UI loads a small WebP. */
export const AVATAR_CDN = "https://wsrv.nl/";
/** Output edge in px (2× a 96 px byline avatar for crisp retina rendering). */
export const AVATAR_SIZE = 192;
export const AVATAR_QUALITY = 72;

/**
 * The URL stored on an author and hot-linked by generated pages: a short external
 * URL string only (zero disk), so a 10,000-article static build adds ~60 bytes
 * per author, never an image file. Because the host renders a fresh face per
 * request, the static build stays tiny while the portrait keeps changing.
 */
export function avatarSourceUrl(token: string): string {
  return `${AVATAR_UPSTREAM}?seed=${encodeURIComponent(token)}`;
}

/**
 * Resized, zero-disk portrait URL for the in-app proxy. The proxy fetches this
 * small square WebP crop of the same dynamic source so the studio UI stays fast.
 */
export function avatarCdnUrl(token: string, size = AVATAR_SIZE, quality = AVATAR_QUALITY): string {
  const upstream = avatarSourceUrl(token);
  return `${AVATAR_CDN}?url=${encodeURIComponent(upstream)}&w=${size}&h=${size}&fit=cover&output=webp&q=${quality}`;
}

/** True for a portrait URL this app manages (upstream host or the CDN form). */
export function isOurAvatarUrl(url?: string): boolean {
  return Boolean(url && /^https:\/\/(?:wsrv\.nl\/|images\.weserv\.nl\/|thispersondoesnotexist\.com\/)/i.test(url));
}

/**
 * Pull the per-author token out of a portrait URL. Handles both the direct
 * `?seed=` form and the CDN form, where the token lives inside the encoded
 * `url=` parameter as `?r=`.
 */
export function avatarSeed(avatarUrl?: string): string | null {
  if (!avatarUrl) return null;
  const ok = (value: string | null): string | null => (value && /^[a-z0-9]{1,40}$/i.test(value) ? value : null);
  try {
    const url = new URL(avatarUrl);
    const direct = ok(url.searchParams.get("seed"));
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
