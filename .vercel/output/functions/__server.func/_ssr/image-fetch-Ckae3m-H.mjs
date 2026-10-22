import { E as bingThumbUrl, Q as isPrivateHost } from "./engine-DWsB6FrJ.mjs";
import { createHash } from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/image-fetch-Ckae3m-H.js
var MEDIA_DIRS = [path.join(process.cwd(), "public", "media"), path.join(process.cwd(), "data", "media")];
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
function safeName(name) {
	if (!/^[a-f0-9]{16,64}\.(jpg|png|webp)$/i.test(name)) return null;
	return name.toLowerCase();
}
async function lookupPublic(hostname) {
	if (isPrivateHost(hostname)) return false;
	const dns = await import("node:dns/promises");
	try {
		const records = await dns.lookup(hostname, { all: true });
		return records.length > 0 && records.every((record) => !isPrivateHost(record.address));
	} catch {
		return false;
	}
}
function sizeOf(buf) {
	if (buf.length > 24 && buf[0] === 137 && buf[1] === 80) return {
		width: buf.readUInt32BE(16),
		height: buf.readUInt32BE(20)
	};
	if (buf.length > 4 && buf[0] === 255 && buf[1] === 216) {
		let offset = 2;
		while (offset + 9 < buf.length) {
			if (buf[offset] !== 255) break;
			const marker = buf[offset + 1];
			const len = buf.readUInt16BE(offset + 2);
			if (marker === 192 || marker === 193 || marker === 194) return {
				width: buf.readUInt16BE(offset + 7),
				height: buf.readUInt16BE(offset + 5)
			};
			if (len < 2) break;
			offset += 2 + len;
		}
	}
	if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
		if (buf.toString("ascii", 12, 16) === "VP8X" && buf.length >= 30) return {
			width: 1 + buf.readUIntLE(24, 3),
			height: 1 + buf.readUIntLE(27, 3)
		};
		if (buf.toString("ascii", 12, 16) === "VP8 " && buf.length >= 30) return {
			width: buf.readUInt16LE(26) & 16383,
			height: buf.readUInt16LE(28) & 16383
		};
	}
	return null;
}
var SKIP_URL = /vector|logo|icon|badge|emoji|clipart|illustration|cartoon|watermark/i;
var QUERY_STOP = /* @__PURE__ */ new Set([
	"photo",
	"photograph",
	"image",
	"picture",
	"with",
	"from",
	"that",
	"this",
	"about",
	"into"
]);
function queryWords(query) {
	return query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !QUERY_STOP.has(word));
}
function relevance(query, haystack) {
	const words = queryWords(query);
	if (!words.length) return .5;
	const hay = haystack.toLowerCase();
	return words.filter((word) => hay.includes(word)).length / words.length;
}
async function bingCandidates(query) {
	const q = encodeURIComponent(query.slice(0, 120));
	const url = `https://www.bing.com/images/async?q=${q}&first=0&count=12&qft=+filterui:photo-photo+filterui:imagesize-large&adlt=strict`;
	const response = await fetch(url, {
		headers: {
			"User-Agent": UA,
			Accept: "text/html",
			"Accept-Language": "en-US,en;q=0.9",
			Referer: `https://www.bing.com/images/search?q=${q}`
		},
		signal: AbortSignal.timeout(8e3),
		redirect: "manual"
	});
	if (!response.ok) return [];
	const raw = await response.text();
	const amp = String.fromCharCode(38);
	const html = raw.split(`${amp}quot;`).join("\"").split(`${amp}amp;`).join(amp);
	const ranked = [];
	const re = /"purl":"(https:[^"]+)"[\s\S]{0,220}?"murl":"(https:[^"]+)"/g;
	let match;
	while (match = re.exec(html)) {
		const page = match[1] ?? "";
		const remote = match[2] ?? "";
		if (!remote || SKIP_URL.test(remote) || SKIP_URL.test(page)) continue;
		if (/map|chart|diagram|infographic|timezone|logo/i.test(`${remote} ${page}`)) continue;
		const nearby = html.slice(match.index, match.index + 700);
		const score = relevance(query, `${page} ${remote} ${/"t":"([^"]*)"/.exec(nearby)?.[1] ?? ""}`);
		if (score <= 0) continue;
		if (!ranked.some((item) => item.remote === remote)) ranked.push({
			remote,
			score
		});
	}
	ranked.sort((a, b) => b.score - a.score);
	return ranked.slice(0, 6).map((item) => item.remote);
}
async function openverseCandidates(query) {
	const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(queryWords(query).slice(0, 6).join(" ") || query.slice(0, 80))}&page_size=8`;
	const response = await fetch(url, {
		headers: {
			"User-Agent": "GhostAIWriter/1.0 (operator panel; image placement)",
			Accept: "application/json"
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!response.ok) return [];
	const body = await response.json();
	const urls = [];
	for (const row of body.results ?? []) {
		if (!row.url?.startsWith("https://")) continue;
		if ((row.width ?? 0) && (row.width ?? 0) < 600) continue;
		if ((row.height ?? 0) && (row.height ?? 0) < 300) continue;
		if (SKIP_URL.test(row.url) || SKIP_URL.test(row.title ?? "")) continue;
		urls.push(row.url);
	}
	return urls;
}
async function wikiCandidates(query) {
	const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query.slice(0, 120))}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1400&format=json`;
	const response = await fetch(url, {
		headers: {
			"User-Agent": "GhostAIWriter/1.0 (operator panel; image placement)",
			Accept: "application/json"
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!response.ok) return [];
	const body = await response.json();
	const urls = [];
	for (const page of Object.values(body.query?.pages ?? {})) {
		const info = page.imageinfo?.[0];
		const mime = info?.mime ?? "";
		if (!mime.startsWith("image/") || mime.includes("svg")) continue;
		const candidate = info?.thumburl || info?.url;
		if (candidate?.startsWith("https://")) urls.push(candidate);
	}
	return urls;
}
async function downloadCandidate(remote) {
	let parsed;
	try {
		parsed = new URL(remote);
	} catch {
		return null;
	}
	if (parsed.protocol !== "https:") return null;
	if (!await lookupPublic(parsed.hostname)) return null;
	const response = await fetch(parsed.href, {
		headers: {
			"User-Agent": UA,
			Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
		},
		signal: AbortSignal.timeout(7e3),
		redirect: "follow"
	});
	if (!response.ok) return null;
	let finalHost = parsed.hostname;
	try {
		finalHost = new URL(response.url).hostname;
	} catch {
		return null;
	}
	if (!await lookupPublic(finalHost)) return null;
	const mime = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
	if (!mime.startsWith("image/") || mime.includes("svg") || mime.includes("gif")) return null;
	const buf = Buffer.from(await response.arrayBuffer());
	if (buf.length < 8e3 || buf.length > 35e5) return null;
	return {
		buf,
		mime,
		finalUrl: response.url
	};
}
function extFor(mime) {
	if (mime.includes("png")) return "png";
	if (mime.includes("webp")) return "webp";
	return "jpg";
}
async function saveBytes(buf, ext) {
	const name = `${createHash("sha256").update(buf).digest("hex").slice(0, 24)}.${ext}`;
	await Promise.all(MEDIA_DIRS.map((dir) => mkdir(dir, { recursive: true })));
	await Promise.all(MEDIA_DIRS.map((dir) => writeFile(path.join(dir, name), buf)));
	return name;
}
function acceptable(width, height, bytes, strict) {
	if (strict) return width >= 600 && height >= 300;
	return width >= 480 && height >= 270 && bytes >= 12e3;
}
var TAKES = [
	"photograph",
	"close photograph",
	"wide photograph",
	"person at a desk",
	"library table",
	"window light",
	"open notebook",
	"evening indoor",
	"outdoor daylight",
	"hands writing",
	"over the shoulder",
	"detail of papers"
];
function digestOf(buf) {
	return createHash("sha256").update(buf).digest("hex").slice(0, 24);
}
async function placeBingThumb(slot, avoid, salt) {
	const width = slot.width || (slot.role === "featured" ? 474 : 624);
	const height = slot.height || (slot.role === "featured" ? 274 : 352);
	for (let attempt = 0; attempt < 8; attempt++) {
		const take = TAKES[(salt + attempt) % TAKES.length];
		const query = `${slot.query} ${take} ${salt + attempt}`.replace(/\s+/g, " ").trim();
		const remote = bingThumbUrl(query, width, height);
		const file = await downloadCandidate(remote);
		if (!file || file.buf.length < 4e3) continue;
		const digest = digestOf(file.buf);
		if (avoid.has(digest)) continue;
		avoid.add(digest);
		const dims = sizeOf(file.buf);
		const name = await saveBytes(file.buf, extFor(file.mime));
		return {
			query,
			alt: slot.alt,
			role: slot.role,
			http: 200,
			selected: true,
			src: `/media/${name}`,
			remote,
			width: dims?.width || width,
			height: dims?.height || height,
			bytes: file.buf.length,
			license: "unknown-bing",
			attempts: attempt + 1
		};
	}
	return null;
}
async function placeOne(slot, provider, avoid, salt) {
	if (provider !== "wikimedia") try {
		const thumb = await placeBingThumb(slot, avoid, salt);
		if (thumb) return thumb;
	} catch {}
	const queries = [
		slot.query,
		`${slot.query} photograph`,
		`${slot.alt} photograph`
	].filter((query, index, all) => query.trim().length > 2 && all.indexOf(query) === index);
	let attempts = 0;
	let lastHttp = 0;
	const preferWiki = provider === "wikimedia";
	for (const query of queries.slice(0, 2)) {
		const batches = [];
		try {
			if (preferWiki) {
				batches.push({
					urls: await wikiCandidates(query),
					source: "wikimedia"
				});
				batches.push({
					urls: await openverseCandidates(query),
					source: "openverse"
				});
			} else {
				const bing = await bingCandidates(query);
				batches.push({
					urls: bing,
					source: "bing"
				});
				if (!bing.length) batches.push({
					urls: await openverseCandidates(query),
					source: "openverse"
				});
			}
		} catch {
			batches.length = 0;
		}
		for (const batch of batches) for (const remote of batch.urls.slice(0, 4)) {
			attempts += 1;
			try {
				const file = await downloadCandidate(remote);
				if (!file) {
					lastHttp = 415;
					continue;
				}
				const dims = sizeOf(file.buf);
				const width = dims?.width ?? 0;
				const height = dims?.height ?? 0;
				const strict = attempts < 3;
				if (dims && !acceptable(width, height, file.buf.length, strict)) {
					lastHttp = 204;
					continue;
				}
				if (!dims && file.buf.length < 2e4) {
					lastHttp = 204;
					continue;
				}
				const digest = digestOf(file.buf);
				if (avoid.has(digest)) {
					lastHttp = 409;
					continue;
				}
				avoid.add(digest);
				const name = await saveBytes(file.buf, extFor(file.mime));
				const license = remote.includes("wikimedia.org") || remote.includes("wikipedia.org") ? "wikimedia" : batch.source === "openverse" ? "openverse" : "unknown-bing";
				return {
					query: slot.query,
					alt: slot.alt,
					role: slot.role,
					http: 200,
					selected: true,
					src: `/media/${name}`,
					remote: file.finalUrl,
					width: width || void 0,
					height: height || void 0,
					bytes: file.buf.length,
					license,
					attempts
				};
			} catch {
				lastHttp = 502;
			}
		}
	}
	return {
		query: slot.query,
		alt: slot.alt,
		role: slot.role,
		http: lastHttp || 404,
		selected: false,
		license: preferWiki ? "wikimedia" : "unknown-bing",
		attempts,
		error: "No photo passed the size check. Publish continues without this slot."
	};
}
async function placeImageSlots(slots, provider, avoidHashes = [], salt = 0) {
	const avoid = new Set(avoidHashes.filter(Boolean));
	const out = [];
	for (let index = 0; index < slots.slice(0, 4).length; index++) {
		const slot = slots[index];
		out.push(await placeOne(slot, provider, avoid, salt + index * 3));
	}
	return out;
}
async function readMediaFile(name, remote) {
	const safe = safeName(name);
	if (!safe) return null;
	for (const dir of MEDIA_DIRS) try {
		return {
			name: safe,
			bytes: await readFile(path.join(dir, safe)),
			mime: safe.endsWith(".png") ? "image/png" : safe.endsWith(".webp") ? "image/webp" : "image/jpeg"
		};
	} catch {}
	if (!remote) return null;
	const file = await downloadCandidate(remote);
	if (!file) return null;
	return {
		name: await saveBytes(file.buf, extFor(file.mime)),
		bytes: file.buf,
		mime: file.mime.startsWith("image/") ? file.mime : "image/jpeg"
	};
}
//#endregion
export { placeImageSlots, readMediaFile };
