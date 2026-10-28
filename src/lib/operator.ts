import { normalizeKeyword, releaseHeld, submitKeywords } from "./engine.ts";
import type { CalendarEntry, ContentCalendar, Persisted } from "./types.ts";
import { uid } from "./utils.ts";

export type LineMark = { text: string; state: "blank" | "ok" | "too-long" | "over-limit" | "repeat" };

/** Rule 1: cap is optional. Pass null (or omit) for unlimited keywords. */
export function classifyLines(raw: string, keywordCap: number | null = null): { marks: LineMark[]; kept: string[] } {
  const kept: string[] = [];
  const marks = raw.split("\n").map((line) => {
    const text = line.trim();
    if (!text) return { text: line, state: "blank" as const };
    if (text.length > 200) return { text, state: "too-long" as const };
    const keyword = normalizeKeyword(text);
    if (!keyword) return { text, state: "blank" as const };
    if (keywordCap != null && kept.length >= keywordCap) return { text, state: "over-limit" as const };
    if (kept.includes(keyword)) return { text, state: "repeat" as const };
    kept.push(keyword);
    return { text: keyword, state: "ok" as const };
  });
  return { marks, kept };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekdayIndex(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const index = WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
  return index < 0 ? date.getDay() : index;
}

function ymdInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function zonedTimeToUtc(ymd: string, hour: number, minute: number, timeZone: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  const guess = Date.UTC(year!, month! - 1, day, hour, minute, 0);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(guess))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return guess - (asUtc - guess);
}

