import { i as __toESM } from "../_runtime.mjs";
import { $ as keyCallsModel, B as failJob, Ct as resolveRouteDiff, D as buildAudit, Et as sanitizeArticleImages, F as defaultAdSlots, G as hashStr, H as generateAuthorForTopic, I as embed, It as usableKey, Lt as usdFor, M as corpusFor, Mt as submitKeywords, N as cosine, Nt as suggestIdeas, O as cancelRun, P as decideReview, Pt as uid, S as attachAuthor, St as rescoreArticles, U as generatePlan, Vt as weaveOrphans, X as inventoryFromArticles, _ as applyAudit, _t as queueMissingPhotos, b as applyProbe, c as RESEARCH_STAGES, ct as needsWork, d as acceptModelPlan, dt as normalizeKeyword, et as keyPool, ft as packageDeploy, g as anchorPhrase, m as advance, n as AD_SLOT_IDS, nt as liftOpenings, o as DEFAULT_LIMITS, pt as parseIntentStage, rt as manualBuild, ut as normalizeAuthorProfile, vt as queuePlan, wt as restartJob, xt as releaseHeld, y as applyKeyPenalty, yt as regenerateVariant } from "./engine-DWsB6FrJ.mjs";
import { a as number, n as array, o as object, s as string, t as _enum } from "../_libs/zod.mjs";
import { X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { a as placeImages, t as createSsrRpc } from "./ops.functions-CQ9mdiWn.mjs";
import { n as generateDraft, r as generateIdeas } from "./providers.functions-CtXM7JdH.mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-CO3BA3x3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* Rule 4 — sequential multi-key auto-failover.
*
* Tries each key in pool order (primary first, then by priority). On failure it
* records the attempt, applies the penalty (the caller disables on 401/403 and
* cools on 429/5xx/timeout via `onPenalty`), and moves on. The first success wins,
* so a busy / rate-limited / exhausted primary key does not fail the job —
* generation completes and can still auto-publish to Ghost.
*/
async function runWithKeyPool(opts) {
	const attempted = [];
	const usable = opts.keys.filter((key) => key.chat !== false);
	if (!usable.length) return {
		ok: false,
		error: "NO_USABLE_KEY — no key in the pool can call a model. Add a key on AI Keys.",
		attempted
	};
	for (let index = 0; index < usable.length; index++) {
		const key = usable[index];
		opts.onAttempt?.(key, index);
		if (!key.secret || !key.baseUrl) {
			attempted.push({
				keyId: key.id,
				label: `${key.provider} · ${key.model}`,
				status: 0,
				error: "No base URL or secret stored in this browser."
			});
			opts.onPenalty?.(key.id, 0, "No base URL or secret stored in this browser.");
			continue;
		}
		const result = await opts.call(key);
		if (result.ok) return {
			ok: true,
			value: result.value,
			keyId: key.id,
			attempted
		};
		const status = result.status ?? 0;
		attempted.push({
			keyId: key.id,
			label: `${key.provider} · ${key.model}`,
			status,
			error: result.error
		});
		if (status || result.error) opts.onPenalty?.(key.id, status, result.error);
	}
	const last = attempted[attempted.length - 1];
	return {
		ok: false,
		error: last ? `Every key in the pool failed (${attempted.length} tried). Last: ${last.label} — ${last.error}` : "NO_USABLE_KEY",
		attempted
	};
}
/**
* Server data-plane API for the durable app store.
*
* `loadAppState`  — GET the whole snapshot (secrets decrypted in transit; they
*                   are stored AES-256-GCM encrypted at rest in `.data/`).
* `saveAppState`  — POST a snapshot; the server merges by row id with
*                   pipeline-progress protection for jobs and tombstones for
*                   deletions, so no browser context can rewind or resurrect
*                   another context's work.
* `resetAppState` — POST to wipe the server store (studio reset), bumping the
*                   generation so stale windows cannot resurrect old rows.
*/
var loadAppState = createServerFn({ method: "GET" }).handler(createSsrRpc("eaae0f6751211a4d819ff973a09c6067d5dd29b8ca686c5034a12628509729a4"));
var saveAppState = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input ?? {};
	if (!raw.state || typeof raw.state !== "object" || Array.isArray(raw.state)) throw new Error("saveAppState requires a state object.");
	return {
		state: raw.state,
		purges: raw.purges ?? void 0
	};
}).handler(createSsrRpc("abb28c6d0f7977d3af46328331addd8afe99e75b699ec01af6ee6c83c3ee45fc"));
var resetAppState = createServerFn({ method: "POST" }).handler(createSsrRpc("45952c913aea06e84d1cd891f13e58cffb7adefd2faff1d1a26f1090c14d43d8"));
/** Rule 1: cap is optional. Pass null (or omit) for unlimited keywords. */
function classifyLines(raw, keywordCap = null) {
	const kept = [];
	return {
		marks: raw.split("\n").map((line) => {
			const text = line.trim();
			if (!text) return {
				text: line,
				state: "blank"
			};
			if (text.length > 200) return {
				text,
				state: "too-long"
			};
			const keyword = normalizeKeyword(text);
			if (!keyword) return {
				text,
				state: "blank"
			};
			if (keywordCap != null && kept.length >= keywordCap) return {
				text,
				state: "over-limit"
			};
			if (kept.includes(keyword)) return {
				text,
				state: "repeat"
			};
			kept.push(keyword);
			return {
				text: keyword,
				state: "ok"
			};
		}),
		kept
	};
}
var WEEKDAYS = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat"
];
function weekdayIndex(date, timeZone) {
	const name = new Intl.DateTimeFormat("en-US", {
		timeZone,
		weekday: "short"
	}).format(date);
	const index = WEEKDAYS.indexOf(name);
	return index < 0 ? date.getDay() : index;
}
function ymdInZone(date, timeZone) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(date);
}
function zonedTimeToUtc(ymd, hour, minute, timeZone) {
	const [year, month, day] = ymd.split("-").map(Number);
	const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
	const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	}).formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
	return guess - (Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute)) - guess);
}
function publishSlots(input) {
	const days = input.days.length ? input.days : [
		1,
		3,
		5
	];
	const perWeek = Math.min(21, Math.max(1, input.perWeek));
	const slots = [];
	const start = input.from ?? Date.now();
	let weekKey = "";
	let inWeek = 0;
	for (let offset = 1; offset < 120 && slots.length < input.count; offset += 1) {
		const date = new Date(start + offset * 864e5);
		const stamp = ymdInZone(date, input.timeZone);
		const week = `${stamp.slice(0, 4)}-${weekNumber(date)}`;
		if (week !== weekKey) {
			weekKey = week;
			inWeek = 0;
		}
		if (!days.includes(weekdayIndex(date, input.timeZone))) continue;
		if (inWeek >= perWeek) continue;
		const at = zonedTimeToUtc(stamp, input.hour, input.minute, input.timeZone);
		if (at <= start) continue;
		slots.push(at);
		inWeek += 1;
	}
	return slots;
}
function weekNumber(date) {
	const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
	return Math.ceil(((date.getTime() - start.getTime()) / 864e5 + start.getUTCDay() + 1) / 7);
}
/** Rule 6: truthful cadence + automation summary strings (recomputed on every mutation). */
function calendarSummaries(calendar) {
	const cadence = `${[...calendar.activeDays].sort((a, b) => a - b).map((day) => WEEKDAYS[day] ?? "?").join(", ") || "No days"} · ${Math.min(21, Math.max(1, calendar.articlesPerWeek))}/week · ${calendar.publishTime} ${calendar.timezone}`;
	const bits = [];
	if (calendar.autoGenerate) bits.push(`Writes automatically ${Math.min(336, Math.max(1, calendar.generationLeadHours))}h before publish`);
	if (calendar.autoPublish) bits.push(calendar.publishMode === "published" ? "Publishes automatically at publish time" : "Saves drafts automatically at publish time");
	if (calendar.autoReweave) bits.push("Re-weaves internal links after publish");
	return {
		cadence,
		automation: bits.length ? bits.join(" · ") : "Automation off — manual only."
	};
}
function automationLabel(calendar) {
	return calendar.autoGenerate || calendar.autoPublish || calendar.autoReweave ? "automation on" : "manual";
}
function publishModeLabel(calendar) {
	return calendar.publishMode === "published" ? "Publish automatically" : "Save drafts automatically";
}
/** Rule 6: "Write now" / "Publish now" map the calendar's publish mode onto the run's engine mode. */
function engineMode(calendar) {
	return calendar.publishMode === "published" ? "live" : "draft";
}
function buildCalendar(input) {
	const ordered = orderTopics(input.topics, input.order);
	const [hour, minute] = input.publishTime.split(":").map((part) => Number(part) || 0);
	const slots = publishSlots({
		count: ordered.length,
		days: input.activeDays,
		perWeek: input.articlesPerWeek,
		hour: hour ?? 9,
		minute: minute ?? 0,
		timeZone: input.timezone,
		from: input.now
	});
	const leadHours = Math.min(336, Math.max(1, input.generationLeadHours));
	const ahead = leadHours * 36e5;
	const base = {
		id: uid("cal"),
		siteId: input.siteId,
		name: input.name.trim(),
		timezone: input.timezone,
		activeDays: input.activeDays.length ? input.activeDays : [
			1,
			3,
			5
		],
		articlesPerWeek: Math.min(21, Math.max(1, input.articlesPerWeek)),
		publishTime: input.publishTime,
		generationLeadHours: leadHours,
		strategy: "PILLAR_FIRST",
		publishMode: input.publishMode,
		mode: "MANUAL",
		planningRangeDays: input.planningRangeDays ?? 30,
		defaultModelCatalogId: input.defaultModelCatalogId ?? null,
		order: input.order,
		autoGenerate: false,
		autoPublish: false,
		autoReweave: false,
		cadence: "",
		automation: "",
		sourcePlanId: input.sourcePlanId,
		createdAt: input.now,
		items: ordered.map((topic, index) => {
			const publishAt = slots[index] ?? input.now + (index + 1) * 864e5;
			return {
				id: uid("slot"),
				title: topic.title,
				angle: topic.angle,
				kind: topic.kind,
				publishAt,
				writeAt: publishAt - ahead,
				status: "SCHEDULED"
			};
		})
	};
	const summaries = calendarSummaries(base);
	return {
		...base,
		...summaries
	};
}
/** Recompute the two summary strings after any mutation. */
function withSummaries(calendar) {
	return {
		...calendar,
		...calendarSummaries(calendar)
	};
}
function orderTopics(topics, order) {
	if (order === "my-order") return topics;
	if (order === "pillars-first") return [...topics].sort((a, b) => Number(b.kind === "pillar") - Number(a.kind === "pillar"));
	if (order === "one-cluster") return [...topics].sort((a, b) => Number(a.kind === "pillar") - Number(b.kind === "pillar"));
	const pillars = topics.filter((topic) => topic.kind === "pillar");
	const rest = topics.filter((topic) => topic.kind !== "pillar");
	const mixed = [];
	const max = Math.max(pillars.length, rest.length);
	for (let i = 0; i < max; i += 1) {
		if (rest[i]) mixed.push(rest[i]);
		if (i % 3 === 2 && pillars[Math.floor(i / 3)]) mixed.push(pillars[Math.floor(i / 3)]);
	}
	for (const pillar of pillars) if (!mixed.includes(pillar)) mixed.push(pillar);
	return mixed;
}
/** Map engine job state onto the live entry lifecycle (SCHEDULED | WRITING | READY | PUBLISHED | DRAFT_SAVED | SKIPPED | FAILED). */
function syncCalendarItems(data) {
	let changed = false;
	for (const calendar of data.calendars) for (const item of calendar.items) {
		if (!item.jobId) continue;
		const job = data.jobs.find((entry) => entry.id === item.jobId);
		if (!job) continue;
		if (job.articleId && item.articleId !== job.articleId) {
			item.articleId = job.articleId;
			changed = true;
		}
		if (job.status === "publish-held" && item.status !== "READY") {
			item.status = "READY";
			changed = true;
		}
		if (job.status === "completed" && item.status !== "PUBLISHED" && item.status !== "DRAFT_SAVED") {
			item.status = data.runs.find((entry) => entry.id === job.runId)?.publishMode === "live" ? "PUBLISHED" : "DRAFT_SAVED";
			changed = true;
		}
		if ((job.status === "failed" || job.status === "refused") && item.status === "WRITING") {
			item.status = "FAILED";
			item.note = job.refusalReason ?? "The run failed.";
			changed = true;
		}
	}
	return changed;
}
async function queueCalendarItem(data, calendarId, itemId, now) {
	const calendar = data.calendars.find((entry) => entry.id === calendarId);
	const item = calendar?.items.find((entry) => entry.id === itemId);
	if (!calendar || !item) return {
		data,
		error: "Calendar entry not found."
	};
	if (item.status !== "SCHEDULED" && item.status !== "FAILED") return {
		data,
		error: "That article has already started."
	};
	const result = await submitKeywords(data, {
		siteId: calendar.siteId,
		lines: item.title,
		publishMode: engineMode(calendar),
		modelKeyId: calendar.defaultModelCatalogId || "default",
		allowVariants: false,
		publishHold: true,
		now
	});
	if (result.error || !result.runId) return {
		data,
		error: result.error ?? "Could not write that calendar article."
	};
	const next = result.data;
	const stored = next.calendars.find((entry) => entry.id === calendarId)?.items.find((entry) => entry.id === itemId);
	const job = next.jobs.find((entry) => entry.runId === result.runId);
	if (stored && job) {
		stored.status = "WRITING";
		stored.jobId = job.id;
		stored.runId = result.runId;
		stored.attempts = (stored.attempts ?? 0) + 1;
	}
	next.notice = {
		tone: "ok",
		text: calendar.autoPublish ? `Writing started — it will ${calendar.publishMode === "published" ? "publish" : "save a draft"} at the scheduled time.` : "Writing started — it will wait for you before publishing."
	};
	return { data: next };
}
/** Release a READY entry now: mode-aware Publish now / Save draft now. */
function publishCalendarItemNow(data, calendarId, itemId, now) {
	const calendar = data.calendars.find((entry) => entry.id === calendarId);
	const item = calendar?.items.find((entry) => entry.id === itemId);
	if (!calendar || !item) return {
		data,
		error: "Calendar entry not found."
	};
	if (!item.jobId) return {
		data,
		error: "That article has not been written yet."
	};
	const released = releaseHeld(data, item.jobId, now);
	if (released.error) return {
		data,
		error: released.error
	};
	const next = released.data;
	const stored = next.calendars.find((entry) => entry.id === calendarId)?.items.find((entry) => entry.id === itemId);
	const run = next.runs.find((entry) => entry.id === stored?.runId);
	if (stored) stored.status = run?.publishMode === "live" ? "PUBLISHED" : "DRAFT_SAVED";
	return { data: next };
}
/**
* Rule 6 autoReweave: link a freshly published article to its same-calendar
* siblings (pillars first) with LOCAL edges. The PUT-only Ghost re-weave path
* (optimistic lock on updated_at) is executed by the desk worker, which
* transitions each edge to GHOST_CONFIRMED.
*/
function reweaveCalendar(data, calendar, now) {
	const published = calendar.items.filter((entry) => entry.status === "PUBLISHED" && entry.articleId);
	if (published.length < 2) return false;
	const kindOf = new Map(published.map((entry) => [entry.articleId, entry.kind]));
	let changed = false;
	for (const entry of published) {
		const article = data.articles.find((row) => row.id === entry.articleId);
		if (!article) continue;
		const siblings = published.filter((other) => other.articleId !== entry.articleId);
		const targetEntry = siblings.find((other) => kindOf.get(other.articleId) === "pillar") ?? siblings[0];
		const target = data.articles.find((row) => row.id === targetEntry?.articleId);
		if (!target) continue;
		if (article.links.some((link) => link.targetSlug === target.slug)) continue;
		article.links.push({
			anchor: anchorPhrase(target.title),
			targetSlug: target.slug,
			state: "LOCAL"
		});
		changed = true;
		logReweave(data, calendar.siteId, `${article.title} → ${target.title}`, now);
	}
	return changed;
}
function logReweave(data, siteId, pair, now) {
	data.activity.unshift({
		id: uid("act"),
		at: now,
		siteId,
		tone: "info",
		message: `Auto-reweave proposed link · ${pair}`
	});
}
/**
* Rule 6 pulse: the 3 switches act independently.
*  - autoGenerate: queue SCHEDULED entries whose write_at has passed.
*  - autoPublish : release READY entries at publish_at (published → live, or draft mode → save draft).
*  - autoReweave : after publish, propose sibling links in the same calendar.
*/
async function pulseCalendars(data, now) {
	if (data.workerPaused) return null;
	let next = structuredClone(data);
	let changed = syncCalendarItems(next);
	for (const calendar of [...next.calendars]) {
		if (!calendar.autoGenerate) continue;
		for (const item of calendar.items) {
			if (item.status !== "SCHEDULED" || item.writeAt > now) continue;
			const queued = await queueCalendarItem(next, calendar.id, item.id, now);
			if (!queued.error) {
				next = queued.data;
				changed = true;
			}
		}
	}
	syncCalendarItems(next);
	for (const calendar of [...next.calendars]) {
		if (!calendar.autoPublish) continue;
		for (const item of calendar.items) {
			if (item.status !== "READY" || !item.jobId || item.publishAt > now) continue;
			const result = publishCalendarItemNow(next, calendar.id, item.id, now);
			if (result.error) continue;
			next = result.data;
			changed = true;
		}
	}
	for (const calendar of [...next.calendars]) {
		if (!calendar.autoReweave) continue;
		if (reweaveCalendar(next, calendar, now)) changed = true;
	}
	return changed ? next : null;
}
var CALENDAR_STATUS_MAP = {
	scheduled: "SCHEDULED",
	skipped: "SKIPPED",
	writing: "WRITING",
	"publish-held": "READY",
	published: "PUBLISHED",
	"draft-saved": "DRAFT_SAVED",
	failed: "FAILED",
	SCHEDULED: "SCHEDULED",
	WRITING: "WRITING",
	READY: "READY",
	PUBLISHED: "PUBLISHED",
	DRAFT_SAVED: "DRAFT_SAVED",
	SKIPPED: "SKIPPED",
	FAILED: "FAILED"
};
var clampNumber = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));
/**
* Rule 6 (persist v10): bring any legacy or restored calendar onto the live
* contract. The 3 automation switches are ALWAYS written as OFF here — a backup
* restore can never silently re-enable writing or publishing.
*/
function migrateCalendar(raw) {
	const legacy = raw;
	const activeDays = Array.isArray(raw.activeDays) && raw.activeDays.length ? raw.activeDays : Array.isArray(legacy.days) && legacy.days.length ? legacy.days : [
		1,
		3,
		5
	];
	const publishTime = typeof raw.publishTime === "string" && /^\d{1,2}:\d{2}$/.test(raw.publishTime) ? raw.publishTime : `${String(legacy.publishHour ?? 9).padStart(2, "0")}:${String(legacy.publishMinute ?? 0).padStart(2, "0")}`;
	return withSummaries({
		id: String(raw.id ?? uid("cal")),
		siteId: String(raw.siteId ?? ""),
		name: String(raw.name ?? "Calendar"),
		timezone: String(raw.timezone || "UTC"),
		activeDays,
		articlesPerWeek: clampNumber(Number(raw.articlesPerWeek ?? legacy.perWeek ?? 3) || 3, 1, 21),
		publishTime,
		generationLeadHours: clampNumber(Number(raw.generationLeadHours ?? legacy.writeHoursAhead ?? 12) || 12, 1, 336),
		strategy: "PILLAR_FIRST",
		publishMode: raw.publishMode === "draft" ? "draft" : "published",
		mode: "MANUAL",
		planningRangeDays: clampNumber(Number(raw.planningRangeDays ?? 30) || 30, 1, 365),
		defaultModelCatalogId: raw.defaultModelCatalogId ?? null,
		order: raw.order ?? "one-cluster",
		autoGenerate: false,
		autoPublish: false,
		autoReweave: false,
		cadence: "",
		automation: "",
		sourcePlanId: raw.sourcePlanId,
		createdAt: Number(raw.createdAt ?? Date.now()),
		items: (raw.items ?? []).map((item) => ({
			...item,
			status: CALENDAR_STATUS_MAP[String(item.status ?? "SCHEDULED")] ?? "SCHEDULED",
			attempts: item.attempts ?? 0
		}))
	});
}
/**
* Rule 6 — durable worker bridge.
*
* The browser owns the workspace data, so this server module provides the two
* things a tab cannot: (1) a heartbeat that survives reloads and proves a worker
* loop exists, and (2) an atomic single-dispatch lease so several tabs and the
* server loop can never advance the same queue or publish the same post twice.
*
* The registry is file-backed with atomic rename, so a restart keeps the lease
* state honest. Full headless execution moves to the SQL migration; until then
* this bridge is the coordination point and the badge reads its real timestamp.
*/
var readWorkInput = (input) => {
	const raw = input;
	const siteId = typeof raw?.siteId === "string" && raw.siteId.trim() ? raw.siteId.trim().slice(0, 64) : "";
	if (!siteId) throw new Error("siteId is required.");
	return {
		siteId,
		tickId: typeof raw?.tickId === "string" ? raw.tickId.slice(0, 64) : "",
		activeJobs: Number.isFinite(raw?.activeJobs) ? Math.max(0, Math.min(1e4, Math.floor(raw.activeJobs))) : 0,
		nextCalendarPulseAt: Number.isFinite(raw?.nextCalendarPulseAt) ? Math.floor(raw.nextCalendarPulseAt) : void 0,
		ttlMs: Number.isFinite(raw?.ttlMs) ? Math.max(5e3, Math.min(6e4, Math.floor(raw.ttlMs))) : 15e3
	};
};
/** Heartbeat + lease renewal in one call (the browser tick sends the truth it knows). */
var workerHeartbeat = createServerFn({ method: "POST" }).validator(readWorkInput).handler(createSsrRpc("951f2b8c7a5d208982f7256a46bd8a808ba573fbdad272d81a9fdd16849ebeaa"));
/**
* Claim (or renew) the single-dispatch lease. Granted only when the lease is
* free, expired, or already held by this tickId — concurrent tabs get false.
*/
var workerClaimLease = createServerFn({ method: "POST" }).validator(readWorkInput).handler(createSsrRpc("5a8e87a75c8058b63ce6d772cd981e503b16762cf9cde03f59accb92b6e0ce49"));
createServerFn({ method: "POST" }).validator(readWorkInput).handler(createSsrRpc("94636e515f3979d18b6d83e78001b1be81adc70ad50b8df865c88765f4ef9342"));
var PROVIDER_LABELS = {
	openai: "OpenAI",
	openrouter: "OpenRouter",
	custom: "Custom endpoint"
};
var PROVIDER_BASE_URLS = {
	openai: "https://api.openai.com/v1",
	openrouter: "https://openrouter.ai/api/v1",
	custom: ""
};
/**
* GOVERNOR §3/§5 — the semantic embedding model is a separate capability from
* chat (WORKFLOW-MAP §10: usage events settle `text-embedding-3-small`). The L3
* duplicate gate reuses the chat key but must call an embeddings-capable model,
* never the chat model id.
*/
var DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
var PROVIDER_EMBEDDING_MODELS = {
	openai: DEFAULT_EMBEDDING_MODEL,
	openrouter: void 0,
	custom: void 0
};
function providerForKind(kind, fallbackProvider = "") {
	if (kind) return kind;
	const provider = fallbackProvider.toLowerCase();
	if (provider.includes("openrouter")) return "openrouter";
	if (provider.includes("openai")) return "openai";
	return "custom";
}
/**
* The embedding model this key should call, or undefined when the provider
* family has no known embeddings endpoint (fail honest → L3 hash fallback).
*/
function embeddingModelFor(key) {
	const explicit = key.embeddingModel?.trim();
	if (explicit) return explicit;
	return PROVIDER_EMBEDDING_MODELS[providerForKind(key.providerKind, key.provider)];
}
var MODEL_CATALOG = [
	{
		id: "openai/gpt-4o-mini",
		provider: "openai",
		modelId: "gpt-4o-mini",
		label: "OpenAI GPT-4o mini",
		group: "fast",
		inputPricePerMillion: .15,
		outputPricePerMillion: .6,
		baseUrl: PROVIDER_BASE_URLS.openai
	},
	{
		id: "openai/gpt-5.6-luna",
		provider: "openai",
		modelId: "gpt-5.6-luna",
		label: "OpenAI GPT-5.6 Luna",
		group: "fast",
		inputPricePerMillion: .2,
		outputPricePerMillion: 1.2,
		baseUrl: PROVIDER_BASE_URLS.openai,
		note: "Live account default"
	},
	{
		id: "openai/gpt-5-mini",
		provider: "openai",
		modelId: "gpt-5-mini",
		label: "OpenAI GPT-5 mini",
		group: "balanced",
		inputPricePerMillion: .25,
		outputPricePerMillion: 2,
		baseUrl: PROVIDER_BASE_URLS.openai,
		note: "Retires 2026-12-11"
	},
	{
		id: "openai/gpt-4.1-mini",
		provider: "openai",
		modelId: "gpt-4.1-mini",
		label: "OpenAI GPT-4.1 mini",
		group: "balanced",
		inputPricePerMillion: .4,
		outputPricePerMillion: 1.6,
		baseUrl: PROVIDER_BASE_URLS.openai
	},
	{
		id: "openai/gpt-5.4-mini",
		provider: "openai",
		modelId: "gpt-5.4-mini",
		label: "OpenAI GPT-5.4 Mini",
		group: "fast",
		inputPricePerMillion: .75,
		outputPricePerMillion: 4.5,
		baseUrl: PROVIDER_BASE_URLS.openai
	},
	{
		id: "openai/gpt-5.6-terra",
		provider: "openai",
		modelId: "gpt-5.6-terra",
		label: "OpenAI GPT-5.6 Terra",
		group: "balanced",
		inputPricePerMillion: 2,
		outputPricePerMillion: 12,
		baseUrl: PROVIDER_BASE_URLS.openai
	},
	{
		id: "openai/gpt-4o",
		provider: "openai",
		modelId: "gpt-4o",
		label: "OpenAI GPT-4o",
		group: "flagship",
		inputPricePerMillion: 2.5,
		outputPricePerMillion: 10,
		baseUrl: PROVIDER_BASE_URLS.openai
	},
	{
		id: "openai/gpt-5.6-sol",
		provider: "openai",
		modelId: "gpt-5.6-sol",
		label: "OpenAI GPT-5.6 Sol",
		group: "flagship",
		inputPricePerMillion: 4,
		outputPricePerMillion: 20,
		baseUrl: PROVIDER_BASE_URLS.openai
	},
	{
		id: "openai/gpt-6-astra",
		provider: "openai",
		modelId: "gpt-6-astra",
		label: "OpenAI GPT-6 Astra",
		group: "flagship",
		inputPricePerMillion: 10,
		outputPricePerMillion: 50,
		baseUrl: PROVIDER_BASE_URLS.openai
	},
	{
		id: "openrouter/llama-3.3-70b:free",
		provider: "openrouter",
		modelId: "meta-llama/llama-3.3-70b-instruct:free",
		label: "Llama 3.3 70B Free",
		group: "fast",
		inputPricePerMillion: 0,
		outputPricePerMillion: 0,
		baseUrl: PROVIDER_BASE_URLS.openrouter
	},
	{
		id: "openrouter/deepseek-chat-v3:free",
		provider: "openrouter",
		modelId: "deepseek/deepseek-chat-v3:free",
		label: "DeepSeek Chat V3 Free",
		group: "fast",
		inputPricePerMillion: 0,
		outputPricePerMillion: 0,
		baseUrl: PROVIDER_BASE_URLS.openrouter
	},
	{
		id: "openrouter/llama-3.3-70b",
		provider: "openrouter",
		modelId: "meta-llama/llama-3.3-70b-instruct",
		label: "Llama 3.3 70B",
		group: "balanced",
		inputPricePerMillion: .12,
		outputPricePerMillion: .3,
		baseUrl: PROVIDER_BASE_URLS.openrouter
	},
	{
		id: "openrouter/gemini-2.5-pro",
		provider: "openrouter",
		modelId: "google/gemini-2.5-pro",
		label: "Gemini 2.5 Pro",
		group: "balanced",
		inputPricePerMillion: 1.25,
		outputPricePerMillion: 10,
		baseUrl: PROVIDER_BASE_URLS.openrouter
	},
	{
		id: "openrouter/gpt-4o",
		provider: "openrouter",
		modelId: "openai/gpt-4o",
		label: "GPT-4o",
		group: "flagship",
		inputPricePerMillion: 2.5,
		outputPricePerMillion: 10,
		baseUrl: PROVIDER_BASE_URLS.openrouter
	},
	{
		id: "openrouter/claude-sonnet-4",
		provider: "openrouter",
		modelId: "anthropic/claude-sonnet-4",
		label: "Claude Sonnet 4",
		group: "flagship",
		inputPricePerMillion: 3,
		outputPricePerMillion: 15,
		baseUrl: PROVIDER_BASE_URLS.openrouter
	},
	{
		id: "custom/glm-5.3-flash",
		provider: "custom",
		modelId: "glm-5.3-flash",
		label: "GLM-5.3 Flash (custom)",
		group: "custom",
		inputPricePerMillion: .3,
		outputPricePerMillion: .3,
		baseUrl: ""
	},
	{
		id: "custom/deepseek-v4.1-flash",
		provider: "custom",
		modelId: "deepseek-v4.1-flash",
		label: "DeepSeek V4.1 Flash (custom)",
		group: "custom",
		inputPricePerMillion: .3,
		outputPricePerMillion: .3,
		baseUrl: ""
	},
	{
		id: "custom/grok-4",
		provider: "custom",
		modelId: "grok-4",
		label: "Grok 4 (custom)",
		group: "custom",
		inputPricePerMillion: 1,
		outputPricePerMillion: 1,
		baseUrl: ""
	},
	{
		id: "custom/any",
		provider: "custom",
		modelId: "",
		label: "Custom model id…",
		group: "custom",
		inputPricePerMillion: 1,
		outputPricePerMillion: 1,
		baseUrl: ""
	}
];
function catalogModel(id) {
	if (!id) return void 0;
	return MODEL_CATALOG.find((model) => model.id === id);
}
function modelsForProvider(provider) {
	return MODEL_CATALOG.filter((model) => model.provider === provider);
}
/** Blended $/1M used for the local allowance meter. Conservative: average of in/out. */
function blendedPricePerMillion(model) {
	const blended = (model.inputPricePerMillion + model.outputPricePerMillion) / 2;
	return Math.max(0, Math.round(blended * 1e3) / 1e3);
}
function pricePerMillionForModelId(modelId, fallback = 6) {
	const needle = modelId.trim().toLowerCase();
	const hit = MODEL_CATALOG.find((model) => model.modelId && model.modelId.toLowerCase() === needle);
	if (hit) return blendedPricePerMillion(hit);
	if (needle.includes("flash") || needle.includes("mini") || needle.includes("haiku")) return .3;
	if (needle.includes("deepseek")) return .3;
	if (needle.includes("llama") || needle.includes("gemini")) return .5;
	return fallback;
}
/**
* GOVERNOR §3 capability match (chat vs semantic): the L3 duplicate gate reuses
* the chat key's credentials but must call an embeddings-capable model id — never
* the chat model (a chat model answers `/embeddings` with "no embeddings
* support"). When the provider family has no resolvable embedding model we return
* no provider, so `embedForL3` takes the honest local-hash fallback instead of
* firing a doomed request. Embedding tokens ride `spent()` and settle separately
* (WORKFLOW-MAP §10).
*/
function embeddingProvider(key) {
	let tokens = 0;
	const cache = /* @__PURE__ */ new Map();
	if (!key?.secret || !key.baseUrl) return { spent: () => 0 };
	const model = embeddingModelFor({
		provider: key.provider ?? "",
		providerKind: key.providerKind,
		embeddingModel: key.embeddingModel
	});
	if (!model) return { spent: () => 0 };
	const baseUrl = key.baseUrl;
	const secret = key.secret;
	return {
		spent: () => tokens,
		model,
		provider: async (text) => {
			const hit = cache.get(text);
			if (hit) return hit;
			const { getEmbedding } = await import("./providers.functions-CtXM7JdH.mjs").then((n) => n.a).then((n) => n.a);
			const result = await getEmbedding({ data: {
				baseUrl,
				apiKey: secret,
				model,
				input: text
			} });
			if (!result.ok) throw new Error(result.error);
			tokens += result.tokens;
			cache.set(text, result.vector);
			return result.vector;
		}
	};
}
/**
* Rule 3/§4 — Eleven-Stage Niche Research Engine (R1–R11, live names).
*
* Pure engine over Persisted: the caller injects a chat fn (key pool + model) so
* the whole pipeline is testable offline. LLM stages R1–R6, R8, R9, R11 validate
* JSON with one auto-retry; R7 (Semantic consolidation) and R10 (Content action
* classification) are derived at 0 tokens. Failures stop safely and honestly —
* later stages stay pending rather than being charged for a broken run.
*/
var RESEARCH_PROMPT_VERSION = "research@1-r11";
var NO_RESEARCH_KEY = "NO_RESEARCH_KEY — every chat key is disabled, cooling, or over its daily allowance.";
var JSON_ONLY = (shape) => `Return valid JSON only (no markdown fence) matching ${shape}.`;
function siteEvidenceFacts(site, data, niche, notes, now) {
	const articles = data.articles.filter((article) => article.siteId === site.id);
	const words = articles.reduce((sum, article) => sum + article.words, 0);
	const links = articles.reduce((sum, article) => sum + article.links.length, 0);
	const titles = articles.slice(0, 3).map((article) => article.title);
	const facts = [{
		id: uid("fact"),
		label: "From your site",
		text: articles.length ? `${site.name} already has ${articles.length} article${articles.length === 1 ? "" : "s"}${titles.length ? `: ${titles.join("; ")}` : ""}.` : `${site.name} has no articles in this studio yet. A first plan should stay narrow.`
	}, {
		id: uid("fact"),
		label: "Calculated",
		text: articles.length ? `${words.toLocaleString()} words across the corpus and ${links} internal links. Average ${Math.round(links / articles.length)} links per article.` : "No corpus math yet. The duplicate gate has nothing local to compare until the first run lands."
	}];
	if (notes.trim()) facts.push({
		id: uid("fact"),
		label: "You wrote this",
		text: notes.trim()
	});
	return facts;
}
function blankStage(key) {
	return {
		key: key.key,
		name: key.name,
		engine: key.engine,
		status: "pending",
		tokens: 0,
		attempts: 0
	};
}
function newResearchProject(input) {
	return {
		id: uid("res"),
		siteId: input.siteId,
		niche: input.niche.trim(),
		notes: input.notes.trim(),
		createdAt: input.now,
		status: "partial",
		breadth: input.breadth,
		stages: RESEARCH_STAGES.map(blankStage),
		stagesCompleted: 0,
		attempts: 0,
		output: {},
		facts: input.site && input.data ? siteEvidenceFacts(input.site, input.data, input.niche, input.notes, input.now) : []
	};
}
/** Persist-v9: upgrade legacy fact-only projects into the staged shape (no data loss). */
function normalizeResearchProject(raw) {
	const legacy = raw;
	if (legacy.stages?.length === RESEARCH_STAGES.length) return legacy;
	return {
		...legacy,
		status: legacy.status === "ready" ? "ready" : "partial",
		breadth: legacy.breadth ?? "standard",
		stages: legacy.stages?.length === RESEARCH_STAGES.length ? legacy.stages : RESEARCH_STAGES.map(blankStage),
		stagesCompleted: legacy.stagesCompleted ?? 0,
		attempts: legacy.attempts ?? 0,
		output: legacy.output ?? {}
	};
}
function stageOf(project, key) {
	return project.stages.find((stage) => stage.key === key);
}
function projectStatus(project) {
	const done = project.stages.filter((stage) => stage.status === "done").length;
	const failed = project.stages.some((stage) => stage.status === "failed");
	return done === RESEARCH_STAGES.length ? "ready" : failed ? done ? "partial" : "failed" : "partial";
}
var nicheSchema = object({
	entityMap: string().min(20),
	subNiches: array(string().min(3)).min(2).max(10),
	terminology: array(string().min(2)).min(2).max(20),
	purpose: string().min(20)
});
var audienceSchema = object({ personas: array(object({
	persona: string().min(2),
	intent: string().min(3),
	pain: string().min(3)
})).min(3).max(6) });
var problemSchema = object({ problems: array(object({
	persona: string().min(2),
	problem: string().min(5)
})).min(3).max(12) });
var universeSchema = object({
	pillar: string().min(6),
	clusters: array(object({
		title: string().min(6),
		angle: string().optional()
	})).min(6).max(10)
});
var expansionSchema = object({ queries: array(object({
	query: string().min(6).max(160),
	topic: string().optional()
})).min(6).max(40) });
var intentSchema = object({ intents: array(object({
	query: string().min(6),
	intent: _enum([
		"informational",
		"comparison",
		"transactional",
		"crisis",
		"how-to"
	])
})).min(1) });
var coverageSchema = object({ mapped: array(object({
	query: string().min(6),
	state: _enum([
		"covered",
		"partial",
		"weak",
		"missing"
	]),
	evidence: string().min(2)
})).min(1) });
var clusterSchema = object({ clusters: array(object({
	title: string().min(6),
	angle: string().min(6),
	queries: array(string().min(6)).default([])
})).min(3).max(8) });
var prioritySchema = object({
	note: string().min(10),
	scores: array(object({
		topic: string().min(3),
		score: number().min(0).max(100),
		why: string().min(3)
	})).min(1).max(12)
});
function evidenceBlock(project, data, site) {
	const articleTitles = data.articles.filter((article) => article.siteId === site.id).slice(0, 60).map((article) => `- ${article.title}`).join("\n") || "- (no articles yet)";
	return `Evidence so far (corrections to these take precedence):\n${project.facts.map((fact) => `[${fact.label}] ${fact.text}`).join("\n") || "- none"}\n\nExisting pages:\n${articleTitles}`;
}
function stagePrompt(key, project, data, site) {
	const base = `You are stage ${RESEARCH_STAGES.findIndex((stage) => stage.key === key) + 1} of an 11-stage niche research pipeline for the website "${site.name}". Niche: ${project.niche}. No search volume, CPC, difficulty, or ranking numbers exist — never invent them. ${JSON_ONLY("the shape below")} Prompt version ${RESEARCH_PROMPT_VERSION}.`;
	const evidence = evidenceBlock(project, data, site);
	const gauge = project.breadth === "compact" ? "10–15 queries" : project.breadth === "wide" ? "30–40 queries" : "18–25 queries";
	const queries = (project.output.queries ?? []).filter((query) => query.status === "keep");
	const queryList = queries.length ? `\n\nQueries from R5 (classify these verbatim):\n${queries.map((query) => `- ${query.query}`).join("\n")}` : "";
	return {
		system: `${base} ${{
			niche: "{\"entityMap\":string,\"subNiches\":string[],\"terminology\":string[],\"purpose\":string}",
			audience: "{\"personas\":[{\"persona\":string,\"intent\":string,\"pain\":string}]} (3–6 personas)",
			problem: "{\"problems\":[{\"persona\":string,\"problem\":string}]} (3–12 problems tied to those personas)",
			"topic-universe": "{\"pillar\":string,\"clusters\":[{\"title\":string,\"angle\":string}]} (pillar + 6–10 clusters, each a decision, no tips/tools/effectively headings)",
			"query-expansion": `{"queries":[{"query":string,"topic":string}]} — real user questions (${gauge})`,
			"intent-class": "{\"intents\":[{\"query\":string,\"intent\":\"informational\"|\"comparison\"|\"transactional\"|\"crisis\"|\"how-to\"}]} — classify the queries listed below verbatim",
			coverage: "{\"mapped\":[{\"query\":string,\"state\":\"covered\"|\"partial\"|\"weak\"|\"missing\",\"evidence\":string}]} — against the existing pages listed below, for the queries listed below",
			"cluster-construction": "{\"clusters\":[{\"title\":string,\"angle\":string,\"queries\":string[]}]} (3–8 clusters, ≥0.88-distinct titles, internal-link opportunities)",
			priority: "{\"note\":string,\"scores\":[{\"topic\":string,\"score\":number,\"why\":string}]} (rule-based 0–100 from coverage and intent only)",
			"semantic-consolidation": "",
			"action-class": ""
		}[key]}`,
		user: `${evidence}${key === "intent-class" || key === "coverage" ? queryList : ""}`
	};
}
var R7_THRESHOLD = .9;
function dedupeQueries(queries) {
	const kept = [];
	let merged = 0;
	for (const query of queries) {
		if (query.status === "merged") {
			kept.push(query);
			continue;
		}
		const vector = embed(query.query);
		const twin = kept.find((candidate) => candidate.status === "keep" && cosine(vector, embed(candidate.query)) > R7_THRESHOLD);
		if (twin) {
			merged += 1;
			kept.push({
				...query,
				status: "merged",
				mergedInto: twin.id
			});
		} else kept.push({
			...query,
			status: "keep",
			embedSource: "hash-fallback"
		});
	}
	return {
		queries: kept,
		merged
	};
}
function classifyActions(queries, coverage) {
	const stateFor = new Map(coverage.map((row) => [row.queryId ?? row.query, row.state]));
	return {
		actions: queries.filter((query) => query.status === "keep").map((query) => {
			const state = stateFor.get(query.id) ?? stateFor.get(query.query) ?? "missing";
			if (state === "covered") return {
				queryId: query.id,
				query: query.query,
				action: "skip",
				reason: "Existing page already answers this query."
			};
			if (state === "partial") return {
				queryId: query.id,
				query: query.query,
				action: "refresh",
				reason: "Existing page partially answers it — refresh rather than duplicate."
			};
			return {
				queryId: query.id,
				query: query.query,
				action: "write",
				reason: `Coverage is ${state}; a new page should own this question.`
			};
		}),
		skipped: queries.filter((query) => query.status === "merged").length
	};
}
function parseJson(systemShapeError, text) {
	try {
		return JSON.parse(text.replace(/^```json\s*|```$/g, "").trim());
	} catch {
		throw new Error(`${systemShapeError}: response is not valid JSON`);
	}
}
async function askValidated(chat, prompt, stageName, validate) {
	const check = (text) => {
		let parsed;
		try {
			parsed = parseJson(stageName, text);
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "not valid JSON"
			};
		}
		return validate(parsed);
	};
	const first = await chat(prompt);
	if (!first.ok) throw new Error(first.error);
	const firstCheck = check(first.text);
	if (firstCheck.ok) return {
		value: firstCheck.value,
		usage: first.usage
	};
	const retry = await chat({
		system: prompt.system,
		user: `${prompt.user}\n\nThe previous response was rejected: ${firstCheck.error} Fix it and return valid JSON only.`
	});
	if (!retry.ok) throw new Error(retry.error);
	const second = check(retry.text);
	if (!second.ok) throw new Error(second.error);
	return {
		value: second.value,
		usage: retry.usage
	};
}
/**
* Runs every runnable stage in order, mutating the caller's Persisted in place
* (pass a structuredClone from the store). Idempotent per project: `done`
* stages are skipped — a rerun continues from what is missing and never
* re-charges the rest.
*/
async function runResearch(data, projectId, chat, now) {
	const project = data.research.find((item) => item.id === projectId);
	if (!project || project.archived) return data;
	if (project.stages?.length !== RESEARCH_STAGES.length) {
		const source = newResearchProject({
			siteId: project.siteId,
			niche: project.niche,
			notes: project.notes,
			breadth: "standard",
			now
		});
		project.breadth = project.breadth ?? "standard";
		project.stages = project.stages?.length === RESEARCH_STAGES.length ? project.stages : source.stages;
		project.output = project.output ?? {};
	}
	const site = data.sites.find((item) => item.id === project.siteId) ?? data.sites[0];
	if (!site) return data;
	project.attempts += 1;
	for (const def of RESEARCH_STAGES) {
		const record = stageOf(project, def.key);
		if (record.status === "done" || record.status === "running") continue;
		if (def.key === "semantic-consolidation") {
			const started = now;
			record.status = "running";
			const queries = project.output.queries ?? [];
			if (!queries.length) {
				record.status = "failed";
				record.error = "No queries survived R5 — R7 has nothing to consolidate.";
				break;
			}
			const { queries: deduped, merged } = dedupeQueries(queries);
			project.output.queries = deduped;
			record.status = "done";
			record.tokens = 0;
			record.note = `Derived (0 tokens): cosine > ${R7_THRESHOLD} merged ${merged} of ${queries.length} queries.`;
			record.startedAt ||= started;
			record.finishedAt = now;
			record.durationMs = 40;
			continue;
		}
		if (def.key === "action-class") {
			record.status = "running";
			const { actions, skipped } = classifyActions(project.output.queries ?? [], project.output.coverage ?? []);
			project.output.actions = actions;
			record.status = "done";
			record.tokens = 0;
			record.note = `Derived (0 tokens): ${actions.filter((action) => action.action === "write").length} write · ${actions.filter((action) => action.action === "refresh").length} refresh · ${actions.filter((action) => action.action === "skip").length} skip · ${skipped} merged away.`;
			record.startedAt ||= now;
			record.finishedAt = now;
			record.durationMs = 30;
			continue;
		}
		if (!chat) {
			record.status = "failed";
			record.error = NO_RESEARCH_KEY;
			project.status = projectStatus(project);
			break;
		}
		record.status = "running";
		record.startedAt = now;
		record.attempts += 1;
		const validateFor = (schema, name) => (value) => {
			const parsed = schema.safeParse(value);
			return parsed.success ? {
				ok: true,
				value: parsed.data
			} : {
				ok: false,
				error: `${name} validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`
			};
		};
		try {
			const prompt = stagePrompt(def.key, project, data, site);
			switch (def.key) {
				case "niche": {
					const { value, usage } = await askValidated(chat, prompt, "R1 Niche understanding", validateFor(nicheSchema, "R1"));
					project.output.niche = value;
					record.tokens = usage.total;
					break;
				}
				case "audience": {
					const { value, usage } = await askValidated(chat, prompt, "R2 Audience map", validateFor(audienceSchema, "R2"));
					project.output.audience = value.personas;
					record.tokens = usage.total;
					break;
				}
				case "problem": {
					const { value, usage } = await askValidated(chat, prompt, "R3 Problem map", validateFor(problemSchema, "R3"));
					project.output.problems = value.problems;
					record.tokens = usage.total;
					break;
				}
				case "topic-universe": {
					const { value, usage } = await askValidated(chat, prompt, "R4 Topic universe", validateFor(universeSchema, "R4"));
					project.output.topicUniverse = value;
					record.tokens = usage.total;
					break;
				}
				case "query-expansion": {
					const { value, usage } = await askValidated(chat, prompt, "R5 Query expansion", validateFor(expansionSchema, "R5"));
					project.output.queries = value.queries.map((row, index) => ({
						id: `rq_${hashStr(`${project.id}:${index}:${row.query}`).toString(36)}`,
						query: row.query,
						topic: row.topic,
						status: "keep"
					}));
					record.tokens = usage.total;
					break;
				}
				case "intent-class": {
					const { value, usage } = await askValidated(chat, prompt, "R6 Intent classification", validateFor(intentSchema, "R6"));
					const intents = value.intents;
					const lookup = new Map(intents.map((row) => [row.query.toLowerCase().trim(), row.intent]));
					project.output.queries = (project.output.queries ?? []).map((query) => ({
						...query,
						intent: lookup.get(query.query.toLowerCase().trim())
					}));
					record.tokens = usage.total;
					break;
				}
				case "coverage": {
					const { value, usage } = await askValidated(chat, prompt, "R8 Existing coverage mapping", validateFor(coverageSchema, "R8"));
					const mapped = value.mapped;
					const queries = project.output.queries ?? [];
					const match = (needle) => queries.find((query) => query.query.toLowerCase().trim() === needle.toLowerCase().trim());
					project.output.coverage = mapped.map((row) => {
						const hit = match(row.query);
						return {
							queryId: hit?.id ?? `uq_${hashStr(`${project.id}:${row.query}`).toString(36)}`,
							query: hit?.query ?? row.query,
							state: row.state,
							evidence: row.evidence
						};
					});
					record.tokens = usage.total;
					break;
				}
				case "cluster-construction": {
					const { value, usage } = await askValidated(chat, prompt, "R9 Cluster construction", validateFor(clusterSchema, "R9"));
					const shaped = value.clusters.map((cluster) => ({
						id: `rc_${hashStr(`${project.id}:${cluster.title}`).toString(36)}`,
						title: cluster.title,
						angle: cluster.angle,
						queries: (cluster.queries ?? []).slice(0, 8)
					}));
					project.output.clusters = shapeClusters(shaped);
					record.tokens = usage.total;
					break;
				}
				case "priority": {
					const { value, usage } = await askValidated(chat, prompt, "R11 Strategic priority inputs", validateFor(prioritySchema, "R11"));
					project.output.priority = value;
					record.tokens = usage.total;
					break;
				}
			}
			record.status = "done";
			record.finishedAt = now;
			record.error = void 0;
			record.durationMs = Math.max(50, record.tokens ? 600 : 0);
		} catch (error) {
			record.status = "failed";
			record.error = error instanceof Error ? error.message : String(error);
			record.finishedAt = now;
			break;
		}
	}
	project.stagesCompleted = project.stages.filter((stage) => stage.status === "done").length;
	project.status = projectStatus(project);
	return data;
}
/** R9 output sanity: ≥0.88-distinct titles (lexical jaccard proxy on token overlap). */
function shapeClusters(clusters) {
	const kept = [];
	for (const cluster of clusters) {
		const tokens = new Set(cluster.title.toLowerCase().split(/\W+/).filter(Boolean));
		if (!kept.find((existing) => {
			const other = new Set(existing.title.toLowerCase().split(/\W+/).filter(Boolean));
			const shared = [...tokens].filter((token) => other.has(token)).length;
			const union = (/* @__PURE__ */ new Set([...tokens, ...other])).size;
			return union > 0 && shared / union > .88;
		})) kept.push(cluster);
	}
	return kept.slice(0, 8);
}
/** Reset only failed stages (live contract: retry continues from what is missing). */
function rerunFailedStages(data, projectId, stageKey) {
	const project = data.research.find((item) => item.id === projectId);
	if (!project || project.archived) return null;
	let changed = false;
	for (const record of project.stages) {
		if (record.status !== "failed") continue;
		if (stageKey && record.key !== stageKey) continue;
		record.status = "pending";
		record.error = void 0;
		changed = true;
	}
	return changed ? data : null;
}
/**
* Turn a research project into a review-status Topic Plan using the model-built
* topic universe (pillar + 6–10 clusters) instead of the template generator.
*/
function planFromResearch(data, projectId, now) {
	const project = data.research.find((item) => item.id === projectId);
	if (!project) return { error: "Research project not found." };
	const universe = project.output.topicUniverse;
	const clustersOut = project.output.clusters ?? [];
	if (!universe || clustersOut.length < 2) return { error: "The research has not produced a topic universe and clusters yet (R4 + R9 must be done)." };
	const planId = uid("plan");
	data.plans.unshift({
		id: planId,
		siteId: project.siteId,
		topic: project.niche,
		pillarTitle: universe.pillar,
		pillarAngle: universe.clusters.find((cluster) => cluster.angle)?.angle ?? researchAngle(project),
		clusters: clustersOut.map((cluster) => ({
			id: uid("clu"),
			title: cluster.title,
			angle: cluster.angle || researchAngle(project),
			excluded: false,
			source: "ai",
			selected: true
		})),
		status: "review",
		createdAt: now
	});
	return { planId };
}
function researchAngle(project) {
	return `Written for ${project.output.audience?.[0]?.persona ?? "the reader deciding what to do next"}, grounded in the ${project.niche} research notes.`;
}
function digest(body) {
	return hashStr(JSON.stringify(body)).toString(16).padStart(8, "0");
}
function packWorkspace(data, siteId) {
	const site = data.sites.find((item) => item.id === siteId);
	if (!site) return null;
	const clean = {
		...site,
		ghost: {
			...site.ghost,
			adminKey: void 0
		},
		providers: site.providers.map((provider) => ({
			...provider,
			ftp: provider.ftp ? {
				...provider.ftp,
				password: ""
			} : provider.ftp,
			api: provider.api ? {
				...provider.api,
				token: void 0
			} : provider.api
		}))
	};
	const articles = data.articles.filter((item) => item.siteId === siteId);
	const body = {
		kind: "gaw-workspace-backup",
		version: 1,
		exportedAt: Date.now(),
		site: clean,
		articles,
		runs: data.runs.filter((item) => item.siteId === siteId),
		jobs: data.jobs.filter((item) => item.siteId === siteId),
		plans: data.plans.filter((item) => item.siteId === siteId),
		calendars: data.calendars.filter((item) => item.siteId === siteId),
		research: data.research.filter((item) => item.siteId === siteId),
		authors: data.authors.filter((item) => item.siteId === siteId),
		builds: data.builds.filter((item) => item.siteId === siteId),
		deploys: data.deploys.filter((item) => item.siteId === siteId),
		audits: data.audits.filter((item) => item.siteId === siteId),
		events: data.events.filter((item) => item.siteId === siteId)
	};
	const checksum = digest(body);
	const file = {
		...body,
		checksum
	};
	const payload = JSON.stringify(file);
	const edges = articles.reduce((sum, article) => sum + article.links.length, 0);
	return {
		payload,
		checksum,
		articles: articles.length,
		edges,
		bytes: payload.length,
		siteName: site.name,
		file
	};
}
function readBackup(raw) {
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			ok: false,
			error: "Could not read that backup file."
		};
	}
	if (parsed?.kind !== "gaw-workspace-backup" || !parsed.site?.id || !parsed.site.name) return {
		ok: false,
		error: "That file is not a workspace backup."
	};
	const { checksum, ...body } = parsed;
	if (checksum !== digest(body)) return {
		ok: false,
		error: "Checksum failed. Create a new backup.",
		file: parsed
	};
	return {
		ok: true,
		file: parsed
	};
}
var VAULT_ITERATIONS = 6e5;
var MARK = "gaw-vault-ok";
var sessionKey = null;
var vaultOn = false;
function hasSessionKey() {
	return sessionKey !== null;
}
function clearSessionKey() {
	sessionKey = null;
}
function writesMustEncrypt() {
	return vaultOn;
}
function markVaultOn() {
	vaultOn = true;
}
function copy(bytes) {
	return new Uint8Array(bytes);
}
function bytesToB64(bytes) {
	let binary = "";
	for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
	return btoa(binary);
}
function b64ToBytes(value) {
	const binary = atob(value);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
	return out;
}
async function deriveKey(passphrase, salt, iterations = VAULT_ITERATIONS) {
	const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
	return crypto.subtle.deriveKey({
		name: "PBKDF2",
		salt: copy(salt),
		iterations,
		hash: "SHA-256"
	}, base, {
		name: "AES-GCM",
		length: 256
	}, false, ["encrypt", "decrypt"]);
}
async function encryptBytes(key, bytes) {
	const iv = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(12));
	return {
		iv,
		cipher: new Uint8Array(await crypto.subtle.encrypt({
			name: "AES-GCM",
			iv: copy(iv)
		}, key, copy(bytes)))
	};
}
async function decryptBytes(key, iv, cipher) {
	try {
		const plain = await crypto.subtle.decrypt({
			name: "AES-GCM",
			iv: copy(iv)
		}, key, copy(cipher));
		return new Uint8Array(plain);
	} catch {
		return null;
	}
}
async function createVaultMeta(passphrase) {
	const salt = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16));
	const key = await deriveKey(passphrase, salt, VAULT_ITERATIONS);
	const sealed = await encryptBytes(key, new TextEncoder().encode(MARK));
	return {
		key,
		meta: {
			v: 1,
			iterations: VAULT_ITERATIONS,
			salt: bytesToB64(salt),
			iv: bytesToB64(sealed.iv),
			verifier: bytesToB64(sealed.cipher)
		}
	};
}
async function passphraseMatches(passphrase, meta) {
	const key = await deriveKey(passphrase, b64ToBytes(meta.salt), meta.iterations || 6e5);
	const plain = await decryptBytes(key, b64ToBytes(meta.iv), b64ToBytes(meta.verifier));
	if (!plain) return null;
	if (new TextDecoder().decode(plain) !== MARK) return null;
	return key;
}
function adoptKey(key) {
	sessionKey = key;
	vaultOn = true;
}
async function sealState(plain) {
	if (!sessionKey) return plain;
	const sealed = await encryptBytes(sessionKey, new TextEncoder().encode(plain));
	return `gaw1.${bytesToB64(sealed.iv)}.${bytesToB64(sealed.cipher)}`;
}
async function openState(saved) {
	if (!saved.startsWith("gaw1.")) return saved;
	if (!sessionKey) return null;
	const parts = saved.split(".");
	if (parts.length !== 3) return null;
	const plain = await decryptBytes(sessionKey, b64ToBytes(parts[1]), b64ToBytes(parts[2]));
	return plain ? new TextDecoder().decode(plain) : null;
}
var DB = "gaw-db";
var STORE = "kv";
var allowWrite = false;
function allowPersistWrites() {
	allowWrite = true;
}
function openDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
async function idbGet(name) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const request = db.transaction(STORE, "readonly").objectStore(STORE).get(name);
		request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
		request.onerror = () => reject(request.error);
	});
}
async function idbSet(name, value) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(value, name);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
async function readRaw(name) {
	try {
		const saved = await idbGet(name);
		if (saved) return saved;
	} catch {}
	try {
		return localStorage.getItem(name);
	} catch {
		return null;
	}
}
async function writeRaw(name, value) {
	try {
		await idbSet(name, value);
	} catch {}
	try {
		localStorage.setItem(name, value);
	} catch {}
}
/**
* Coalescing persistence queue: every store set() used to serialize the ENTIRE
* state graph to IndexedDB AND localStorage and re-encrypt it, which blocked
* interactions for seconds while a run was active.
*
* Hotfix: bursts now collapse into one serial writer — the LATEST value per
* name replaces anything still queued, so a rapid run tick costs one write.
* Crucially the write starts IMMEDIATELY (no trailing delay): a full page
* unload can only ever race the single in-flight transaction, never an
* 800 ms window, so saved keys and runs survive reloads.
*/
var queue = [];
var draining = false;
async function drainQueue() {
	if (draining) return;
	draining = true;
	try {
		while (queue.length) {
			const item = queue.shift();
			try {
				const sealed = await sealState(item.payload);
				await writeRaw(item.name, sealed);
			} catch {}
		}
	} finally {
		draining = false;
		if (queue.length) drainQueue();
	}
}
var durableStorage = {
	getItem: async (name) => {
		const saved = await readRaw(name);
		if (!saved) return null;
		return openState(saved);
	},
	setItem: async (name, value) => {
		if (!allowWrite) return;
		if (writesMustEncrypt() && !hasSessionKey()) return;
		const existing = queue.find((item) => item.name === name);
		if (existing) existing.payload = value;
		else queue.push({
			name,
			payload: value
		});
		drainQueue();
	},
	removeItem: async (name) => {
		const index = queue.findIndex((item) => item.name === name);
		if (index >= 0) queue.splice(index, 1);
		if (!allowWrite) return;
		try {
			const db = await openDb();
			await new Promise((resolve, reject) => {
				const tx = db.transaction(STORE, "readwrite");
				tx.objectStore(STORE).delete(name);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		} catch {}
		try {
			localStorage.removeItem(name);
		} catch {}
	}
};
var VAULT_KEY = "gaw-vault";
var phase = "checking";
var listeners = /* @__PURE__ */ new Set();
function publish(next) {
	phase = next;
	for (const listener of listeners) listener(phase);
}
function vaultPhase() {
	return phase;
}
function onVaultPhase(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
async function readVaultMeta() {
	const raw = await readRaw(VAULT_KEY);
	if (!raw) return null;
	try {
		const meta = JSON.parse(raw);
		if (meta?.v !== 1 || !meta.salt || !meta.iv || !meta.verifier) return null;
		return meta;
	} catch {
		return null;
	}
}
async function loadVaultGate() {
	if (phase === "open" || phase === "locked") return;
	const meta = await readVaultMeta();
	if (meta) markVaultOn();
	publish(meta ? "locked" : "open");
}
async function lockWithPassphrase(passphrase) {
	const { meta, key } = await createVaultMeta(passphrase);
	const encoded = JSON.stringify(meta);
	if (encoded.includes(passphrase)) throw new Error("Refusing to store the passphrase.");
	await writeRaw(VAULT_KEY, encoded);
	adoptKey(key);
	if (phase === "checking") publish("open");
}
async function unlockVault(passphrase) {
	const meta = await readVaultMeta();
	if (!meta) return "No lock is set on this browser.";
	const key = await passphraseMatches(passphrase, meta);
	if (!key) return "That passphrase does not open this studio.";
	adoptKey(key);
	publish("open");
	return null;
}
function lockStudio() {
	clearSessionKey();
	publish("locked");
}
var defaults = {
	modelKeyId: "",
	publishAs: "draft",
	tone: "clear, specific, no hype",
	sections: 5,
	sectionImages: 2,
	linkIntensity: "standard",
	voice: "A working editor. Short sentences. No borrowed statistics.",
	imageProvider: "bing",
	bannedPhrases: [],
	brandFacts: [],
	pov: "third-person",
	readingLevel: "general"
};
function providers() {
	return [
		{
			id: "cloudflare",
			name: "Cloudflare Pages",
			capability: "Not yet wired — roadmap",
			status: "not_connected",
			hint: ""
		},
		{
			id: "github",
			name: "GitHub Pages",
			capability: "Not yet wired — roadmap",
			status: "not_connected",
			hint: ""
		},
		{
			id: "vercel",
			name: "Vercel",
			capability: "Not yet wired — roadmap",
			status: "not_connected",
			hint: ""
		},
		{
			id: "cpanel",
			name: "cPanel hosting",
			capability: "Explicit-TLS FTPS",
			status: "not_connected",
			hint: ""
		}
	];
}
function freshGhost() {
	return {
		mode: "off",
		status: "disconnected",
		url: "",
		keyHint: "",
		version: "",
		corpus: "EMPTY",
		inventory: []
	};
}
/**
* Production initial state: ZERO demo workspaces, demo articles, demo runs, or
* dummy plans. A fresh install (or a fresh incognito window on a fresh server
* store) starts completely empty — only workspaces explicitly created by the
* user exist. The shell redirects to the workspace onboarding when this state
* has no sites, and the server `.data/appstate.json` store is hydrated on boot.
*/
function emptyPersisted() {
	return {
		activeSiteId: "",
		sites: [],
		runs: [],
		jobs: [],
		articles: [],
		plans: [],
		events: [],
		keys: [],
		builds: [],
		deploys: [],
		audits: [],
		activity: [],
		account: {
			name: "",
			email: "",
			emailVerified: false,
			adminApproved: false,
			sessions: [{
				id: "ses_now",
				label: "This browser",
				current: true,
				seenAt: Date.now()
			}]
		},
		defaults,
		ideas: null,
		notice: null,
		authors: [],
		firecrawl: {
			secret: "",
			hint: ""
		},
		calendars: [],
		research: [],
		workerPaused: false,
		worker: {
			lastBeatAt: 0,
			online: false,
			activeJobs: 0,
			source: "browser"
		},
		backups: [],
		corpus: [],
		limits: { ...DEFAULT_LIMITS },
		webSearch: {
			mode: "off",
			tavilyKeys: [],
			firecrawlKeys: [],
			tavilyCursor: 0,
			firecrawlCursor: 0
		}
	};
}
function snap(s) {
	return {
		activeSiteId: s.activeSiteId,
		sites: s.sites,
		runs: s.runs,
		jobs: s.jobs,
		articles: s.articles,
		plans: s.plans,
		events: s.events,
		keys: s.keys,
		builds: s.builds,
		deploys: s.deploys,
		audits: s.audits,
		activity: s.activity,
		account: s.account,
		defaults: s.defaults,
		ideas: s.ideas,
		notice: s.notice,
		authors: s.authors,
		firecrawl: s.firecrawl,
		calendars: s.calendars,
		research: s.research,
		workerPaused: s.workerPaused,
		worker: s.worker,
		backups: s.backups,
		corpus: s.corpus,
		limits: s.limits,
		webSearch: s.webSearch
	};
}
function siteOf(data) {
	return data.sites.find((site) => site.id === data.activeSiteId) ?? data.sites[0];
}
function addMissing(have, incoming) {
	const ids = new Set(have.map((row) => row.id));
	return [...have, ...(incoming ?? []).filter((row) => row?.id && !ids.has(row.id))];
}
function mergeBackup(state, file) {
	const site = {
		...file.site,
		ghost: {
			...file.site.ghost,
			adminKey: void 0
		}
	};
	const exists = state.sites.some((item) => item.id === site.id);
	return {
		...state,
		sites: exists ? state.sites : [...state.sites, site],
		activeSiteId: state.activeSiteId || site.id,
		articles: addMissing(state.articles, file.articles),
		runs: addMissing(state.runs, file.runs),
		jobs: addMissing(state.jobs, file.jobs),
		plans: addMissing(state.plans, file.plans),
		calendars: addMissing(state.calendars, file.calendars?.map((calendar) => migrateCalendar(calendar))),
		research: addMissing(state.research, file.research).map((project) => normalizeResearchProject(project)),
		authors: addMissing(state.authors, file.authors).map((author) => normalizeAuthorProfile(author)),
		builds: addMissing(state.builds, file.builds),
		deploys: addMissing(state.deploys, file.deploys),
		audits: addMissing(state.audits, file.audits),
		events: addMissing(state.events, file.events)
	};
}
/** Rule 6: stable-per-tab lease id (a reload keeps its identity within the session). */
function leaseTickId() {
	const key = "__gawLeaseTick";
	const global = globalThis;
	if (!global[key]) global[key] = `tick_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
	return String(global[key]);
}
/** Earliest scheduled write/publish time across a site's calendars (heartbeat detail). */
function nextCalendarPulseAt(calendars, siteId) {
	const times = calendars.filter((calendar) => calendar.siteId === siteId).flatMap((calendar) => calendar.items.filter((item) => item.status === "SCHEDULED" || item.status === "READY").map((item) => item.status === "READY" ? item.publishAt : item.writeAt));
	return times.length ? Math.min(...times) : void 0;
}
function researchNoticeText(project) {
	if (project.status === "ready") return `Research READY · all 11 stages complete for “${project.niche}”.`;
	if (project.status === "failed") return `Research failed at “${project.stages.find((stage) => stage.status === "failed")?.name ?? project.niche}”. Retry continues from what is missing.`;
	const failedStage = project.stages.find((stage) => stage.status === "failed");
	return failedStage ? `Research PARTIAL · ${project.stagesCompleted}/11 stages · stopped safely at ${failedStage.name}: ${failedStage.error ?? "stage failed"}.` : `Research PARTIAL · ${project.stagesCompleted}/11 stages complete.`;
}
var STALL_TIMEOUT_MS = 12e5;
/**
* Loop-hotfix watchdog: a job whose current stage has been "running" far past
* any real model call is stuck forever (a dead endpoint, a lost lease handoff,
* a tab throttled by the browser). It keeps `needsWork()` true every tick, so
* the worker churns the whole store at 2.5x/sec — the nested-update storm
* behind "Maximum update depth exceeded". Fail the job honestly once.
*/
function failStalledJobs(state) {
	const now = Date.now();
	let changed = false;
	const next = structuredClone(snap(state));
	for (const job of next.jobs) {
		if (job.status !== "running") continue;
		const stage = job.stages[job.stageIndex];
		if (!stage || stage.status !== "running") continue;
		if (stage.startedAt && now - stage.startedAt < STALL_TIMEOUT_MS) continue;
		stage.status = "failed";
		stage.error = "Watchdog: stage stalled over 20 min. Job failed — retry from the run or article page.";
		stage.finishedAt = now;
		job.status = "failed";
		job.modelError = stage.error;
		changed = true;
	}
	if (!changed) return null;
	return next;
}
function backupNotice(state, file) {
	const addedArticles = file.articles.filter((article) => !state.articles.some((have) => have.id === article.id)).length;
	return state.sites.some((site) => site.id === file.site.id) ? `Restored ${addedArticles} missing articles into ${file.site.name}. Existing posts were kept. Reconnect Ghost if this is a new browser.` : `Workspace "${file.site.name}" added. ${addedArticles} articles restored. Reconnect Ghost — secrets are not in the file.`;
}
var advancing = false;
var useApp = create()(persist((set, get) => ({
	...emptyPersisted(),
	tick: () => {
		if (advancing) return;
		const now = Date.now();
		if (get().workerPaused) return;
		advancing = true;
		(async () => {
			try {
				const current = get();
				const siteId = current.activeSiteId;
				if (!siteId) return;
				const activeJobs = current.jobs.filter((job) => job.status === "running").length;
				const nextPulse = nextCalendarPulseAt(current.calendars, siteId);
				const unstuck = failStalledJobs(current);
				if (unstuck) set((cur) => ({
					...cur,
					...unstuck,
					...mergePersisted(cur, unstuck, CHURNED_COLLECTIONS),
					notice: {
						tone: "warn",
						text: "A stalled job was failed by the watchdog (stage stuck over 20 min). Retry it from the run page."
					}
				}));
				const busyNow = needsWork(current, now);
				const tickId = leaseTickId();
				const claimed = await workerClaimLease({ data: {
					siteId,
					tickId,
					activeJobs,
					nextCalendarPulseAt: nextPulse,
					ttlMs: busyNow ? 45e3 : 15e3
				} });
				if (!claimed.lease.granted) {
					const worker = get().worker;
					if (worker.lastBeatAt !== claimed.lastBeatAt || worker.online !== claimed.online || worker.activeJobs !== claimed.activeJobs || worker.nextCalendarPulseAt !== claimed.nextCalendarPulseAt) set((cur) => ({
						...cur,
						worker: {
							...cur.worker,
							lastBeatAt: claimed.lastBeatAt,
							online: claimed.online,
							activeJobs: claimed.activeJobs,
							nextCalendarPulseAt: claimed.nextCalendarPulseAt,
							source: "server"
						}
					}));
					return;
				}
				let base = current;
				if (needsWork(current, now)) {
					const advanced = await advance(snap(current), now, {
						chat: chatTransport,
						images: imageTransport,
						provider: embeddingProvider(usableKey(snap(current), void 0, now) ?? void 0).provider,
						commit: (patchState) => {
							useApp.setState((cur) => ({
								...cur,
								...patchState,
								...mergePersisted(cur, patchState, CHURNED_COLLECTIONS)
							}));
						}
					});
					base = {
						...current,
						...advanced,
						...mergePersisted(current, advanced, CHURNED_COLLECTIONS)
					};
				}
				const pulsed = await pulseCalendars(snap(base), now);
				const afterPulse = pulsed ? {
					...base,
					...pulsed,
					...mergePersisted(base, pulsed, CHURNED_COLLECTIONS)
				} : base;
				const beat = await workerHeartbeat({ data: {
					siteId,
					tickId,
					activeJobs: afterPulse.jobs.filter((job) => job.status === "running").length,
					nextCalendarPulseAt: nextCalendarPulseAt(afterPulse.calendars, siteId),
					ttlMs: busyNow ? 45e3 : 15e3
				} });
				const workerBeat = {
					lastBeatAt: beat.lastBeatAt,
					online: beat.online,
					activeJobs: beat.activeJobs,
					nextCalendarPulseAt: beat.nextCalendarPulseAt,
					source: "server",
					leaseHolder: beat.lease.holder,
					leaseExpiresAt: beat.lease.expiresAt
				};
				const cur = get();
				const worker = cur.worker;
				const next = worker.lastBeatAt !== workerBeat.lastBeatAt || worker.online !== workerBeat.online || worker.activeJobs !== workerBeat.activeJobs || worker.nextCalendarPulseAt !== workerBeat.nextCalendarPulseAt || worker.leaseHolder !== workerBeat.leaseHolder || worker.leaseExpiresAt !== workerBeat.leaseExpiresAt ? { worker: {
					...worker,
					...workerBeat
				} } : {};
				const merged = mergePersisted(cur, afterPulse, CHURNED_COLLECTIONS);
				for (const key of CHURNED_COLLECTIONS) {
					const mergedList = merged[key];
					if (mergedList !== void 0) next[key] = mergedList;
				}
				for (const key of [
					"activeSiteId",
					"sites",
					"keys",
					"account",
					"defaults",
					"ideas",
					"notice",
					"firecrawl",
					"workerPaused",
					"limits",
					"webSearch"
				]) if (afterPulse[key] !== current[key] && cur[key] === current[key]) next[key] = afterPulse[key];
				if (Object.keys(next).length) set(next);
			} catch (error) {
				console.error("[tick] worker loop failed:", error);
			} finally {
				advancing = false;
			}
		})();
	},
	clearNotice: () => set({ notice: null }),
	setSite: (id) => set({ activeSiteId: id }),
	queueKeywords: async (input) => {
		const s = get();
		const site = s.sites.find((item) => item.id === s.activeSiteId);
		const keyId = input.modelKeyId === "default" ? site?.voice.modelKeyId : input.modelKeyId;
		const result = await submitKeywords(snap(s), {
			...input,
			siteId: s.activeSiteId,
			now: Date.now(),
			provider: embeddingProvider(s.keys.find((key) => key.id === keyId)).provider
		});
		set((cur) => {
			if (result.error && !result.runId) return {
				...cur,
				notice: {
					tone: "danger",
					text: result.error
				}
			};
			return {
				...cur,
				...result.data,
				...mergePersisted(cur, result.data, CHURNED_COLLECTIONS),
				notice: result.error ? {
					tone: "danger",
					text: result.error
				} : result.data.notice
			};
		});
		return result.runId;
	},
	runIdeas: (niche, count = 8) => {
		(async () => {
			const s = get();
			const site = s.sites.find((item) => item.id === s.activeSiteId);
			const snapshot = snap(s);
			const key = usableKey(snapshot, site?.voice.modelKeyId, Date.now());
			let liveIdeas;
			if (key && keyCallsModel(key)) {
				const generated = await generateIdeas({ data: {
					baseUrl: key.baseUrl,
					apiKey: key.secret,
					model: key.model,
					niche,
					corpus: corpusFor(snapshot, s.activeSiteId).map((item) => ({
						title: item.title,
						slug: item.slug,
						permalink: item.permalink
					}))
				} });
				if (!generated.ok) {
					set((cur) => ({
						...cur,
						notice: {
							tone: "danger",
							text: generated.error
						}
					}));
					return;
				}
				liveIdeas = {
					ideas: generated.ideas,
					usage: generated.usage
				};
			}
			const result = await suggestIdeas(snapshot, s.activeSiteId, niche, Date.now(), count, embeddingProvider(key ?? void 0).provider, liveIdeas);
			set((cur) => result.error ? {
				...cur,
				notice: {
					tone: "danger",
					text: result.error
				}
			} : {
				...cur,
				...result.data
			});
		})();
	},
	makePlan: (topic) => {
		let planId;
		set((s) => {
			const result = generatePlan(snap(s), s.activeSiteId, topic, Date.now());
			planId = result.planId;
			if (result.error) return {
				...s,
				notice: {
					tone: "danger",
					text: result.error
				}
			};
			return {
				...s,
				...result.data
			};
		});
		return planId;
	},
	failPlan: (topic, error) => {
		const planId = uid("plan");
		set((s) => ({
			...s,
			plans: [{
				id: planId,
				siteId: s.activeSiteId,
				topic,
				pillarTitle: topic,
				pillarAngle: "Plan failed before queueing.",
				clusters: [],
				status: "failed",
				error,
				createdAt: Date.now()
			}, ...s.plans],
			notice: {
				tone: "danger",
				text: error
			}
		}));
		return planId;
	},
	installModelPlan: (topic, pillar, clusters) => {
		let planId;
		let error;
		set((s) => {
			const result = acceptModelPlan(snap(s), s.activeSiteId, topic, pillar, clusters, Date.now());
			planId = result.planId;
			error = result.error;
			if (result.error) return {
				...s,
				notice: {
					tone: "danger",
					text: result.error
				}
			};
			return {
				...s,
				...result.data
			};
		});
		return {
			planId,
			error
		};
	},
	setClusterExcluded: (planId, clusterId, excluded) => set((s) => ({
		...s,
		plans: s.plans.map((plan) => plan.id !== planId || plan.status !== "review" ? plan : {
			...plan,
			clusters: plan.clusters.map((c) => c.id === clusterId ? {
				...c,
				excluded,
				selected: !excluded
			} : c)
		})
	})),
	queueTopic: async (planId, opts) => {
		const s = get();
		const draft = snap(s);
		const plan = draft.plans.find((item) => item.id === planId);
		if (plan && plan.status === "review") {
			if (plan.clusters.some((cluster) => cluster.selected === false)) for (const cluster of plan.clusters) cluster.excluded = cluster.selected === false || cluster.excluded;
		}
		const site = draft.sites.find((item) => item.id === (plan?.siteId ?? s.activeSiteId));
		const keyId = opts?.modelKeyId && opts.modelKeyId !== "default" ? opts.modelKeyId : site?.voice.modelKeyId;
		const result = await queuePlan(draft, planId, Date.now(), {
			...opts,
			provider: embeddingProvider(draft.keys.find((key) => key.id === keyId)).provider
		});
		set((cur) => result.error ? {
			...cur,
			notice: {
				tone: "danger",
				text: result.error
			}
		} : {
			...cur,
			...result.data,
			...mergePersisted(cur, result.data, CHURNED_COLLECTIONS)
		});
		return result.runId;
	},
	stopRun: (runId) => set((s) => ({
		...s,
		...cancelRun(snap(s), runId, Date.now())
	})),
	retryJob: (jobId, fromScratch = false) => set((s) => {
		const result = restartJob(snap(s), jobId, Date.now(), fromScratch);
		if (result.error) return {
			...s,
			notice: {
				tone: "danger",
				text: result.error
			}
		};
		return {
			...s,
			...result.data
		};
	}),
	variantJob: (jobId) => set((s) => {
		const job = s.jobs.find((item) => item.id === jobId);
		const article = job?.articleId ? s.articles.find((item) => item.id === job.articleId) : void 0;
		if (article) return {
			...s,
			notice: {
				tone: "info",
				text: "Regenerating this article. A new draft is written, then new photos are fetched."
			},
			articles: s.articles.map((item) => item.id !== article.id ? item : {
				...item,
				liveState: "pending",
				liveError: void 0,
				imageState: "pending",
				imageSalt: (item.imageSalt ?? 0) + 1,
				images: item.images.map((image) => ({
					...image,
					src: void 0,
					selected: false,
					remote: void 0
				}))
			})
		};
		const result = regenerateVariant(snap(s), jobId, Date.now());
		if (result.error) return {
			...s,
			notice: {
				tone: "danger",
				text: result.error
			}
		};
		return {
			...s,
			...result.data
		};
	}),
	saveFtp: (providerId, ftp) => {
		let saved = false;
		set((s) => {
			const host = ftp.host.trim();
			const user = ftp.user.trim();
			const current = s.sites.find((site) => site.id === s.activeSiteId)?.providers.find((provider) => provider.id === providerId)?.ftp;
			const password = ftp.password || current?.password || "";
			if (!host || !user || !password) return {
				...s,
				notice: {
					tone: "danger",
					text: "FTP needs a hostname, username, and password before it can be saved."
				}
			};
			saved = true;
			const path = ftp.path.trim() || "/";
			const hint = `${host} · ${user} · ${path}`;
			return {
				...s,
				notice: {
					tone: "ok",
					text: "FTP saved in this browser. Run Test connection before calling it verified."
				},
				sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
					...site,
					publicUrl: ftp.publicUrl?.trim() || site.publicUrl,
					providers: site.providers.map((provider) => provider.id === providerId ? {
						...provider,
						status: provider.status === "verified" ? "verified" : "configured",
						hint,
						ftp: {
							host,
							user,
							path,
							password,
							port: ftp.port || 21,
							publicUrl: ftp.publicUrl?.trim() || "",
							via: ftp.via || current?.via || "ftps"
						}
					} : provider)
				})
			};
		});
		return saved;
	},
	connectStudio: () => set((s) => {
		const now = Date.now();
		return {
			...s,
			notice: {
				tone: "ok",
				text: "Studio ledger connected. Sync inventory before the first run."
			},
			sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
				...site,
				ghost: {
					...site.ghost,
					mode: "studio",
					status: "connected",
					url: site.ghost.url.startsWith("https://") ? site.ghost.url : `studio://${site.name.toLowerCase().replace(/\s+/g, "-")}`,
					keyHint: site.ghost.adminKey ? site.ghost.keyHint : "local demo · Ghost was not read",
					version: site.ghost.adminKey ? site.ghost.version : "local-demo",
					inventorySource: site.ghost.adminKey ? site.ghost.inventorySource : "local-demo",
					lastTestAt: now,
					lastError: void 0
				}
			})
		};
	}),
	disconnectGhost: () => set((s) => ({
		...s,
		notice: {
			tone: "warn",
			text: "Ghost disconnected. New runs are blocked until you reconnect and sync."
		},
		sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
			...site,
			ghost: {
				...site.ghost,
				mode: "off",
				status: "disconnected",
				corpus: "EMPTY",
				version: "",
				keyHint: "",
				url: "",
				adminKey: void 0
			}
		})
	})),
	markLive: (url, version, hint, adminKey) => set((s) => ({
		...s,
		notice: {
			tone: "ok",
			text: adminKey ? `Live Ghost answered · ${version}. The key stays in this browser so publish can upload images and POST once.` : `Live Ghost answered · ${version}. The Admin API key was not stored, so publish stays in the studio ledger.`
		},
		sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
			...site,
			ghost: {
				...site.ghost,
				mode: "live",
				status: "connected",
				url,
				version,
				keyHint: hint,
				adminKey: adminKey || void 0,
				lastTestAt: Date.now(),
				lastError: void 0,
				corpus: "EMPTY"
			}
		})
	})),
	failGhost: (message) => set((s) => ({
		...s,
		notice: {
			tone: "danger",
			text: message
		},
		sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
			...site,
			ghost: {
				...site.ghost,
				status: "error",
				lastError: message
			}
		})
	})),
	beginStudioSync: () => {
		const s = get();
		const site = s.sites.find((item) => item.id === s.activeSiteId);
		if (!site || site.ghost.status !== "connected") {
			set({ notice: {
				tone: "danger",
				text: "Connect Ghost before syncing."
			} });
			return;
		}
		const key = site.ghost.adminKey;
		const origin = site.ghost.url.startsWith("https://") ? site.ghost.url : "";
		if (key && origin) {
			set({
				notice: {
					tone: "info",
					text: "Reading every Ghost page…"
				},
				sites: s.sites.map((item) => item.id !== site.id ? item : {
					...item,
					ghost: {
						...item.ghost,
						corpus: "SYNCING",
						syncReadyAt: void 0,
						lastError: void 0
					}
				})
			});
			(async () => {
				const { syncGhostPosts } = await import("../_libs/_.mjs").then((n) => n.t);
				const result = await syncGhostPosts({ data: {
					url: origin,
					adminKey: key
				} });
				if (!result.ok) {
					get().failGhost(result.error);
					return;
				}
				get().applyLiveInventory(result.posts.map((post) => ({
					...post,
					status: post.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"
				})), result.truncated ? `Ghost import stopped at the page cap · ${result.posts.length} posts. There are more pages on the site.` : void 0);
			})();
			return;
		}
		const now = Date.now();
		const inventory = inventoryFromArticles(s.articles, site.id, now);
		set({
			notice: {
				tone: "warn",
				text: "Local demo. No Ghost Admin key is saved, so this list is the studio's own articles. Ghost was not read."
			},
			sites: s.sites.map((item) => item.id !== site.id ? item : {
				...item,
				ghost: {
					...item.ghost,
					corpus: "COMPLETE",
					syncReadyAt: void 0,
					lastSyncAt: now,
					inventory,
					inventorySource: "local-demo",
					version: item.ghost.version === "studio-ledger" || !item.ghost.version ? "local-demo" : item.ghost.version,
					keyHint: "local demo · Ghost was not read"
				}
			})
		});
	},
	applyLiveInventory: (posts, note) => set((s) => {
		const now = Date.now();
		return {
			...s,
			notice: {
				tone: note ? "warn" : "ok",
				text: note ?? `Ghost inventory synced · ${posts.length} posts across every page. Corpus is COMPLETE.`
			},
			sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
				...site,
				ghost: {
					...site.ghost,
					corpus: "COMPLETE",
					syncReadyAt: void 0,
					lastSyncAt: now,
					inventorySource: "ghost",
					inventory: posts.map((post) => ({
						...post,
						status: post.status,
						syncedAt: now
					}))
				}
			})
		};
	}),
	auditNow: () => {
		(async () => {
			const s = get();
			const site = s.sites.find((item) => item.id === s.activeSiteId);
			const next = await buildAudit(snap(s), s.activeSiteId, Date.now(), embeddingProvider(s.keys.find((key) => key.id === site?.voice.modelKeyId)).provider);
			set((cur) => ({
				...cur,
				...next,
				...mergePersisted(cur, next, CHURNED_COLLECTIONS)
			}));
		})();
	},
	toggleProposal: (auditId, proposalId) => set((s) => ({
		...s,
		audits: s.audits.map((audit) => audit.id !== auditId ? audit : {
			...audit,
			proposals: audit.proposals.map((p) => p.id === proposalId ? {
				...p,
				selected: !p.selected
			} : p)
		})
	})),
	applyProposals: (auditId) => set((s) => ({
		...s,
		...applyAudit(snap(s), auditId, Date.now())
	})),
	patchSite: (patch) => set((s) => ({
		...s,
		sites: s.sites.map((site) => site.id === s.activeSiteId ? {
			...site,
			...patch
		} : site)
	})),
	patchVoice: (patch) => set((s) => ({
		...s,
		sites: s.sites.map((site) => site.id === s.activeSiteId ? {
			...site,
			voice: {
				...site.voice,
				...patch
			}
		} : site)
	})),
	patchDefaults: (patch) => set((s) => ({
		...s,
		defaults: {
			...s.defaults,
			...patch
		}
	})),
	patchAccount: (patch) => set((s) => ({
		...s,
		account: {
			...s.account,
			...patch
		}
	})),
	addKey: (input) => set((s) => {
		const id = uid("key");
		const secret = input.secret?.trim() ?? "";
		const tail = secret ? secret.slice(-4) : id.slice(-4);
		const baseUrl = input.baseUrl?.trim() ?? "";
		const model = input.model.trim() || "custom";
		const providerKind = input.providerKind ?? (baseUrl.includes("openrouter.ai") ? "openrouter" : baseUrl ? "custom" : "openai");
		const custom = providerKind === "custom";
		const catalog = catalogModel(input.catalogId);
		const pricePerM = input.pricePerM ?? (catalog ? blendedPricePerMillion(catalog) : pricePerMillionForModelId(model));
		const nextKey = {
			id,
			provider: input.provider.trim() || "Custom",
			model,
			label: input.label?.trim() || input.provider.trim() || "Custom",
			hint: `••••${tail}`,
			priority: input.priority,
			chat: true,
			semantic: Boolean(embeddingModelFor({
				provider: input.provider.trim(),
				providerKind,
				embeddingModel: input.embeddingModel
			})),
			allowanceUsd: input.allowanceUsd,
			disabled: false,
			pricePerM,
			baseUrl: baseUrl || void 0,
			secret: secret || void 0,
			kind: custom ? "custom" : "studio",
			providerKind,
			catalogId: input.catalogId,
			embeddingModel: input.embeddingModel?.trim() || void 0
		};
		return {
			...s,
			notice: {
				tone: "ok",
				text: custom ? "Custom endpoint saved in this browser. Set the base URL and key, then Test. The key is sent only when you test or generate." : `${input.label?.trim() || input.provider.trim() || "Key"} saved in this browser. It joins the failover pool by priority.`
			},
			keys: [...s.keys, nextKey]
		};
	}),
	toggleKey: (id) => set((s) => ({
		...s,
		keys: s.keys.map((key) => key.id === id ? {
			...key,
			disabled: !key.disabled,
			cooldownUntil: key.disabled ? void 0 : key.cooldownUntil
		} : key)
	})),
	deleteKey: (id) => set((s) => {
		const gone = s.keys.find((key) => key.id === id);
		if (!gone) return s;
		recordPurge("keys", id);
		return {
			...s,
			keys: s.keys.filter((key) => key.id !== id),
			sites: s.sites.map((site) => site.voice.modelKeyId === id ? {
				...site,
				voice: {
					...site.voice,
					modelKeyId: ""
				}
			} : site),
			notice: {
				tone: "warn",
				text: `${gone.label} deleted from this browser. Usage ledger rows stay in Billing; saved runs keep their recorded key id.`
			}
		};
	}),
	patchKey: (id, patch) => set((s) => ({
		...s,
		keys: s.keys.map((key) => key.id === id ? {
			...key,
			...patch
		} : key)
	})),
	patchLimits: (patch) => set((s) => ({
		...s,
		limits: {
			...s.limits,
			...patch
		},
		notice: {
			tone: "ok",
			text: "Scale limits saved. Caps apply to the next run."
		}
	})),
	setWebSearchMode: (mode) => set((s) => ({
		...s,
		webSearch: {
			...s.webSearch,
			mode
		},
		notice: {
			tone: mode === "off" ? "warn" : "ok",
			text: mode === "off" ? "Live web search is off. Research and drafts stay offline." : mode === "auto-fallback" ? "Web search: Auto-Fallback. Tavily runs first, Firecrawl catches failures." : `Web search: ${mode}.`
		}
	})),
	importWebSearchKeys: (provider, raw) => {
		const found = [...new Set(raw.split(/[\s,;]+/).map((item) => item.trim()).filter((item) => item.length >= 8 && !item.startsWith("#")))].slice(0, 500);
		let added = 0;
		set((s) => {
			const list = provider === "tavily" ? s.webSearch.tavilyKeys : s.webSearch.firecrawlKeys;
			const existing = new Set(list.map((key) => key.secret));
			const next = found.filter((secret) => !existing.has(secret)).map((secret) => ({
				id: uid(provider === "tavily" ? "tvly" : "fcrl"),
				hint: `••••${secret.slice(-4)}`,
				secret,
				disabled: false,
				failCount: 0
			}));
			added = next.length;
			const webSearch = provider === "tavily" ? {
				...s.webSearch,
				tavilyKeys: [...s.webSearch.tavilyKeys, ...next].slice(0, 500),
				mode: s.webSearch.mode === "off" ? "tavily" : s.webSearch.mode
			} : {
				...s.webSearch,
				firecrawlKeys: [...s.webSearch.firecrawlKeys, ...next].slice(0, 500),
				mode: s.webSearch.mode === "off" ? "firecrawl" : s.webSearch.mode
			};
			return {
				...s,
				webSearch,
				notice: {
					tone: "ok",
					text: `${provider} pool +${next.length}. Switch is now ${webSearch.mode}.`
				}
			};
		});
		return added;
	},
	clearWebSearchKeys: (provider) => set((s) => ({
		...s,
		webSearch: provider === "tavily" ? {
			...s.webSearch,
			tavilyKeys: [],
			tavilyCursor: 0,
			mode: s.webSearch.mode === "tavily" ? "off" : s.webSearch.mode
		} : {
			...s.webSearch,
			firecrawlKeys: [],
			firecrawlCursor: 0,
			mode: s.webSearch.mode === "firecrawl" ? "off" : s.webSearch.mode
		},
		notice: {
			tone: "warn",
			text: `${provider} keys cleared from this browser.`
		}
	})),
	setWebSearchKey: (id, patch) => set((s) => ({
		...s,
		webSearch: {
			...s.webSearch,
			tavilyKeys: s.webSearch.tavilyKeys.map((key) => key.id === id ? {
				...key,
				...patch
			} : key),
			firecrawlKeys: s.webSearch.firecrawlKeys.map((key) => key.id === id ? {
				...key,
				...patch
			} : key)
		}
	})),
	takeWebSearchKey: (provider) => {
		const cfg = get().webSearch;
		const now = Date.now();
		const list = (provider === "tavily" ? cfg.tavilyKeys : cfg.firecrawlKeys).filter((key) => !key.disabled && key.failCount < 4 && (!key.cooldownUntil || key.cooldownUntil <= now));
		if (!list.length) return null;
		const picked = list[(provider === "tavily" ? cfg.tavilyCursor : cfg.firecrawlCursor) % list.length];
		set((s) => ({ webSearch: provider === "tavily" ? {
			...s.webSearch,
			tavilyCursor: s.webSearch.tavilyCursor + 1
		} : {
			...s.webSearch,
			firecrawlCursor: s.webSearch.firecrawlCursor + 1
		} }));
		return picked;
	},
	setFirecrawl: (secret) => set((s) => {
		const trimmed = secret.trim();
		const nextKeys = trimmed ? [{
			id: uid("fcrl"),
			hint: `••••${trimmed.slice(-4)}`,
			secret: trimmed,
			disabled: false,
			failCount: 0
		}] : [];
		const mode = trimmed ? s.webSearch.mode === "off" ? "firecrawl" : s.webSearch.mode : s.webSearch.mode === "firecrawl" ? "off" : s.webSearch.mode;
		return {
			...s,
			firecrawl: {
				secret: trimmed,
				hint: trimmed ? `••••${trimmed.slice(-4)}` : ""
			},
			webSearch: {
				...s.webSearch,
				firecrawlKeys: nextKeys,
				mode
			},
			notice: {
				tone: "ok",
				text: trimmed ? "Firecrawl key saved in this browser." : "Firecrawl key removed."
			}
		};
	}),
	patchArticle: (id, patch) => set((s) => {
		const current = s.articles.find((article) => article.id === id);
		if (!current) return s;
		if (Object.entries(patch).every(([key, value]) => Object.is(current[key], value))) return s;
		return {
			...s,
			articles: s.articles.map((article) => article.id === id ? {
				...article,
				...patch
			} : article)
		};
	}),
	addExpertAuthor: (niche) => set((s) => {
		const siteId = s.activeSiteId;
		const topic = niche.trim() || s.sites.find((site) => site.id === siteId)?.nicheTag || "general research";
		const author = generateAuthorForTopic(topic, siteId, { niche: s.sites.find((site) => site.id === siteId)?.nicheTag });
		author.origin = "manual";
		return {
			...s,
			authors: [...s.authors, author],
			notice: {
				tone: "ok",
				text: `Generated US expert ${author.name} for “${topic}”. Capacity ${author.articleCount}/${author.maxArticles}.`
			}
		};
	}),
	patchAuthor: (id, patch) => set((s) => ({
		...s,
		authors: s.authors.map((author) => author.id === id ? {
			...author,
			...patch
		} : author)
	})),
	/** Client-side activity note (IndexNow hooks, humanizer policy, engine-adjacent workers). */
	logEvent: (siteId, tone, message) => set((s) => ({
		...s,
		activity: [{
			id: uid("act"),
			at: Date.now(),
			siteId,
			tone,
			message
		}, ...s.activity].slice(0, 500)
	})),
	acceptModelStage: (jobId, stage, text, usage, promptVersion, verifyFlags) => set((s) => ({
		...s,
		jobs: s.jobs.map((job) => job.id !== jobId ? job : {
			...job,
			modelError: void 0,
			modelText: stage === "intent" ? job.modelText : {
				...job.modelText,
				[stage]: text
			},
			modelUsage: {
				...job.modelUsage,
				[stage]: usage
			},
			modelIntent: stage === "intent" ? parseIntentStage(text) : job.modelIntent,
			promptVersions: {
				...job.promptVersions,
				[stage]: promptVersion
			},
			modelVerifyFlags: stage === "revision" ? verifyFlags : job.modelVerifyFlags,
			stages: job.stages.map((row) => row.key === stage ? {
				...row,
				promptVersion
			} : row)
		})
	})),
	failModelStage: (jobId, message) => set((s) => {
		const next = structuredClone(snap(s));
		failJob(next, jobId, message, Date.now());
		return {
			...s,
			...next
		};
	}),
	penalizeKey: (keyId, status, message) => set((s) => {
		const next = structuredClone(snap(s));
		applyKeyPenalty(next, keyId, status, Date.now(), message);
		return {
			...s,
			keys: next.keys,
			activity: next.activity,
			notice: next.notice ?? s.notice
		};
	}),
	clearCooldowns: () => set((s) => {
		const cooled = s.keys.filter((key) => key.cooldownUntil || key.disabled);
		const keys = s.keys.map((key) => key.cooldownUntil || key.disabled ? {
			...key,
			cooldownUntil: void 0,
			disabled: false
		} : key);
		let data = snap({
			...s,
			keys
		});
		const failed = data.jobs.filter((job) => job.status === "failed");
		for (const job of failed) {
			const result = restartJob(data, job.id, Date.now(), false);
			if (!result.error) data = {
				...data,
				...result.data
			};
		}
		return {
			...s,
			keys,
			jobs: data.jobs,
			runs: data.runs,
			events: data.events,
			notice: {
				tone: "ok",
				text: `Recovered ${cooled.length} key${cooled.length === 1 ? "" : "s"} and re-queued ${failed.length} failed job${failed.length === 1 ? "" : "s"}.`
			}
		};
	}),
	ensureAuthors: () => {
		(async () => {
			const s = get();
			const authors = [...s.authors];
			let changed = false;
			const articles = s.articles.map((article) => {
				if (article.authorId && authors.some((author) => author.id === article.authorId)) return article;
				changed = true;
				const author = attachAuthor({ authors }, article.siteId, article.keyword || article.title);
				return {
					...article,
					authorId: author.id,
					authorName: author.name
				};
			});
			let dirty = changed;
			let next = snap(changed ? {
				...s,
				authors,
				articles
			} : s);
			const lifted = liftOpenings(next);
			if (lifted) {
				next = lifted;
				dirty = true;
			}
			const scored = rescoreArticles(next);
			if (scored) {
				next = scored;
				dirty = true;
			}
			const now = Date.now();
			const provider = embeddingProvider(next.keys.find((key) => key.id === next.sites.find((item) => item.id === next.activeSiteId)?.voice.modelKeyId)).provider;
			for (const site of next.sites) {
				const woven = await weaveOrphans(next, site.id, now, true, provider);
				if (woven !== next) dirty = true;
				next = woven;
			}
			const queued = queueMissingPhotos(next);
			if (queued) {
				next = queued;
				dirty = true;
			}
			if (!dirty) return;
			set((cur) => ({
				...cur,
				...next,
				...mergePersisted(cur, next, CHURNED_COLLECTIONS)
			}));
		})();
	},
	weaveLinks: () => {
		(async () => {
			const s = get();
			const site = s.sites.find((item) => item.id === s.activeSiteId);
			const next = await weaveOrphans(snap(s), s.activeSiteId, Date.now(), false, embeddingProvider(s.keys.find((key) => key.id === site?.voice.modelKeyId)).provider);
			set((cur) => ({
				...cur,
				...next,
				...mergePersisted(cur, next, CHURNED_COLLECTIONS)
			}));
		})();
	},
	buildSite: () => set((s) => ({
		...s,
		...manualBuild(snap(s), s.activeSiteId, Date.now())
	})),
	packageBuild: (buildId, providerId) => {
		let deployId;
		set((s) => {
			const result = packageDeploy(snap(s), buildId, Date.now(), { providerId });
			if (result.error) return {
				...s,
				notice: {
					tone: "danger",
					text: result.error
				}
			};
			deployId = result.data.deploys.find((item) => item.buildId === buildId)?.id;
			return {
				...s,
				...result.data,
				...result.hold ? { notice: result.data.notice } : {}
			};
		});
		return deployId;
	},
	acknowledgeRouteDiff: (deployId) => set((s) => {
		const result = resolveRouteDiff(snap(s), deployId, "deploy-anyway", Date.now());
		return result.error ? {
			...s,
			notice: {
				tone: "danger",
				text: result.error
			}
		} : {
			...s,
			...result.data
		};
	}),
	rebuildForRouteDiff: (deployId) => set((s) => {
		const result = resolveRouteDiff(snap(s), deployId, "rebuild", Date.now());
		return result.error ? {
			...s,
			notice: {
				tone: "danger",
				text: result.error
			}
		} : {
			...s,
			...result.data
		};
	}),
	saveProviderApi: (providerId, api) => set((s) => ({
		...s,
		sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
			...site,
			providers: site.providers.map((provider) => provider.id === providerId ? {
				...provider,
				api: {
					...provider.api,
					...api,
					tokenHint: api.token ? `••••${api.token.slice(-4)}` : provider.api?.tokenHint
				},
				status: api.token || provider.api?.token ? "configured" : provider.status,
				hint: api.token || provider.api?.token ? `${provider.name} credentials saved locally. Verify before deploying.` : provider.hint
			} : provider)
		}),
		notice: {
			tone: "ok",
			text: "Credentials saved in this browser only. Verify before deploying."
		}
	})),
	recordProbe: (deployId, ok, detail) => set((s) => ({
		...s,
		...applyProbe(snap(s), deployId, ok, detail, Date.now())
	})),
	verifyProvider: (providerId, hint) => set((s) => {
		const provider = s.sites.find((site) => site.id === s.activeSiteId)?.providers.find((p) => p.id === providerId);
		const apiReady = Boolean(provider?.api?.token);
		if (providerId !== "cpanel" && !apiReady) return {
			...s,
			notice: {
				tone: "warn",
				text: `Save a ${providerId} token first — the adapter refuses to deploy without credentials.`
			}
		};
		return {
			...s,
			notice: {
				tone: "ok",
				text: providerId === "cpanel" ? "cPanel marked verified after the FTP check." : `${providerId} credentials accepted. The next deploy proves the connection with a live probe.`
			},
			sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
				...site,
				providers: site.providers.map((p) => p.id === providerId ? {
					...p,
					status: "verified",
					hint: hint || p.hint
				} : p)
			})
		};
	}),
	disconnectProvider: (providerId) => set((s) => ({
		...s,
		sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
			...site,
			providers: site.providers.map((p) => p.id === providerId ? {
				...p,
				status: "not_connected",
				hint: ""
			} : p)
		})
	})),
	revokeSession: (id) => set((s) => ({
		...s,
		account: {
			...s.account,
			sessions: s.account.sessions.filter((session) => session.current || session.id !== id)
		},
		notice: {
			tone: "ok",
			text: "Session revoked on this browser."
		}
	})),
	confirmPassphrase: async (passphrase) => {
		if (passphrase.trim().length < 8) {
			set((s) => ({
				...s,
				notice: {
					tone: "danger",
					text: "Use at least 8 characters."
				}
			}));
			return;
		}
		try {
			await lockWithPassphrase(passphrase);
		} catch {
			set((s) => ({
				...s,
				notice: {
					tone: "danger",
					text: "The passphrase could not be applied."
				}
			}));
			return;
		}
		set((s) => ({
			...s,
			account: {
				...s.account,
				passwordUpdatedAt: Date.now(),
				sessions: s.account.sessions.filter((session) => session.current)
			},
			notice: {
				tone: "ok",
				text: "Studio encrypted. The passphrase is not stored. A reload asks for it again."
			}
		}));
	},
	markActivityRead: (id) => set((s) => ({
		...s,
		activity: s.activity.map((item) => item.id === id ? {
			...item,
			read: true
		} : item)
	})),
	markActivityReadAll: (siteId) => set((s) => ({
		...s,
		activity: s.activity.map((item) => item.siteId === siteId ? {
			...item,
			read: true
		} : item)
	})),
	resetStudio: () => {
		lastServerGeneration = "";
		resetAppState().then((result) => {
			lastServerGeneration = result.generation || "";
		}).catch(() => {});
		set({
			...emptyPersisted(),
			notice: {
				tone: "info",
				text: "Studio reset. Every workspace, key, and article was cleared across all devices."
			}
		});
	},
	setWorker: (paused) => set((s) => ({
		...s,
		workerPaused: paused,
		notice: {
			tone: paused ? "warn" : "ok",
			text: paused ? "Worker offline. Queued work is kept and continues when the worker is back." : "Worker online."
		}
	})),
	decideJob: (jobId, approve) => set((s) => {
		const result = decideReview(snap(s), jobId, approve, Date.now());
		if (result.error) return {
			...s,
			notice: {
				tone: "danger",
				text: result.error
			}
		};
		return {
			...s,
			...result.data
		};
	}),
	releaseJob: (jobId) => set((s) => {
		const result = releaseHeld(snap(s), jobId, Date.now());
		if (result.error) return {
			...s,
			notice: {
				tone: "danger",
				text: result.error
			}
		};
		const pulsed = {
			...s,
			...result.data
		};
		for (const calendar of pulsed.calendars) for (const item of calendar.items) if (item.jobId === jobId) item.status = result.data.runs.find((run) => run.id === item.runId)?.publishMode === "live" ? "PUBLISHED" : "DRAFT_SAVED";
		return pulsed;
	}),
	saveProvider: (providerId, hint) => set((s) => ({
		...s,
		notice: {
			tone: "info",
			text: "Saved. A provider is deployable only after Test marks it verified."
		},
		sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
			...site,
			providers: site.providers.map((provider) => provider.id === providerId ? {
				...provider,
				status: "configured",
				hint: hint || provider.hint
			} : provider)
		})
	})),
	createWorkspace: (name) => set((s) => {
		const trimmed = name.trim();
		if (trimmed.length < 2) return {
			...s,
			notice: {
				tone: "danger",
				text: "Name the workspace with at least 2 characters."
			}
		};
		const id = uid("site");
		const site = {
			id,
			name: trimmed,
			createdAt: Date.now(),
			staticName: trimmed,
			nicheTag: "notes",
			publicUrl: "",
			logoUrl: "",
			faviconUrl: "",
			robots: "noindex,nofollow",
			footer: "",
			headerMenu: "",
			footerMenu: "",
			headHtml: "",
			bodyEnd: "",
			analyticsSnippet: "",
			autoRebuild: false,
			pendingRebuildAt: null,
			template: "minimal-authority",
			authors: trimmed,
			voice: {
				...s.defaults,
				publishAs: "draft"
			},
			ghost: freshGhost(),
			providers: providers(),
			setupStep: 1,
			setupSkipped: false
		};
		return {
			...s,
			sites: [...s.sites, site],
			activeSiteId: id,
			activity: [{
				id: uid("act"),
				at: Date.now(),
				siteId: id,
				tone: "ok",
				message: `Workspace "${trimmed}" created`
			}, ...s.activity].slice(0, 40),
			notice: {
				tone: "ok",
				text: `Workspace "${trimmed}" created`
			}
		};
	}),
	deleteArticles: (ids) => set((s) => {
		const drop = new Set(ids);
		const removed = s.articles.filter((article) => drop.has(article.id));
		if (!removed.length) return s;
		for (const id of ids) recordPurge("articles", id);
		const slugs = new Set(removed.map((article) => article.slug));
		return {
			...s,
			articles: s.articles.filter((article) => !drop.has(article.id)).map((article) => ({
				...article,
				links: article.links.filter((link) => !slugs.has(link.targetSlug))
			})),
			notice: {
				tone: "warn",
				text: `Deleted ${removed.length} article${removed.length === 1 ? "" : "s"} from this studio. Ghost posts were not touched.`
			}
		};
	}),
	deleteWorkspace: (id) => set((s) => {
		if (s.jobs.some((job) => job.siteId === id && (job.status === "queued" || job.status === "running")) || s.runs.some((run) => run.siteId === id && (run.status === "queued" || run.status === "running"))) return {
			...s,
			notice: {
				tone: "danger",
				text: "Website has active runs, jobs, builds or deploys — cancel them first"
			}
		};
		const sites = s.sites.filter((site) => site.id !== id);
		recordPurge("sites", id);
		const drop = (rows) => rows.filter((row) => row.siteId !== id);
		return {
			...s,
			sites,
			activeSiteId: s.activeSiteId === id ? sites[0]?.id ?? "" : s.activeSiteId,
			runs: drop(s.runs),
			jobs: drop(s.jobs),
			articles: drop(s.articles),
			plans: drop(s.plans),
			calendars: drop(s.calendars),
			research: drop(s.research),
			authors: drop(s.authors),
			builds: drop(s.builds),
			deploys: drop(s.deploys),
			audits: drop(s.audits),
			events: drop(s.events),
			activity: drop(s.activity),
			backups: s.backups.filter((item) => item.siteId !== id),
			ideas: s.ideas?.siteId === id ? null : s.ideas,
			notice: {
				tone: "warn",
				text: "Workspace deleted"
			}
		};
	}),
	createBackup: () => set((s) => {
		const packed = packWorkspace(snap(s), s.activeSiteId);
		if (!packed) return {
			...s,
			notice: {
				tone: "danger",
				text: "No workspace to back up."
			}
		};
		const row = {
			id: uid("bak"),
			siteId: s.activeSiteId,
			siteName: packed.siteName,
			at: Date.now(),
			articles: packed.articles,
			edges: packed.edges,
			bytes: packed.bytes,
			checksum: packed.checksum,
			verified: null,
			payload: packed.payload
		};
		const kb = Math.max(1, Math.round(packed.bytes / 1024));
		return {
			...s,
			backups: [row, ...s.backups].slice(0, 3),
			notice: {
				tone: "ok",
				text: `Backup created — ${packed.articles} articles, ${packed.edges} link edges (${kb} KB)`
			}
		};
	}),
	verifyBackup: (id) => set((s) => {
		const row = s.backups.find((item) => item.id === id);
		if (!row) return s;
		const checked = readBackup(row.payload);
		return {
			...s,
			backups: s.backups.map((item) => item.id === id ? {
				...item,
				verified: checked.ok
			} : item),
			notice: {
				tone: checked.ok ? "ok" : "danger",
				text: checked.ok ? `Verified — ${row.articles} articles, checksum ${row.checksum}` : checked.error
			}
		};
	}),
	restoreWorkspace: (raw) => set((s) => {
		const checked = readBackup(raw);
		if (!checked.ok) return {
			...s,
			notice: {
				tone: "danger",
				text: checked.error
			}
		};
		return {
			...mergeBackup(s, checked.file),
			notice: {
				tone: "ok",
				text: backupNotice(s, checked.file)
			}
		};
	}),
	setSetup: (step) => set((s) => ({
		...s,
		sites: s.sites.map((site) => site.id !== s.activeSiteId ? site : {
			...site,
			setupStep: step,
			setupSkipped: step >= 8 || step < 1
		})
	})),
	setKeyAllowance: (id, allowanceUsd) => set((s) => ({
		...s,
		keys: s.keys.map((key) => key.id === id ? {
			...key,
			allowanceUsd: Math.max(0, allowanceUsd)
		} : key),
		notice: {
			tone: "ok",
			text: "Daily limit saved on this key."
		}
	})),
	createCalendar: (input) => {
		let id;
		set((s) => {
			const name = input.name.trim();
			if (name.length < 2) return {
				...s,
				notice: {
					tone: "danger",
					text: "Name the calendar with at least 2 characters."
				}
			};
			const plan = s.plans.find((item) => item.id === input.planId && item.siteId === s.activeSiteId);
			const fromPlan = plan ? [{
				title: plan.pillarTitle,
				angle: plan.pillarAngle,
				kind: "pillar"
			}, ...plan.clusters.filter((cluster) => !cluster.excluded).map((cluster) => ({
				title: cluster.title,
				angle: cluster.angle,
				kind: "cluster"
			}))] : [];
			const fromLines = (input.lines ?? "").split("\n").map((line) => line.trim()).filter((line) => line.length >= 3).map((title) => ({
				title,
				angle: "Scheduled from the calendar",
				kind: "keyword"
			}));
			const topics = fromPlan.length ? fromPlan : fromLines;
			if (!topics.length) return {
				...s,
				notice: {
					tone: "danger",
					text: "Add a topic plan or one title per line."
				}
			};
			const calendar = buildCalendar({
				siteId: s.activeSiteId,
				name,
				timezone: input.timezone || "UTC",
				activeDays: input.activeDays.length ? input.activeDays : [
					1,
					3,
					5
				],
				articlesPerWeek: input.articlesPerWeek,
				publishTime: input.publishTime,
				generationLeadHours: input.generationLeadHours,
				order: input.order,
				publishMode: input.publishMode ?? "published",
				planningRangeDays: input.planningRangeDays,
				topics,
				sourcePlanId: plan?.id,
				now: Date.now()
			});
			id = calendar.id;
			return {
				...s,
				calendars: [calendar, ...s.calendars],
				notice: {
					tone: "ok",
					text: `${calendar.items.length} articles scheduled (write_at ${calendar.generationLeadHours}h before publish_at). The 3 automation switches start OFF.`
				}
			};
		});
		return id;
	},
	patchCalendar: (id, patch) => set((s) => ({
		...s,
		calendars: s.calendars.map((calendar) => {
			if (calendar.id !== id) return calendar;
			const merged = {
				...calendar,
				...patch
			};
			if (patch.generationLeadHours != null || patch.publishTime != null || patch.activeDays != null || patch.articlesPerWeek != null) merged.items = merged.items.map((item) => item.status === "SCHEDULED" ? {
				...item,
				writeAt: item.publishAt - merged.generationLeadHours * 36e5
			} : item);
			if (patch.autoGenerate || patch.autoPublish || patch.autoReweave) merged.mode = "AUTOMATED";
			else if (calendar.mode === "AUTOMATED" && !merged.autoGenerate && !merged.autoPublish && !merged.autoReweave) merged.mode = "MANUAL";
			return withSummaries(merged);
		})
	})),
	patchCalendarItem: (calendarId, itemId, patch) => set((s) => ({
		...s,
		calendars: s.calendars.map((calendar) => {
			if (calendar.id !== calendarId) return calendar;
			return withSummaries({
				...calendar,
				items: calendar.items.map((item) => {
					if (item.id !== itemId) return item;
					if (item.status !== "SCHEDULED" && item.status !== "SKIPPED") return item;
					const publishAt = patch.publishAt ?? item.publishAt;
					const status = patch.status ?? item.status;
					return {
						...item,
						status,
						publishAt,
						writeAt: publishAt - calendar.generationLeadHours * 36e5
					};
				})
			});
		})
	})),
	removeCalendarItem: (calendarId, itemId) => set((s) => ({
		...s,
		calendars: s.calendars.map((calendar) => calendar.id === calendarId ? withSummaries({
			...calendar,
			items: calendar.items.filter((item) => item.id !== itemId || item.status !== "SCHEDULED" && item.status !== "SKIPPED")
		}) : calendar)
	})),
	writeCalendarItem: (calendarId, itemId) => {
		(async () => {
			const result = await queueCalendarItem(snap(get()), calendarId, itemId, Date.now());
			set((cur) => result.error ? {
				...cur,
				notice: {
					tone: "danger",
					text: result.error
				}
			} : {
				...cur,
				...result.data,
				...mergePersisted(cur, result.data, CHURNED_COLLECTIONS)
			});
		})();
	},
	publishCalendarItem: (calendarId, itemId) => {
		const result = publishCalendarItemNow(snap(get()), calendarId, itemId, Date.now());
		set((cur) => result.error ? {
			...cur,
			notice: {
				tone: "danger",
				text: result.error
			}
		} : {
			...cur,
			...result.data,
			notice: {
				tone: "ok",
				text: cur.calendars.find((calendar) => calendar.id === calendarId)?.publishMode === "draft" ? "Draft saved on the CMS." : "Published to the CMS."
			}
		});
	},
	fillCalendarFromPlan: (calendarId, planId) => set((s) => {
		const calendar = s.calendars.find((item) => item.id === calendarId);
		const plan = s.plans.find((item) => item.id === planId && item.siteId === calendar?.siteId);
		if (!calendar || !plan) return {
			...s,
			notice: {
				tone: "danger",
				text: "That calendar or topic plan is not in this workspace."
			}
		};
		const existing = new Set(calendar.items.map((item) => item.title.toLowerCase()));
		const candidates = [{
			title: plan.pillarTitle,
			angle: plan.pillarAngle,
			kind: "pillar"
		}, ...plan.clusters.filter((cluster) => !cluster.excluded).map((cluster) => ({
			title: cluster.title,
			angle: cluster.angle,
			kind: "cluster"
		}))].filter((topic) => !existing.has(topic.title.toLowerCase()));
		if (!candidates.length) return {
			...s,
			notice: {
				tone: "info",
				text: "Every topic in that plan is already on this calendar."
			}
		};
		const [hour, minute] = calendar.publishTime.split(":").map((part) => Number(part) || 0);
		const after = calendar.items.reduce((max, item) => Math.max(max, item.publishAt), Date.now());
		const slots = publishSlots({
			count: candidates.length,
			days: calendar.activeDays,
			perWeek: calendar.articlesPerWeek,
			hour: hour ?? 9,
			minute: minute ?? 0,
			timeZone: calendar.timezone,
			from: after
		});
		const added = candidates.slice(0, slots.length).map((topic, index) => ({
			id: uid("slot"),
			title: topic.title,
			angle: topic.angle,
			kind: topic.kind,
			publishAt: slots[index],
			writeAt: slots[index] - calendar.generationLeadHours * 36e5,
			status: "SCHEDULED"
		}));
		const unscheduled = candidates.length - added.length;
		return {
			...s,
			calendars: s.calendars.map((item) => item.id === calendarId ? withSummaries({
				...item,
				items: [...item.items, ...added]
			}) : item),
			notice: {
				tone: unscheduled ? "warn" : "ok",
				text: `${added.length} scheduled${unscheduled ? ` · ${unscheduled} unscheduled (beyond the planning window — extend days/week or reschedule)` : ""}.`
			}
		};
	}),
	addResearch: (niche, notes, breadth) => {
		let id;
		set((s) => {
			const site = siteOf(s);
			if (!site) return s;
			if (niche.trim().length < 3) return {
				...s,
				notice: {
					tone: "danger",
					text: "Describe the niche in at least 3 characters."
				}
			};
			const now = Date.now();
			const project = newResearchProject({
				siteId: site.id,
				niche,
				notes,
				breadth: breadth ?? "standard",
				now,
				site,
				data: snap(s)
			});
			id = project.id;
			return {
				...s,
				research: [project, ...s.research],
				notice: {
					tone: "ok",
					text: "Research project created — the 11-stage engine is starting. Nothing is queued from research."
				}
			};
		});
		if (id) (async () => {
			await get().runResearch(id);
		})();
		return id;
	},
	/** Rule 4 key pool + research engine: runs stages, metering each model call honestly. */
	runResearch: async (researchId) => {
		const state = get();
		const project = state.research.find((item) => item.id === researchId);
		if (!project || project.archived) return;
		const site = state.sites.find((item) => item.id === project.siteId) ?? siteOf(state);
		if (!site) return;
		const pool = keyPool(state, site.voice.modelKeyId, Date.now()).filter((key) => keyCallsModel(key));
		const data = structuredClone(snap(get()));
		if (!data.research.find((item) => item.id === researchId)) return;
		await runResearch(data, researchId, pool.length ? async ({ system, user }) => {
			const outcome = await runWithKeyPool({
				keys: pool,
				onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
				call: async (key) => {
					const result = await generateDraft({ data: {
						baseUrl: key.baseUrl,
						apiKey: key.secret,
						model: key.model,
						system,
						user
					} });
					if (result.ok) return {
						ok: true,
						value: result
					};
					return {
						ok: false,
						status: result.status ?? 0,
						error: result.error
					};
				}
			});
			if (!outcome.ok) return {
				ok: false,
				error: outcome.error
			};
			const key = data.keys.find((item) => item.id === outcome.keyId) ?? pool[0];
			data.events.unshift({
				id: uid("evt"),
				pairId: `res_${researchId}:${outcome.keyId}:${Date.now()}`,
				siteId: site.id,
				keyId: key.id,
				at: Date.now(),
				state: "SETTLED",
				provider: key.provider,
				model: key.model,
				stage: "research",
				tokens: outcome.value.usage.total,
				usd: usdFor(outcome.value.usage.total, key.pricePerM)
			});
			return {
				ok: true,
				text: outcome.value.text,
				usage: outcome.value.usage
			};
		} : void 0, Date.now());
		set((cur) => ({
			...cur,
			research: cur.research.map((item) => item.id === researchId ? data.research.find((row) => row.id === researchId) ?? item : item),
			events: data.events,
			notice: {
				tone: "ok",
				text: researchNoticeText(data.research.find((row) => row.id === researchId))
			}
		}));
	},
	retryResearchStage: (researchId, stageKey) => {
		set((s) => {
			const next = structuredClone(snap(s));
			if (!rerunFailedStages(next, researchId, stageKey)) return s;
			return { ...next };
		});
		(async () => {
			await get().runResearch(researchId);
		})();
	},
	archiveResearch: (researchId) => set((s) => ({
		...s,
		research: s.research.map((project) => project.id === researchId ? {
			...project,
			archived: !project.archived
		} : project)
	})),
	queuePlanFromResearch: (researchId) => {
		let planId;
		set((s) => {
			const next = structuredClone(snap(s));
			const result = planFromResearch(next, researchId, Date.now());
			if (result.error) return {
				...s,
				notice: {
					tone: "danger",
					text: result.error
				}
			};
			planId = result.planId;
			return {
				...next,
				notice: {
					tone: "ok",
					text: "Topic plan built from the research clusters. Review and queue it."
				}
			};
		});
		return planId;
	},
	updateCluster: (planId, clusterId, patch) => set((s) => ({
		...s,
		plans: s.plans.map((plan) => plan.id !== planId || plan.status !== "review" ? plan : {
			...plan,
			clusters: plan.clusters.map((cluster) => cluster.id === clusterId ? {
				...cluster,
				...patch
			} : cluster)
		})
	})),
	moveCluster: (planId, clusterId, direction) => set((s) => ({
		...s,
		plans: s.plans.map((plan) => {
			if (plan.id !== planId || plan.status !== "review") return plan;
			const index = plan.clusters.findIndex((cluster) => cluster.id === clusterId);
			const next = index + direction;
			if (index < 0 || next < 0 || next >= plan.clusters.length) return plan;
			const clusters = [...plan.clusters];
			const [row] = clusters.splice(index, 1);
			clusters.splice(next, 0, row);
			return {
				...plan,
				clusters
			};
		})
	})),
	removeCluster: (planId, clusterId) => set((s) => ({
		...s,
		plans: s.plans.map((plan) => plan.id !== planId || plan.status !== "review" ? plan : {
			...plan,
			clusters: plan.clusters.filter((cluster) => cluster.id !== clusterId)
		})
	})),
	addCluster: (planId, title, angle, pillar) => set((s) => ({
		...s,
		plans: s.plans.map((plan) => {
			if (plan.id !== planId || plan.status !== "review") return plan;
			if (title.trim().length < 3) return plan;
			if (pillar) return {
				...plan,
				pillarTitle: title.trim(),
				pillarAngle: angle.trim() || plan.pillarAngle
			};
			return {
				...plan,
				clusters: [...plan.clusters, {
					id: uid("clu"),
					title: title.trim(),
					angle: angle.trim() || "You wrote this",
					excluded: false,
					source: "you",
					selected: true
				}]
			};
		})
	}))
}), {
	name: "gaw-v2",
	version: 13,
	skipHydration: true,
	storage: createJSONStorage(() => durableStorage),
	migrate: (persisted, version) => migratePersistedSnapshot(persisted, version),
	partialize: (s) => snap(s)
}));
/**
* Normalizes any persisted snapshot (IndexedDB mirror or the server database)
* to the current shape. Runs on every hydration path so both sources behave
* identically.
*/
function migratePersistedSnapshot(persisted, version) {
	const data = persisted;
	if ((version ?? 0) < 13) {
		const seedSiteIds = /* @__PURE__ */ new Set(["site_northline", "site_field"]);
		data.sites = (data.sites ?? []).filter((site) => !seedSiteIds.has(site.id));
		data.keys = (data.keys ?? []).filter((key) => key.id !== "key_studio");
		const seedArticleIds = /* @__PURE__ */ new Set([
			"art_scope",
			"art_cadence",
			"art_links"
		]);
		data.articles = (data.articles ?? []).filter((article) => !seedArticleIds.has(article.id));
		const seedJobIds = /* @__PURE__ */ new Set([
			"job_scope",
			"job_cadence",
			"job_links"
		]);
		data.jobs = (data.jobs ?? []).filter((job) => !seedJobIds.has(job.id));
		data.runs = (data.runs ?? []).filter((run) => run.id !== "run_seed");
		data.builds = (data.builds ?? []).filter((build) => build.id !== "bld_seed");
		data.events = (data.events ?? []).filter((event) => !event.id.startsWith("evt_hist_"));
		data.activity = (data.activity ?? []).filter((row) => row.id !== "act_1" && row.id !== "act_2");
		if (seedSiteIds.has(data.activeSiteId)) data.activeSiteId = data.sites[0]?.id ?? "";
	}
	data.limits = {
		...DEFAULT_LIMITS,
		...data.limits ?? {}
	};
	for (const key of data.keys ?? []) {
		key.disabled = false;
		key.cooldownUntil = void 0;
		key.chat = true;
	}
	sanitizeArticleImages(data.articles);
	data.webSearch ??= {
		mode: "off",
		tavilyKeys: [],
		firecrawlKeys: [],
		tavilyCursor: 0,
		firecrawlCursor: 0
	};
	data.webSearch.tavilyKeys ??= [];
	data.webSearch.firecrawlKeys ??= [];
	data.webSearch.tavilyCursor ??= 0;
	data.webSearch.firecrawlCursor ??= 0;
	if (data.firecrawl?.secret && !data.webSearch.firecrawlKeys.length) {
		data.webSearch.firecrawlKeys = [{
			id: uid("fcrl"),
			hint: `••••${data.firecrawl.secret.slice(-4)}`,
			secret: data.firecrawl.secret,
			disabled: false,
			failCount: 0
		}];
		if (data.webSearch.mode === "off") data.webSearch.mode = "firecrawl";
	}
	data.authors ??= [];
	data.research ??= [];
	data.research = data.research.map((project) => normalizeResearchProject(project));
	{
		const counts = /* @__PURE__ */ new Map();
		for (const article of data.articles ?? []) {
			if (!article.authorId) continue;
			counts.set(article.authorId, (counts.get(article.authorId) ?? 0) + 1);
		}
		data.authors = data.authors.map((author) => {
			const fixed = normalizeAuthorProfile(author, counts);
			if (fixed.articleCount === 0 && counts.has(author.id)) fixed.articleCount = counts.get(author.id);
			return fixed;
		});
	}
	for (const article of data.articles ?? []) {
		const author = data.authors.find((item) => item.id === article.authorId);
		if (author && article.authorName !== author.name) article.authorName = author.name;
	}
	data.firecrawl ??= {
		secret: "",
		hint: ""
	};
	data.calendars ??= [];
	data.calendars = data.calendars.map((calendar) => migrateCalendar(calendar));
	data.workerPaused ??= false;
	data.worker ??= {
		lastBeatAt: 0,
		online: false,
		activeJobs: 0,
		source: "browser"
	};
	data.backups ??= [];
	data.corpus ??= [];
	for (const build of data.builds ?? []) {
		build.includedIds ??= [];
		build.excluded ??= [];
		build.artifact ??= [];
	}
	if (data.ideas && data.ideas.filtered == null) data.ideas.filtered = 0;
	for (const idea of data.ideas?.items ?? []) if (!idea.intent) idea.intent = "guide";
	for (const site of data.sites ?? []) {
		if (!site.voice?.imageProvider || site.voice.imageProvider === "studio-plates") site.voice.imageProvider = "bing";
		site.voice.bannedPhrases ??= [];
		site.voice.brandFacts ??= [];
		site.voice.pov ??= "third-person";
		site.voice.readingLevel ??= "general";
		site.autoAuthors ??= true;
		site.adsEnabled ??= false;
		site.adsTxt ??= "";
		const existing = Array.isArray(site.ads) ? site.ads : [];
		site.ads = AD_SLOT_IDS.map((id) => {
			const found = existing.find((slot) => slot.id === id);
			const fallback = defaultAdSlots().find((slot) => slot.id === id);
			if (!found) return fallback;
			return {
				...fallback,
				...found,
				position: found.position ?? fallback.position,
				name: found.name || fallback.name,
				code: typeof found.code === "string" && new TextEncoder().encode(found.code).length <= 16384 ? found.code : ""
			};
		});
	}
	data.defaults.bannedPhrases ??= [];
	data.defaults.brandFacts ??= [];
	data.defaults.pov ??= "third-person";
	data.defaults.readingLevel ??= "general";
	for (const audit of data.audits ?? []) audit.orphans ??= 0;
	for (const article of data.articles ?? []) if (!article.imageState) article.imageState = article.images?.some((image) => image.src) ? "ready" : "pending";
	if ((version ?? 0) < 6 && data.account) {
		data.account.adminApproved = false;
		data.account.emailVerified = false;
		data.account.emailProvider ??= {
			vendor: "resend",
			secret: "",
			from: ""
		};
	}
	return data;
}
var lastServerGeneration = "";
var serverSyncStarted = false;
var serverPullStarted = false;
var pullInFlight = false;
var hydratingServer = null;
var purgeRegistry = {
	sites: /* @__PURE__ */ new Set(),
	keys: /* @__PURE__ */ new Set(),
	articles: /* @__PURE__ */ new Set()
};
/** Deleted rows are tombed so another window's next save cannot resurrect them. */
function recordPurge(kind, id) {
	purgeRegistry[kind].add(id);
}
function drainPurges() {
	const out = {};
	for (const key of [
		"sites",
		"keys",
		"articles"
	]) if (purgeRegistry[key].size) {
		out[key] = [...purgeRegistry[key]];
		purgeRegistry[key].clear();
	}
	return out;
}
function keyPoolSnapshot(preferredKeyId) {
	const state = snap(useApp.getState());
	return {
		state,
		keys: keyPool(state, preferredKeyId, Date.now())
	};
}
/** Key-pool LLM transport: sequential failover + one validation retry. */
var chatTransport = {
	async callModel({ system, user, validate, preferredKeyId }) {
		const pool = (modifiedUser) => {
			const { keys } = keyPoolSnapshot(preferredKeyId);
			return runWithKeyPool({
				keys,
				onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
				call: async (key) => {
					const result = await generateDraft({ data: {
						baseUrl: key.baseUrl,
						apiKey: key.secret,
						model: key.model,
						system,
						user: modifiedUser
					} });
					if (result.ok) return {
						ok: true,
						value: result
					};
					return {
						ok: false,
						status: result.status ?? 0,
						error: result.error
					};
				}
			});
		};
		const first = await pool(user);
		if (!first.ok) throw new Error(first.error);
		const problem = validate(first.value.text);
		if (!problem) return {
			keyId: first.keyId,
			text: first.value.text,
			usage: first.value.usage
		};
		const retry = await pool(`${user}\n\nThe previous response was rejected: ${problem} Return valid JSON only, no markdown fences.`);
		if (!retry.ok) throw new Error(retry.error);
		const secondProblem = validate(retry.value.text);
		if (secondProblem) throw new Error(secondProblem);
		return {
			keyId: retry.keyId,
			text: retry.value.text,
			usage: retry.value.usage
		};
	},
	async bladerChat(system, user) {
		const { keys } = keyPoolSnapshot(void 0);
		const outcome = await runWithKeyPool({
			keys: keys.filter((key) => keyCallsModel(key)),
			onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error),
			call: async (key) => {
				const result = await generateDraft({ data: {
					baseUrl: key.baseUrl,
					apiKey: key.secret,
					model: key.model,
					system,
					user
				} });
				if (result.ok) return {
					ok: true,
					value: result.text
				};
				return {
					ok: false,
					status: result.status ?? 0,
					error: result.error
				};
			}
		});
		if (!outcome.ok) return {
			ok: false,
			error: outcome.error
		};
		return {
			ok: true,
			text: outcome.value,
			keyId: outcome.keyId
		};
	}
};
var imageTransport = { placeImages: (input) => placeImages({ data: input }) };
/**
* Cross-window pull competition rules.
* Equality is CONTENT equality (sync markers ignored): a pull whose rows are
* byte-identical to the local rows keeps the local object references so
* zustand subscribers never re-render. A row whose content differs is server
* truth (someone saved it) and replaces the local copy.
*/
function jsonSame(a, b) {
	if (a === b) return true;
	if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
	return JSON.stringify(a) === JSON.stringify(b);
}
function mergeRemoteRows(local, incoming) {
	let changed = false;
	const byId = new Map(local.map((row) => [row.id, row]));
	for (const row of incoming) {
		const hit = byId.get(row.id);
		if (hit) {
			if (!jsonSame(hit, row)) {
				byId.set(row.id, row);
				changed = true;
			}
		} else {
			byId.set(row.id, row);
			changed = true;
		}
	}
	return changed ? [...byId.values()] : local;
}
function stampedConfig(local, incoming) {
	if (incoming === void 0 || jsonSame(local, incoming)) return {
		value: local,
		changed: false
	};
	return {
		value: incoming,
		changed: true
	};
}
function ingestRemote(remoteRaw) {
	if (!remoteRaw || typeof remoteRaw !== "object") return;
	const migrated = migratePersistedSnapshot(structuredClone(remoteRaw));
	const cur = { ...useApp.getState() };
	let changed = false;
	for (const key of CHURNED_COLLECTIONS) {
		const localList = cur[key];
		const incomingList = migrated[key];
		if (key === "jobs") continue;
		const merged = mergeRemoteRows(localList, incomingList);
		if (merged !== localList) {
			cur[key] = merged;
			changed = true;
		}
	}
	{
		const localList = cur.jobs;
		const incomingList = migrated.jobs;
		const byId = new Map(localList.map((row) => [row.id, row]));
		let jobsChanged = false;
		for (const row of incomingList) {
			const hit = byId.get(row.id);
			if (hit) {
				if (jsonSame(hit, row)) continue;
				if (jobProgressValue(row) >= jobProgressValue(hit)) {
					byId.set(row.id, row);
					jobsChanged = true;
				}
			} else {
				byId.set(row.id, row);
				jobsChanged = true;
			}
		}
		if (jobsChanged) {
			cur.jobs = [...byId.values()];
			changed = true;
		}
	}
	const sites = mergeRemoteRows(cur.sites, migrated.sites);
	if (sites !== cur.sites) {
		cur.sites = sites;
		changed = true;
	}
	const keys = mergeRemoteRows(cur.keys, migrated.keys);
	if (keys !== cur.keys) {
		cur.keys = keys;
		changed = true;
	}
	const limitsPatch = stampedConfig(cur.limits, migrated.limits);
	if (limitsPatch.changed) {
		cur.limits = limitsPatch.value;
		changed = true;
	}
	const defaultsPatch = stampedConfig(cur.defaults, migrated.defaults);
	if (defaultsPatch.changed) {
		cur.defaults = defaultsPatch.value;
		changed = true;
	}
	const webSearchPatch = stampedConfig(cur.webSearch, migrated.webSearch);
	if (webSearchPatch.changed) {
		cur.webSearch = webSearchPatch.value;
		changed = true;
	}
	const firecrawlPatch = stampedConfig(cur.firecrawl, migrated.firecrawl);
	if (firecrawlPatch.changed) {
		cur.firecrawl = firecrawlPatch.value;
		changed = true;
	}
	const accountPatch = stampedConfig(cur.account, migrated.account);
	if (accountPatch.changed) {
		cur.account = accountPatch.value;
		changed = true;
	}
	if (migrated.workerPaused !== cur.workerPaused) {
		cur.workerPaused = migrated.workerPaused;
		changed = true;
	}
	if (!(cur.activeSiteId !== "" && cur.sites.some((site) => site.id === cur.activeSiteId))) {
		const nextActive = cur.sites.some((site) => site.id === migrated.activeSiteId) ? migrated.activeSiteId : cur.sites[0]?.id;
		if (nextActive && nextActive !== cur.activeSiteId) {
			cur.activeSiteId = nextActive;
			changed = true;
		}
	}
	if (!changed) return;
	useApp.setState(cur);
}
/** Pull the server snapshot; called on boot and periodically for cross-window sync. */
async function pullServerState() {
	const remote = await loadAppState();
	lastServerGeneration = remote.generation || lastServerGeneration;
	ingestRemote(remote.state);
}
/** Debounced push of every store change into the server database. */
function startServerSync() {
	if (serverSyncStarted || typeof window === "undefined") return;
	serverSyncStarted = true;
	let timer;
	const flush = async () => {
		timer = void 0;
		const data = snap(useApp.getState());
		try {
			const result = await saveAppState({ data: {
				state: {
					...data,
					__generation: lastServerGeneration || void 0
				},
				purges: drainPurges()
			} });
			if (result?.generation) lastServerGeneration = result.generation;
		} catch (error) {
			console.error("[server-sync] save failed:", error instanceof Error ? error.message : error);
		}
	};
	useApp.subscribe(() => {
		if (timer == null) timer = window.setTimeout(() => void flush(), 600);
	});
	flush();
}
/** Slow cross-window/context merge: window A's workspaces reach window B in seconds. */
function startServerPull() {
	if (serverPullStarted || typeof window === "undefined") return;
	serverPullStarted = true;
	window.setInterval(() => {
		if (advancing || document.hidden || pullInFlight) return;
		pullInFlight = true;
		pullServerState().catch(() => {}).finally(() => {
			pullInFlight = false;
		});
	}, 5e3);
}
function hydrateFromServer() {
	if (!hydratingServer) hydratingServer = (async () => {
		let fromServer = false;
		try {
			const remote = await loadAppState();
			lastServerGeneration = remote.generation || "";
			if (remote.state && typeof remote.state === "object") {
				fromServer = true;
				ingestRemote(remote.state);
			}
		} catch {
			fromServer = false;
		}
		if (!fromServer) try {
			await useApp.persist.rehydrate();
		} catch {}
	})();
	return hydratingServer;
}
function useVaultPhase() {
	const [phase, setPhase] = (0, import_react.useState)(vaultPhase());
	(0, import_react.useEffect)(() => onVaultPhase(setPhase), []);
	return phase;
}
function useHydrated() {
	const phase = useVaultPhase();
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		loadVaultGate();
	}, []);
	(0, import_react.useEffect)(() => {
		if (phase !== "open") return;
		let alive = true;
		hydrateFromServer().then(() => {
			if (!alive) return;
			startServerSync();
			startServerPull();
			setHydrated(true);
		});
		return () => {
			alive = false;
		};
	}, [phase]);
	return hydrated;
}
/** Collections the tick and async actions both write — merged per id, never wholesale. */
var CHURNED_COLLECTIONS = [
	"jobs",
	"runs",
	"articles",
	"plans",
	"calendars",
	"research",
	"events",
	"activity",
	"builds",
	"deploys",
	"audits",
	"authors"
];
/**
* Hotfix (Rule 6/7 concurrency): upsert-merge two Persisted snapshots by id.
* The worker tick and async actions (queueKeywords/queuePlan/queueCalendarItem/
* runResearch) both clone → await → set. A wholesale spread of the clone used to
* WIPE entities committed concurrently in the other path (a run created during an
* in-flight advance vanished → "Run missing"). Merging per collection by id keeps
* both: incoming replaces same-id entries; base-only entries survive; ordering of
* incoming is preserved with base-only entries appended.
*/
/** Shallow per-row equality: advance() clones rows even when nothing changed, so CONTENT identity is what matters. */
function rowSame(a, b) {
	if (Object.is(a, b)) return true;
	if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
	const ak = Object.keys(a);
	const bk = Object.keys(b);
	if (ak.length !== bk.length) return false;
	for (const key of ak) if (!Object.is(a[key], b[key])) return false;
	return true;
}
/**
* Pipeline-progress protection: a stale snapshot may NEVER rewind a job.
* Terminal statuses (completed/failed/refused/held) outrank running, which
* outranks queued; deeper stage progress outranks shallower.
*/
function jobProgressValue(job) {
	const row = job;
	const status = String(row?.status ?? "");
	return (status === "completed" || status === "failed" || status === "refused" || status === "cancelled" || status === "publish-held" || status === "review-held" ? 1e5 : status === "running" ? 1e4 : status === "queued" ? 1e3 : 0) + ((row?.stageIndex ?? -1) + 1) * 100 + (row?.shots ?? 0) * 10;
}
function mergePersisted(base, incoming, collections) {
	const out = {};
	for (const key of collections) {
		const baseList = base[key];
		const incList = incoming[key];
		if (incList.length === baseList.length && incList.every((item, index) => rowSame(item, baseList[index]))) continue;
		const incById = new Map(incList.map((item) => [item.id, item]));
		if (key === "jobs") {
			for (const item of baseList) {
				const inc = incById.get(item.id);
				if (inc && jobProgressValue(inc) < jobProgressValue(item)) incById.set(item.id, item);
			}
			out[key] = [...incById.values()];
			continue;
		}
		const incIds = new Set(incList.map((item) => item.id));
		out[key] = [...incList, ...baseList.filter((item) => !incIds.has(item.id))];
	}
	return out;
}
if (typeof window !== "undefined") window.__gawStore = useApp;
//#endregion
export { automationLabel as a, embeddingModelFor as c, publishModeLabel as d, runWithKeyPool as f, useVaultPhase as g, useHydrated as h, allowPersistWrites as i, lockStudio as l, useApp as m, PROVIDER_BASE_URLS as n, blendedPricePerMillion as o, unlockVault as p, PROVIDER_LABELS as r, classifyLines as s, DEFAULT_EMBEDDING_MODEL as t, modelsForProvider as u };
