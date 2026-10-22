import { i as __toESM } from "../_runtime.mjs";
import { At as staticMedia, Bt as validatePublicUrl, bt as relTime, f as adCodeWithinLimit, kt as slotConfigs, p as adsConfigHash, r as AD_SLOT_LABELS, t as AD_CODE_LIMIT } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as deployVercel, l as uploadFtps, n as deployCloudflarePages, o as readMediaBatch, r as deployGithubPages, s as submitIndexNow } from "./ops.functions-CQ9mdiWn.mjs";
import { h as useHydrated, m as useApp } from "./store-CO3BA3x3.mjs";
import { B as fieldClass, D as probePublicUrl, H as statusTone, I as Field, L as PageIntro, M as Badge, N as Button, P as Card, R as SkeletonRows, z as StateNote } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/static-delivery-BuU8cRGt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function crc32(buf) {
	let c = -1;
	for (let i = 0; i < buf.length; i++) {
		c ^= buf[i];
		for (let k = 0; k < 8; k++) c = c >>> 1 ^ 3988292384 & -(c & 1);
	}
	return ~c >>> 0;
}
function u16(n) {
	return Uint8Array.of(n & 255, n >>> 8 & 255);
}
function u32(n) {
	return Uint8Array.of(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255);
}
function concat(parts) {
	const size = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(size);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}