export function publishSlots(input: {
  count: number;
  days: number[];
  perWeek: number;
  hour: number;
  minute: number;
  timeZone: string;
  from?: number;
}): number[] {
  const days = input.days.length ? input.days : [1, 3, 5];
  const perWeek = Math.min(21, Math.max(1, input.perWeek));
  const slots: number[] = [];
  const start = input.from ?? Date.now();
  let weekKey = "";
  let inWeek = 0;
  for (let offset = 1; offset < 120 && slots.length < input.count; offset += 1) {
    const date = new Date(start + offset * 86400000);
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

function weekNumber(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7);
}

/** Rule 6: truthful cadence + automation summary strings (recomputed on every mutation). */
export function calendarSummaries(calendar: Pick<ContentCalendar, "activeDays" | "articlesPerWeek" | "publishTime" | "timezone" | "generationLeadHours" | "autoGenerate" | "autoPublish" | "autoReweave" | "publishMode">): { cadence: string; automation: string } {
  const days = [...calendar.activeDays].sort((a, b) => a - b).map((day) => WEEKDAYS[day] ?? "?").join(", ") || "No days";
  const cadence = `${days} · ${Math.min(21, Math.max(1, calendar.articlesPerWeek))}/week · ${calendar.publishTime} ${calendar.timezone}`;
  const bits: string[] = [];
  if (calendar.autoGenerate) bits.push(`Writes automatically ${Math.min(336, Math.max(1, calendar.generationLeadHours))}h before publish`);
  if (calendar.autoPublish) bits.push(calendar.publishMode === "published" ? "Publishes automatically at publish time" : "Saves drafts automatically at publish time");
  if (calendar.autoReweave) bits.push("Re-weaves internal links after publish");
  return { cadence, automation: bits.length ? bits.join(" · ") : "Automation off — manual only." };
}

export function automationLabel(calendar: Pick<ContentCalendar, "autoGenerate" | "autoPublish" | "autoReweave">): "automation on" | "manual" {
  return calendar.autoGenerate || calendar.autoPublish || calendar.autoReweave ? "automation on" : "manual";
}

export function publishModeLabel(calendar: Pick<ContentCalendar, "publishMode">): string {
  return calendar.publishMode === "published" ? "Publish automatically" : "Save drafts automatically";
}

/** Rule 6: "Write now" / "Publish now" map the calendar's publish mode onto the run's engine mode. */
function engineMode(calendar: Pick<ContentCalendar, "publishMode">): "draft" | "live" {
  return calendar.publishMode === "published" ? "live" : "draft";
}

export function buildCalendar(input: {
  siteId: string;
  name: string;
  timezone: string;
  activeDays: number[];
  articlesPerWeek: number;
  publishTime: string;
  generationLeadHours: number;
  order: ContentCalendar["order"];
  publishMode: ContentCalendar["publishMode"];
  planningRangeDays?: number;
  defaultModelCatalogId?: string | null;
  topics: { title: string; angle: string; kind: CalendarEntry["kind"] }[];
  sourcePlanId?: string;
  now: number;
}): ContentCalendar {
  const ordered = orderTopics(input.topics, input.order);
  const [hour, minute] = input.publishTime.split(":").map((part) => Number(part) || 0);
  const slots = publishSlots({
    count: ordered.length,
    days: input.activeDays,
    perWeek: input.articlesPerWeek,
    hour: hour ?? 9,
    minute: minute ?? 0,
    timeZone: input.timezone,
    from: input.now,
  });
  const leadHours = Math.min(336, Math.max(1, input.generationLeadHours));
  const ahead = leadHours * 3600000;
  const base: ContentCalendar = {
    id: uid("cal"),
    siteId: input.siteId,
    name: input.name.trim(),
    timezone: input.timezone,
    activeDays: input.activeDays.length ? input.activeDays : [1, 3, 5],
    articlesPerWeek: Math.min(21, Math.max(1, input.articlesPerWeek)),
    publishTime: input.publishTime,
    generationLeadHours: leadHours,
    strategy: "PILLAR_FIRST",
    publishMode: input.publishMode,
    mode: "MANUAL",
    planningRangeDays: input.planningRangeDays ?? 30,
    defaultModelCatalogId: input.defaultModelCatalogId ?? null,
    order: input.order,
    // The 3 switches are independent and default OFF.
    autoGenerate: false,
    autoPublish: false,
    autoReweave: false,
    cadence: "",
    automation: "",
    sourcePlanId: input.sourcePlanId,
    createdAt: input.now,
    items: ordered.map((topic, index) => {
      const publishAt = slots[index] ?? input.now + (index + 1) * 86400000;
      return {
        id: uid("slot"),
        title: topic.title,
        angle: topic.angle,
        kind: topic.kind,
        publishAt,
        // write_at !== publish_at: the lead time is subtracted when scheduling.
        writeAt: publishAt - ahead,
        status: "SCHEDULED" as const,
      };
    }),
  };
  const summaries = calendarSummaries(base);
  return { ...base, ...summaries };
}

/** Recompute the two summary strings after any mutation. */
export function withSummaries(calendar: ContentCalendar): ContentCalendar {
  return { ...calendar, ...calendarSummaries(calendar) };
}

function orderTopics(
  topics: { title: string; angle: string; kind: CalendarEntry["kind"] }[],
  order: ContentCalendar["order"],
) {
  if (order === "my-order") return topics;
  if (order === "pillars-first") return [...topics].sort((a, b) => Number(b.kind === "pillar") - Number(a.kind === "pillar"));
  if (order === "one-cluster") return [...topics].sort((a, b) => Number(a.kind === "pillar") - Number(b.kind === "pillar"));
  const pillars = topics.filter((topic) => topic.kind === "pillar");
  const rest = topics.filter((topic) => topic.kind !== "pillar");
  const mixed: typeof topics = [];
  const max = Math.max(pillars.length, rest.length);
  for (let i = 0; i < max; i += 1) {
    if (rest[i]) mixed.push(rest[i]!);
    if (i % 3 === 2 && pillars[Math.floor(i / 3)]) mixed.push(pillars[Math.floor(i / 3)]!);
  }
  for (const pillar of pillars) if (!mixed.includes(pillar)) mixed.push(pillar);
  return mixed;
}

/** Map engine job state onto the live entry lifecycle (SCHEDULED | WRITING | READY | PUBLISHED | DRAFT_SAVED | SKIPPED | FAILED). */
function syncCalendarItems(data: Persisted): boolean {
  let changed = false;
  for (const calendar of data.calendars) {
    for (const item of calendar.items) {
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
        const run = data.runs.find((entry) => entry.id === job.runId);
        item.status = run?.publishMode === "live" ? "PUBLISHED" : "DRAFT_SAVED";
        changed = true;
      }
      if ((job.status === "failed" || job.status === "refused") && item.status === "WRITING") {
        item.status = "FAILED";
        item.note = job.refusalReason ?? "The run failed.";
        changed = true;
      }
    }
  }
  return changed;
}

