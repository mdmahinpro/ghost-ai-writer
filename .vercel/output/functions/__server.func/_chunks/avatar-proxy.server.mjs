var AVATAR_UPSTREAM = `https://thispersondoesnotexist.com/image`;
/** On-the-fly resize CDN used by the in-app proxy so the studio UI loads a small WebP. */
var AVATAR_CDN = "https://wsrv.nl/";
/**
* The URL stored on an author and hot-linked by generated pages: a short external
* URL string only (zero disk), so a 10,000-article static build adds ~60 bytes
* per author, never an image file. Because the host renders a fresh face per
* request, the static build stays tiny while the portrait keeps changing.
*/
function avatarSourceUrl(token) {
	return `${AVATAR_UPSTREAM}?seed=${encodeURIComponent(token)}`;
}
/**
* Resized, zero-disk portrait URL for the in-app proxy. The proxy fetches this
* small square WebP crop of the same dynamic source so the studio UI stays fast.
*/
function avatarCdnUrl(token, size = 192, quality = 72) {
	const upstream = avatarSourceUrl(token);
	return `${AVATAR_CDN}?url=${encodeURIComponent(upstream)}&w=${size}&h=${size}&fit=cover&output=webp&q=${quality}`;
}
function hash(input) {
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
function portraitSvg(seed, name = "", size = 256) {
	const h = hash(`${seed}:${name}`);
	const hue = h % 360;
	const hue2 = (hue + 28 + (h >> 5) % 40) % 360;
	const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0].toUpperCase()).join("").slice(0, 2) || "GA";
	const headY = Math.round(size * .38);
	const headR = Math.round(size * .17);
	const shoulderW = Math.round(size * .34);
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
		`<path d="M${Math.round(size / 2 - shoulderW)} ${size} q${shoulderW} -${Math.round(size * .34)} ${shoulderW * 2} 0 z"/>`,
		`</g>`,
		`<text x="50%" y="${Math.round(size * .56)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(size * .16)}" font-weight="600" fill="hsl(${hue} 30% 16%)" opacity="0.75">${initials}</text>`,
		`</svg>`
	].join("");
}
//#endregion
//#region src/lib/avatar-proxy.server.ts
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
/** In-memory LRU-ish cache. Bounded so a long-lived server cannot grow without limit. */
var CACHE = /* @__PURE__ */ new Map();
var CACHE_MAX = 256;
function remember(seed, entry) {
	if (CACHE.size >= CACHE_MAX) {
		const oldest = CACHE.keys().next().value;
		if (oldest !== void 0) CACHE.delete(oldest);
	}
	CACHE.set(seed, entry);
}
function svgEntry(seed, name, size, reason) {
	return {
		bytes: new TextEncoder().encode(portraitSvg(seed, name, size)),
		contentType: "image/svg+xml; charset=utf-8",
		etag: `"avatar-${seed}-${size}-fallback-${reason.length}"`,
		source: "fallback",
		at: Date.now()
	};
}
async function fetchPortrait(seed, size) {
	const upstream = avatarCdnUrl(seed, size);
	const response = await fetch(upstream, {
		redirect: "follow",
		signal: AbortSignal.timeout(8e3),
		headers: {
			Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
			"User-Agent": "GhostAIWriter/1.0 (operator studio; author portraits)"
		}
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const type = response.headers.get("content-type") ?? "image/jpeg";
	if (!type.startsWith("image/")) throw new Error(`Unexpected content type ${type}`);
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.byteLength < 256) throw new Error("Truncated portrait stream");
	return {
		bytes,
		contentType: type,
		etag: `"avatar-${seed}-${size}-${bytes.byteLength}-${Math.round(Date.now() / 864e5)}"`,
		source: "live",
		at: Date.now()
	};
}
/** Resolve one portrait, preferring the in-memory cache and the live host. */
async function avatarBytes(seed, size, name = "") {
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
async function handleAvatarRequest(request) {
	const url = new URL(request.url);
	const rawSeed = (url.searchParams.get("seed") ?? "").trim();
	const seed = /^[a-z0-9]{1,40}$/i.test(rawSeed) ? rawSeed : null;
	const size = Math.min(512, Math.max(48, Math.round(Number(url.searchParams.get("size")) || 256)));
	if (!seed) return new Response("Bad seed", {
		status: 400,
		headers: { "cache-control": "no-store" }
	});
	const entry = await avatarBytes(seed, size, (url.searchParams.get("n") ?? "").replace(/[^\w\s.-]/g, "").slice(0, 60));
	const etag = entry.etag;
	if (request.headers.get("if-none-match") === etag) return new Response(null, {
		status: 304,
		headers: {
			etag,
			"cache-control": "public, max-age=86400"
		}
	});
	return new Response(entry.bytes.slice().buffer, {
		status: 200,
		headers: {
			"content-type": entry.contentType,
			"cache-control": "public, max-age=86400",
			etag,
			"x-avatar-source": entry.source
		}
	});
}
//#endregion
export { handleAvatarRequest };