/**
* Raw DEFLATE (ZIP method 8) through the platform CompressionStream — no
* dependency, and a static-site build deflates to roughly a fifth of its size.
* Returns null when compression is unavailable or does not help, so the entry
* falls back to STORE (method 0).
*/
async function deflateRaw(data) {
	if (typeof CompressionStream !== "function") return null;
	try {
		const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
		const stream = new Blob([buffer]).stream().pipeThrough(new CompressionStream("deflate-raw"));
		const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
		return bytes.length < data.length ? bytes : null;
	} catch {
		return null;
	}
}
/** Builds a ZIP archive, DEFLATE-compressing every entry that gets smaller. */
async function zipStore(files) {
	const enc = new TextEncoder();
	const locals = [];
	const central = [];
	let offset = 0;
	for (const file of files) {
		const name = enc.encode(file.name);
		const data = file.data;
		const crc = crc32(data);
		const deflated = await deflateRaw(data);
		const method = deflated ? 8 : 0;
		const payload = deflated ?? data;
		const local = concat([
			u32(67324752),
			u16(20),
			u16(0),
			u16(method),
			u16(0),
			u16(0),
			u32(crc),
			u32(payload.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			name,
			payload
		]);
		locals.push(local);
		central.push(concat([
			u32(33639248),
			u16(20),
			u16(20),
			u16(0),
			u16(method),
			u16(0),
			u16(0),
			u32(crc),
			u32(payload.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(0),
			u32(offset),
			name
		]));
		offset += local.length;
	}
	const centralBytes = concat(central);
	const end = concat([
		u32(101010256),
		u16(0),
		u16(0),
		u16(files.length),
		u16(files.length),
		u32(centralBytes.length),
		u32(offset),
		u16(0)
	]);
	const body = concat(locals);
	const packed = new Uint8Array(body.byteLength + centralBytes.byteLength + end.byteLength);
	packed.set(body, 0);
	packed.set(centralBytes, body.byteLength);
	packed.set(end, body.byteLength + centralBytes.byteLength);
	const copy = new ArrayBuffer(packed.byteLength);
	new Uint8Array(copy).set(packed);
	return new Blob([copy], { type: "application/zip" });
}
var TEMPLATES = [
	{
		id: "classic-editorial",
		note: "Serif feature, 1.0.0 · essays"
	},
	{
		id: "minimal-authority",
		note: "Tight measure, 1.0.0 · reference"
	},
	{
		id: "affiliate-review",
		note: "Comparison blocks, 1.0.0 · reviews"
	}
];
function differentHost(ghostUrl, publicUrl) {
	try {
		if (!ghostUrl || !publicUrl) return false;
		return new URL(ghostUrl).host !== new URL(publicUrl).host;
	} catch {
		return Boolean(ghostUrl && publicUrl && ghostUrl !== publicUrl);
	}
}
function bytesToBase64(bytes) {
	let bin = "";
	for (const byte of bytes) bin += String.fromCharCode(byte);
	return btoa(bin);
}
function decode64(data) {
	const binary = atob(data);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}
function DeliveryPage() {
	const hydrated = useHydrated();
	const siteId = useApp((s) => s.activeSiteId);
	const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]);
	const allArticles = useApp((s) => s.articles);
	const allBuilds = useApp((s) => s.builds);
	const allDeploys = useApp((s) => s.deploys);
	const articles = (0, import_react.useMemo)(() => allArticles.filter((article) => article.siteId === siteId), [allArticles, siteId]);
	const builds = (0, import_react.useMemo)(() => allBuilds.filter((build) => build.siteId === siteId), [allBuilds, siteId]);
	const deploys = (0, import_react.useMemo)(() => allDeploys.filter((deploy) => deploy.siteId === siteId), [allDeploys, siteId]);
	const patchSite = useApp((s) => s.patchSite);
	const buildSite = useApp((s) => s.buildSite);
	const packageBuild = useApp((s) => s.packageBuild);
	const acknowledgeRouteDiff = useApp((s) => s.acknowledgeRouteDiff);
	const rebuildForRouteDiff = useApp((s) => s.rebuildForRouteDiff);
	const saveProviderApi = useApp((s) => s.saveProviderApi);
	const verifyProvider = useApp((s) => s.verifyProvider);
	const logEvent = useApp((s) => s.logEvent);
	const [packing, setPacking] = (0, import_react.useState)(false);
	const [uploadNote, setUploadNote] = (0, import_react.useState)("");
	const [adsPreview, setAdsPreview] = (0, import_react.useState)(false);
	const urlCheck = site.publicUrl ? validatePublicUrl(site.publicUrl) : {
		ok: false,
		error: "Public URL is required before an indexable build."
	};
	const holds = deploys.filter((deploy) => deploy.status === "hold-route-diff");
	async function packedFiles() {
		const build = builds[0];
		if (!build?.artifact.length) throw new Error("No frozen build artifact is available. Build a non-empty site first.");
		const media = staticMedia(articles);
		const packed = media.length ? await readMediaBatch({ data: { files: media } }) : {
			ok: true,
			files: []
		};
		return [...build.artifact.map((file) => ({
			name: file.name,
			base64: bytesToBase64(new TextEncoder().encode(file.text))
		})), ...packed.files.map((file) => ({
			name: `assets/img/${file.name}`,
			base64: file.base64
		}))];
	}
	async function download() {
		setPacking(true);
		try {
			const build = builds[0];
			if (!build?.artifact.length) throw new Error("No frozen build artifact is available. Build a non-empty site first.");
			const textFiles = build.artifact;
			const media = staticMedia(articles);
			const packed = media.length ? await readMediaBatch({ data: { files: media } }) : {
				ok: true,
				files: []
			};
			const enc = new TextEncoder();
			const blob = await zipStore([...textFiles.map((file) => ({
				name: file.name,
				data: enc.encode(file.text)
			})), ...packed.files.map((file) => ({
				name: `assets/img/${file.name}`,
				data: decode64(file.base64)
			}))]);
			const href = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = href;
			a.download = `${site.staticName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-static.zip`;
			a.click();
			URL.revokeObjectURL(href);
		} finally {
			setPacking(false);
		}
	}
	async function uploadLive(buildId) {
		const ftp = site.providers.find((provider) => provider.id === "cpanel" && provider.status === "verified")?.ftp;
		if (!ftp?.host || !ftp.user || !ftp.password) {
			setUploadNote("No live copy yet. Verify cPanel on Connections first.");
			return;
		}
		setPacking(true);
		setUploadNote("Uploading the static files. This finishes or fails within 30 seconds.");
		let settled = false;
		const watchdog = window.setTimeout(() => {
			if (settled) return;
			settled = true;
			setPacking(false);
			setUploadNote("Upload did not finish. The host stopped answering. Check the cPanel hostname, port, and remote directory.");
		}, 3e4);
		try {
			const files = await packedFiles();
			const result = await uploadFtps({ data: {
				host: ftp.host,
				user: ftp.user,
				password: ftp.password,
				port: ftp.port || 21,
				path: ftp.path || "/",
				via: ftp.via || "ftps",
				files
			} });
			if (settled) return;
			if (!result.ok) {
				setUploadNote(result.error);
				return;
			}
			const deployId = packageBuild(buildId, "cpanel");
			if (deployId) probe(deployId);
			setUploadNote(deployId ? `Uploaded ${result.files} files to ${ftp.host}. Run Live probe before calling the site live.` : `Uploaded ${result.files} files, but the deploy was held. Check the route-diff card.`);
		} catch (error) {
			if (!settled) setUploadNote(error instanceof Error ? error.message : "Upload failed.");
		} finally {
			settled = true;
			window.clearTimeout(watchdog);
			setPacking(false);
		}
	}
	async function deployWith(provider, buildId) {
		if (!provider.api?.token) {
			setUploadNote(`Save a ${provider.name} token first.`);
			return;
		}
		setPacking(true);
		setUploadNote(`Sending the frozen build to ${provider.name}…`);
		try {
			const files = await packedFiles();
			const result = provider.id === "cloudflare" ? await deployCloudflarePages({ data: {
				accountId: provider.api.accountId ?? "",
				token: provider.api.token,
				projectName: provider.api.projectName ?? "",
				files
			} }) : provider.id === "vercel" ? await deployVercel({ data: {
				token: provider.api.token,
				projectName: provider.api.projectName ?? "",
				files
			} }) : await deployGithubPages({ data: {
				token: provider.api.token,
				repo: provider.api.repo ?? "",
				branch: provider.api.branch ?? "gh-pages",
				files
			} });
			if (!result.ok) {
				setUploadNote(result.error);
				logEvent(site.id, "warn", `${provider.name} deploy failed: ${result.error}`);
				return;
			}
			const deployId = packageBuild(buildId, provider.id);
			setUploadNote(`${result.detail}${result.url ? ` Live URL ${result.url}.` : ""}`);
			logEvent(site.id, "ok", `${provider.name} deploy · ${result.detail}`);
			if (deployId) probe(deployId);
		} catch (error) {
			setUploadNote(error instanceof Error ? error.message : "Deploy failed.");
		} finally {
			setPacking(false);
		}
	}
	async function probe(deployId) {
		const result = await probePublicUrl({ data: { url: site.publicUrl } });
		if (!result.ok) {
			useApp.getState().recordProbe(deployId, false, result.error);
			return;
		}
		const deploy = deploys.find((item) => item.id === deployId);
		const build = builds.find((item) => item.id === deploy?.buildId);
		const ftp = site.providers.find((provider) => provider.id === "cpanel" && provider.status === "verified")?.ftp;
		const urls = build?.includedIds.map((id) => allArticles.find((article) => article.id === id)?.slug).filter(Boolean).map((slug) => `${site.publicUrl.replace(/\/$/, "")}/post/${slug}/`) ?? [];
		if (!site.indexNowKey || !ftp || !build || !urls.length) {
			useApp.getState().recordProbe(deployId, true, `${result.detail} IndexNow skipped: missing verified key-file configuration or changed URLs.`);
			return;
		}
		const submitted = await submitIndexNow({ data: {
			publicUrl: site.publicUrl,
			key: site.indexNowKey,
			urls,
			verified: true,
			ftp
		} });
		useApp.getState().recordProbe(deployId, true, submitted.ok ? `${result.detail} IndexNow submitted ${urls.length} changed URL(s).` : `${result.detail} IndexNow skipped: ${submitted.error}`);
	}
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkeletonRows, { rows: 5 });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
				eyebrow: "Website",
				title: "Static delivery",
				lede: "Ghost updates the CMS. This page builds the frozen public site: 7 configured ad slots, ads.txt, a route-diff gate that refuses to drop a live URL silently, and real deploy adapters for cPanel, Cloudflare Pages, Vercel, and GitHub Pages."
			}),
			holds.map((deploy) => {
				const diff = deploy.routeDiff;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "border-danger/50 p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "danger",
								children: "ROUTE-DIFF HOLD"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-sm text-muted",
								children: [
									"build ",
									deploy.buildId.slice(-6),
									" · ",
									diff?.removedRoutes.length ?? 0,
									" removed · ",
									diff?.addedRoutes.length ?? 0,
									" added · ",
									diff?.unchangedCount ?? 0,
									" unchanged"
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm leading-6 text-muted",
							children: [
								"Deploying this build would remove ",
								(diff?.removedRoutes.length ?? 0) === 1 ? "a URL that is currently live" : "URLs that are currently live",
								". Nothing has been uploaded. Acknowledge explicitly, or rebuild with the missing articles."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 max-h-40 space-y-1 overflow-auto text-xs text-danger",
							children: (diff?.removedRoutes ?? []).map((route) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: route }, route))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex flex-wrap gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "danger",
								onClick: () => acknowledgeRouteDiff(deploy.id),
								children: "Acknowledge & Deploy Anyway"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: () => rebuildForRouteDiff(deploy.id),
								children: "Rebuild with missing articles"
							})]
						})
					]
				}, deploy.id);
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5 text-sm leading-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-medium",
					children: "Where a published post actually goes"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-muted",
					children: [
						"Ghost Admin writes to ",
						site.ghost.url || "the connected CMS",
						". The public website is ",
						site.publicUrl || "not set",
						".",
						" ",
						differentHost(site.ghost.url, site.publicUrl) ? "Those are different hosts, so a CMS post will not show on the public site by itself. Download the ZIP or deploy through an adapter." : "Upload live sends the build to a verified cPanel directory. The public URL changes only after that upload and a successful probe."
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex flex-wrap items-center justify-between gap-3 p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-medium",
					children: "Auto-rebuild on publish"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-xl text-sm text-muted",
					children: "When on, a new article queues a fresh snapshot. Deploy still respects the route-diff gate."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					role: "switch",
					"aria-checked": site.autoRebuild,
					onClick: () => patchSite({ autoRebuild: !site.autoRebuild }),
					className: `min-h-11 rounded-full px-4 text-sm ${site.autoRebuild ? "bg-brass text-ink" : "border border-line text-muted"}`,
					children: site.autoRebuild ? "On" : "Off"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-medium",
						children: "Delivery targets"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Four adapters. Credentials stay in this browser; every host is a hardcoded https origin."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						tone: adsConfigHash(site) ? "muted" : "muted",
						children: ["ads hash ", adsConfigHash(site)]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 grid gap-3 md:grid-cols-2",
					children: site.providers.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderCard, {
						provider,
						buildId: builds.find((build) => build.status === "succeeded")?.id,
						packing,
						onSave: (api) => saveProviderApi(provider.id, api),
						onVerify: () => verifyProvider(provider.id, ""),
						onDeploy: (buildId) => void deployWith(provider, buildId)
					}, provider.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdSlotsCard, {
				site,
				preview: adsPreview,
				onPreview: setAdsPreview,
				onPatch: (patch) => patchSite(patch)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-medium",
						children: "ads.txt"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"Emitted as a tracked build artifact at ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: "/ads.txt"
							}),
							" whenever it is not empty."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: `${fieldClass} font-mono text-xs`,
						rows: 5,
						value: site.adsTxt ?? "",
						onChange: (e) => patchSite({ adsTxt: e.target.value }),
						placeholder: "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-faint",
						children: [new TextEncoder().encode(site.adsTxt ?? "").length, " bytes · will ship on the next build"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: buildSite,
						children: "Build now"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => void download(),
						disabled: packing || !articles.length && !builds.length,
						children: packing ? "Packing ZIP…" : "Download ZIP"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/preview",
						className: "inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm",
						children: "Preview"
					})
				]
			}),
			!urlCheck.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateNote, {
				tone: "partial",
				title: "Delivery is not indexable yet",
				body: urlCheck.error
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: ["Public origin ", urlCheck.url]
			}),
			uploadNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-4 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-medium",
					children: "Last delivery action"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-muted",
					children: uploadNote
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [builds.map((build) => {
					const deploy = deploys.find((item) => item.buildId === build.id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-xs text-faint",
										children: build.id
									}),
									build.auto ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: "brass",
										children: "AUTO"
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: statusTone(build.status),
										children: build.status
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-sm text-muted",
										children: [
											build.pages,
											" pages · ",
											(build.routes ?? []).length,
											" routes · ",
											Math.round(build.bytes / 1024),
											" KB · ads ",
											build.adsConfigHash ?? "—",
											" · ",
											relTime(build.at)
										]
									})
								]
							}),
							build.detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted",
								children: build.detail
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex flex-wrap gap-2",
								children: [!deploy && build.status === "succeeded" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									disabled: packing,
									onClick: () => void uploadLive(build.id),
									children: packing ? "Uploading…" : "Upload live (cPanel)"
								}) : null, deploy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: statusTone(deploy.status === "hold-route-diff" ? "failed" : deploy.status),
										children: deploy.status
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted",
										children: deploy.probe
									}),
									deploy.status === "packaged" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										onClick: () => void probe(deploy.id),
										children: "Live probe"
									}) : null
								] }) : null]
							})
						]
					}, build.id);
				}), !builds.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "No builds yet."
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Site customization"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: TEMPLATES.map((template) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => patchSite({ template: template.id }),
							className: `rounded-lg border px-3 py-2 text-left text-sm ${site.template === template.id ? "border-brass text-fg" : "border-line text-muted"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block font-medium",
								children: template.id
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs",
								children: template.note
							})]
						}, template.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Site name",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: fieldClass,
									value: site.staticName,
									onChange: (e) => patchSite({ staticName: e.target.value })
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Public URL",
								hint: "Required for an indexable build. Placeholder domains are rejected.",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: fieldClass,
									value: site.publicUrl,
									onChange: (e) => patchSite({ publicUrl: e.target.value }),
									placeholder: "https://notes.example"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Footer",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: fieldClass,
									value: site.footer,
									onChange: (e) => patchSite({ footer: e.target.value })
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Robots",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									className: fieldClass,
									value: site.robots,
									onChange: (e) => patchSite({ robots: e.target.value }),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "index,follow",
										children: "index,follow"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "noindex,nofollow",
										children: "noindex,nofollow"
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Header menu",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: fieldClass,
									value: site.headerMenu,
									onChange: (e) => patchSite({ headerMenu: e.target.value })
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Footer menu",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: fieldClass,
									value: site.footerMenu,
									onChange: (e) => patchSite({ footerMenu: e.target.value })
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Head HTML",
						hint: "Inserted into the downloaded ZIP only.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							className: fieldClass,
							rows: 3,
							value: site.headHtml,
							onChange: (e) => patchSite({ headHtml: e.target.value })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Analytics snippet",
						hint: "Same rule: customer static site only, never this control panel.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							className: fieldClass,
							rows: 3,
							value: site.analyticsSnippet,
							onChange: (e) => patchSite({ analyticsSnippet: e.target.value })
						})
					})
				]
			})
		]
	});
}
function ProviderCard({ provider, buildId, packing, onSave, onVerify, onDeploy }) {
	const [draft, setDraft] = (0, import_react.useState)({
		accountId: provider.api?.accountId ?? "",
		projectName: provider.api?.projectName ?? "",
		repo: provider.api?.repo ?? "",
		branch: provider.api?.branch ?? "gh-pages",
		token: ""
	});
	const credentialFields = provider.id === "cloudflare" ? [
		{
			key: "accountId",
			label: "Account ID"
		},
		{
			key: "projectName",
			label: "Pages project"
		},
		{
			key: "token",
			label: "API token",
			secret: true
		}
	] : provider.id === "vercel" ? [{
		key: "projectName",
		label: "Project name"
	}, {
		key: "token",
		label: "Token",
		secret: true
	}] : provider.id === "github" ? [
		{
			key: "repo",
			label: "owner/repo"
		},
		{
			key: "branch",
			label: "Branch"
		},
		{
			key: "token",
			label: "Token",
			secret: true
		}
	] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line p-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-medium",
					children: provider.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: provider.status === "verified" ? "ok" : provider.status === "configured" ? "brass" : "muted",
					children: provider.status.replace("_", " ")
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-faint",
				children: provider.capability
			}),
			provider.id === "cpanel" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 text-xs text-faint",
				children: provider.ftp?.host ? `${provider.ftp.host}${provider.ftp.path ?? ""} · ${provider.ftp.via ?? "ftps"}` : "Configure FTPS/SFTP on Connections."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 space-y-2",
				children: [credentialFields.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-faint",
						children: field.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: `${fieldClass} mt-1`,
						type: field.secret ? "password" : "text",
						value: draft[field.key],
						placeholder: field.secret ? provider.api?.tokenHint || "••••" : "",
						onChange: (e) => setDraft({
							...draft,
							[field.key]: e.target.value
						})
					})]
				}, field.key)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "min-h-9 px-3 py-1.5 text-xs",
							onClick: () => onSave({
								accountId: draft.accountId,
								projectName: draft.projectName,
								repo: draft.repo,
								branch: draft.branch,
								...draft.token ? { token: draft.token } : {}
							}),
							children: "Save"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "min-h-9 px-3 py-1.5 text-xs",
							variant: "ghost",
							onClick: onVerify,
							children: "Verify"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "min-h-9 px-3 py-1.5 text-xs",
							variant: "ghost",
							disabled: packing || !buildId || provider.status !== "verified",
							onClick: () => buildId && onDeploy(buildId),
							children: "Deploy"
						})
					]
				})]
			})
		]
	});
}
function AdSlotsCard({ site, preview, onPreview, onPatch }) {
	const slots = slotConfigs(site);
	const update = (id, patch) => onPatch({ ads: slots.map((slot) => slot.id === id ? {
		...slot,
		...patch
	} : slot) });
	const [unit, setUnit] = (0, import_react.useState)({
		publisher: "",
		slotId: ""
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "space-y-4 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-medium",
					children: "Ad slots (7)"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						"Each slot is independent, capped at ",
						Math.round(AD_CODE_LIMIT / 1024),
						" KiB of code, and only renders on the public build."
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						role: "switch",
						"aria-checked": preview,
						onClick: () => onPreview(!preview),
						className: `min-h-11 rounded-full px-4 text-sm ${preview ? "bg-brass text-ink" : "border border-line text-muted"}`,
						children: preview ? "Preview mode ON (scripts disabled)" : "Preview mode OFF"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						role: "switch",
						"aria-checked": Boolean(site.adsEnabled),
						onClick: () => onPatch({ adsEnabled: !site.adsEnabled }),
						className: `min-h-11 rounded-full px-4 text-sm ${site.adsEnabled ? "bg-brass text-ink" : "border border-line text-muted"}`,
						children: site.adsEnabled ? "Ads enabled" : "Ads disabled"
					})]
				})]
			}),
			preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-lg border border-dashed border-brass/50 bg-brass/5 p-3 text-xs text-muted",
				children: "Preview mode renders the slot placeholders and never loads live ad code — use it to check placement before switching ads on."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 md:grid-cols-2",
				children: slots.map((slot) => {
					const bytes = new TextEncoder().encode(slot.code).length;
					const over = !adCodeWithinLimit(slot.code);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `rounded-lg border p-3 text-sm ${slot.enabled ? "border-brass/40" : "border-line"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: "size-4 accent-brass",
										checked: slot.enabled,
										onChange: (e) => update(slot.id, { enabled: e.target.checked })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: AD_SLOT_LABELS[slot.id]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-xs text-faint",
									children: slot.id
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 grid gap-2 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint",
										children: "Internal name"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: `${fieldClass} mt-1`,
										value: slot.name,
										onChange: (e) => update(slot.id, { name: e.target.value })
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint",
										children: "Type"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										className: `${fieldClass} mt-1`,
										value: slot.adType,
										onChange: (e) => update(slot.id, { adType: e.target.value }),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "custom_code",
											children: "Custom code"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "adsense_responsive",
											children: "AdSense responsive"
										})]
									})]
								})]
							}),
							slot.adType === "custom_code" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "mt-2 block text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-faint",
									children: "Code"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									className: `${fieldClass} mt-1 font-mono text-xs`,
									rows: 3,
									value: slot.code,
									onChange: (e) => update(slot.id, { code: e.target.value })
								})]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 space-y-2 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-faint",
										children: "AdSense unit id (data-ad-slot)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: fieldClass,
										value: slot.code,
										onChange: (e) => update(slot.id, { code: e.target.value }),
										placeholder: "1234567890"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: fieldClass,
												value: unit.publisher,
												onChange: (e) => setUnit({
													...unit,
													publisher: e.target.value
												}),
												placeholder: "pub-1234567890"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: fieldClass,
												value: unit.slotId,
												onChange: (e) => setUnit({
													...unit,
													slotId: e.target.value
												}),
												placeholder: "unit id"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												className: "min-h-9 px-3 py-1.5 text-xs",
												variant: "ghost",
												onClick: () => update(slot.id, {
													adType: "custom_code",
													code: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${unit.publisher}" crossorigin="anonymous"><\/script>\n<ins class="adsbygoogle" style="display:block" data-ad-client="${unit.publisher}" data-ad-slot="${unit.slotId || slot.code}" data-ad-format="auto" data-full-width-responsive="true"></ins>\n<script>(adsbygoogle = window.adsbygoogle || []).push({});<\/script>`
												}),
												children: "Generate unit code"
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 text-xs text-faint",
								children: [
									bytes.toLocaleString(),
									" / ",
									AD_CODE_LIMIT.toLocaleString(),
									" bytes ",
									over ? "· OVER LIMIT — the build will refuse this slot" : ""
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 text-xs text-faint",
								children: [
									"desktop: ",
									slot.position.desktop,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"mobile: ",
									slot.position.mobile
								]
							})
						]
					}, slot.id);
				})
			})
		]
	});
}
var SplitComponent = DeliveryPage;
//#endregion
export { SplitComponent as component };