export async function queueCalendarItem(data: Persisted, calendarId: string, itemId: string, now: number): Promise<{ data: Persisted; error?: string }> {
  const calendar = data.calendars.find((entry) => entry.id === calendarId);
  const item = calendar?.items.find((entry) => entry.id === itemId);
  if (!calendar || !item) return { data, error: "Calendar entry not found." };
  if (item.status !== "SCHEDULED" && item.status !== "FAILED") return { data, error: "That article has already started." };
  const result = await submitKeywords(data, {
    siteId: calendar.siteId,
    lines: item.title,
    publishMode: engineMode(calendar),
    modelKeyId: calendar.defaultModelCatalogId || "default",
    allowVariants: false,
    publishHold: true,
    now,
  });
  if (result.error || !result.runId) return { data, error: result.error ?? "Could not write that calendar article." };
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
    text: calendar.autoPublish
      ? `Writing started — it will ${calendar.publishMode === "published" ? "publish" : "save a draft"} at the scheduled time.`
      : "Writing started — it will wait for you before publishing.",
  };
  return { data: next };
}

/** Release a READY entry now: mode-aware Publish now / Save draft now. */
export function publishCalendarItemNow(data: Persisted, calendarId: string, itemId: string, now: number): { data: Persisted; error?: string } {
  const calendar = data.calendars.find((entry) => entry.id === calendarId);
  const item = calendar?.items.find((entry) => entry.id === itemId);
  if (!calendar || !item) return { data, error: "Calendar entry not found." };
  if (!item.jobId) return { data, error: "That article has not been written yet." };
  const released = releaseHeld(data, item.jobId, now);
  if (released.error) return { data, error: released.error };
  const next = released.data;
  const stored = next.calendars.find((entry) => entry.id === calendarId)?.items.find((entry) => entry.id === itemId);
  const run = next.runs.find((entry) => entry.id === stored?.runId);
  if (stored) stored.status = run?.publishMode === "live" ? "PUBLISHED" : "DRAFT_SAVED";
  return { data: next };
}

/**
 * Rule 6 pulse: the 3 switches act independently.
 *  - autoGenerate: queue SCHEDULED entries whose write_at has passed.
 *  - autoPublish : release READY entries at publish_at (published → live, or draft mode → save draft).
 *  - autoReweave : after publish, propose sibling links in the same calendar.
 */
export async function pulseCalendars(data: Persisted, now: number): Promise<Persisted | null> {
  if (data.workerPaused) return null;
  const next = structuredClone(data);
  const changed = syncCalendarItems(next);
  // Queuing due `autoGenerate` items is NOT done here any more. The Rust
  // calendar pulse (`backend/api/src/calendar.rs`) owns it, so a scheduled
  // article starts writing whether or not a tab is open. Doing it in both
  // places would queue the same item twice while the client's copy still reads
  // SCHEDULED.
  //
  // `autoPublish` moved with it, for the same reason: the server releases the
  // item and pushes it to Ghost itself now. Publishing from both sides would
  // create the post twice.
  //
  // `autoReweave` moved too — `calendar::reweave` proposes the sibling links on
  // the server. All three switches are the server's now; this function only
  // keeps the local item rows in step with what the server reports.
  syncCalendarItems(next);
  return changed ? next : null;
}

export const CALENDAR_STATUS_MAP: Record<string, CalendarEntry["status"]> = {
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
  FAILED: "FAILED",
};

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(value)));

/**
 * Rule 6 (persist v10): bring any legacy or restored calendar onto the live
 * contract. The 3 automation switches are ALWAYS written as OFF here — a backup
 * restore can never silently re-enable writing or publishing.
 */
export function migrateCalendar(raw: ContentCalendar & Record<string, unknown>): ContentCalendar {
  const legacy = raw as unknown as {
    days?: number[];
    perWeek?: number;
    publishHour?: number;
    publishMinute?: number;
    writeHoursAhead?: number;
    items?: (CalendarEntry & { status?: string })[];
  };
  const activeDays = Array.isArray(raw.activeDays) && raw.activeDays.length ? raw.activeDays : Array.isArray(legacy.days) && legacy.days.length ? legacy.days : [1, 3, 5];
  const publishTime =
    typeof raw.publishTime === "string" && /^\d{1,2}:\d{2}$/.test(raw.publishTime)
      ? raw.publishTime
      : `${String(legacy.publishHour ?? 9).padStart(2, "0")}:${String(legacy.publishMinute ?? 0).padStart(2, "0")}`;
  const base: ContentCalendar = {
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
    order: (raw.order as ContentCalendar["order"]) ?? "one-cluster",
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
      attempts: item.attempts ?? 0,
    })),
  };
  return withSummaries(base);
}
