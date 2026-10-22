import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { automationLabel, publishModeLabel } from "@/lib/operator";
import { useApp, useHydrated } from "@/lib/store";
import type { CalendarEntry, ContentCalendar } from "@/lib/types";
import { Badge, Button, Card, Empty, Field, PageIntro, SkeletonRows, StateNote, fieldClass } from "@/components/ui";
import { relTime } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ENTRY_TONE: Record<CalendarEntry["status"], "ok" | "danger" | "brass" | "muted"> = {
  SCHEDULED: "muted",
  WRITING: "brass",
  READY: "brass",
  PUBLISHED: "ok",
  DRAFT_SAVED: "ok",
  SKIPPED: "muted",
  FAILED: "danger",
};

const ENTRY_LABEL: Record<CalendarEntry["status"], string> = {
  SCHEDULED: "SCHEDULED",
  WRITING: "WRITING",
  READY: "READY — waiting for publish",
  PUBLISHED: "PUBLISHED",
  DRAFT_SAVED: "DRAFT SAVED",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
};

function Switches({ calendar }: { calendar: ContentCalendar }) {
  const patchCalendar = useApp((s) => s.patchCalendar);
  return (
    <Card className="mb-4 space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">Automation</div>
        <span className="flex items-center gap-2">
          <Badge tone={automationLabel(calendar) === "automation on" ? "brass" : "muted"}>{automationLabel(calendar)}</Badge>
          <span className="text-xs text-faint">{calendar.cadence}</span>
        </span>
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 size-4 accent-brass" checked={calendar.autoGenerate} onChange={(e) => patchCalendar(calendar.id, { autoGenerate: e.target.checked })} />
        <span>
          <span className="font-medium">Write automatically</span>
          <span className="block text-xs text-faint">Queues and runs the pipeline at write time ({calendar.generationLeadHours}h before publish). Holds before publishing unless the next switch is on.</span>
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 size-4 accent-brass" checked={calendar.autoPublish} onChange={(e) => patchCalendar(calendar.id, { autoPublish: e.target.checked })} />
        <span>
          <span className="font-medium">{publishModeLabel(calendar)}</span>
          <span className="block text-xs text-faint">
            Acts at publish time. Current mode: {calendar.publishMode === "published" ? "publish to the CMS" : "save a draft on the CMS"}.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 size-4 accent-brass" checked={calendar.autoReweave} onChange={(e) => patchCalendar(calendar.id, { autoReweave: e.target.checked })} />
        <span>
          <span className="font-medium">Automatic internal linking</span>
          <span className="block text-xs text-faint">After publish, links each new post to its same-calendar siblings (pillars first) through the Ghost PUT re-weave path with an optimistic lock.</span>
        </span>
      </label>
      <p className="text-xs text-faint">{calendar.automation}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Field label="Publish mode">
          <select className={fieldClass} value={calendar.publishMode} onChange={(e) => patchCalendar(calendar.id, { publishMode: e.target.value as ContentCalendar["publishMode"] })}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </Field>
        <Field label="Timezone">
          <input className={fieldClass} value={calendar.timezone} onChange={(e) => patchCalendar(calendar.id, { timezone: e.target.value })} />
        </Field>
        <Field label="Publish time">
          <input className={fieldClass} type="time" value={calendar.publishTime} onChange={(e) => patchCalendar(calendar.id, { publishTime: e.target.value })} />
        </Field>
        <Field label="Lead hours" hint="1–336">
          <input
            className={fieldClass}
            type="number"
            min={1}
            max={336}
            value={calendar.generationLeadHours}
            onChange={(e) => patchCalendar(calendar.id, { generationLeadHours: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Articles / week" hint="1–21">
          <input
            className={fieldClass}
            type="number"
            min={1}
            max={21}
            value={calendar.articlesPerWeek}
            onChange={(e) => patchCalendar(calendar.id, { articlesPerWeek: Number(e.target.value) || 1 })}
          />
        </Field>
      </div>
      <div>
        <span className="mb-2 block text-sm">Active days</span>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                patchCalendar(calendar.id, {
                  activeDays: calendar.activeDays.includes(index) ? calendar.activeDays.filter((day) => day !== index) : [...calendar.activeDays, index].sort((a, b) => a - b),
                })
              }
              className={`min-h-11 rounded-lg border px-3 text-sm ${calendar.activeDays.includes(index) ? "border-brass bg-brass/10 text-fg" : "border-line text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function CalendarPage() {
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const siteId = useApp((s) => s.activeSiteId);
  const calendars = useApp((s) => s.calendars);
  const plans = useApp((s) => s.plans);
  const createCalendar = useApp((s) => s.createCalendar);
  const mine = useMemo(() => calendars.filter((calendar) => calendar.siteId === siteId), [calendars, siteId]);
  const readyPlans = useMemo(() => plans.filter((plan) => plan.siteId === siteId), [plans, siteId]);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [perWeek, setPerWeek] = useState(3);
  const [publishTime, setPublishTime] = useState("09:00");
  const [lead, setLead] = useState(12);
  const [order, setOrder] = useState<ContentCalendar["order"]>("one-cluster");
  const [publishMode, setPublishMode] = useState<ContentCalendar["publishMode"]>("published");
  const [planId, setPlanId] = useState("");
  const [lines, setLines] = useState("");

  // Rule 7: honest loading state before the store hydrates (after every hook).
  if (!hydrated) return <SkeletonRows rows={4} />;
  return (
    <div>
      <PageIntro
        eyebrow="Content"
        title="Calendar"
        lede="Every article has a write time and a publish time (lead hours apart). The 3 automation switches are independent and start OFF: write automatically, publish/save-draft automatically, and automatic internal linking. Until you turn them on, nothing writes or publishes on its own."
      />
      <Card className="mb-4 grid gap-3 p-5 md:grid-cols-2">
        <Field label="Name">
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Autumn schedule" />
        </Field>
        <Field label="Timezone" hint="IANA zone. DST-safe slot math.">
          <input className={fieldClass} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </Field>
        <Field label="Articles per week" hint="1–21">
          <input className={fieldClass} type="number" min={1} max={21} value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value) || 1)} />
        </Field>
        <Field label="Publish time (local)">
          <input className={fieldClass} type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} />
        </Field>
        <Field label="Write lead hours" hint="1–336. write_at is this many hours before publish_at.">
          <input className={fieldClass} type="number" min={1} max={336} value={lead} onChange={(e) => setLead(Number(e.target.value) || 1)} />
        </Field>
        <Field label="Publish mode" hint="Published posts or CMS drafts.">
          <select className={fieldClass} value={publishMode} onChange={(e) => setPublishMode(e.target.value as ContentCalendar["publishMode"])}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </Field>
        <Field label="Order">
          <select className={fieldClass} value={order} onChange={(e) => setOrder(e.target.value as ContentCalendar["order"])}>
            <option value="pillars-first">Pillars first</option>
            <option value="one-cluster">One cluster at a time</option>
            <option value="balanced">Balanced</option>
            <option value="my-order">My order</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <span className="mb-2 block text-sm">Active days</span>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setDays((prev) => (prev.includes(index) ? prev.filter((day) => day !== index) : [...prev, index]))}
                className={`min-h-11 rounded-lg border px-3 text-sm ${days.includes(index) ? "border-brass bg-brass/10 text-fg" : "border-line text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Fill from a topic plan" hint="Optional. Otherwise paste titles below.">
          <select className={fieldClass} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">No plan</option>
            {readyPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.topic}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Or one title per line">
          <textarea className={fieldClass} rows={4} value={lines} onChange={(e) => setLines(e.target.value)} />
        </Field>
        <div>
          <Button
            onClick={() => {
              const id = createCalendar({ name, timezone, activeDays: days, articlesPerWeek: perWeek, publishTime, generationLeadHours: lead, order, publishMode, planId: planId || undefined, lines });
              if (id) navigate({ to: "/calendar/$id", params: { id } });
            }}
          >
            Create calendar
          </Button>
        </div>
      </Card>
      {!mine.length ? (
        <Empty title="No calendars" body="Scheduling does not write articles. Open a calendar to write or publish one at a time." />
      ) : (
        <div className="space-y-2">
          {mine.map((calendar) => {
            const next = calendar.items.filter((item) => item.status === "SCHEDULED").sort((a, b) => a.publishAt - b.publishAt)[0];
            const counts = calendar.items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
            return (
              <Link key={calendar.id} to="/calendar/$id" params={{ id: calendar.id }} className="block">
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{calendar.name}</div>
                    <div className="text-xs text-muted">
                      {calendar.items.length} entries · next {next ? relTime(next.publishAt) : "none"} · {calendar.cadence}
                    </div>
                    <div className="mt-1 text-xs text-faint">
                      {Object.entries(counts).map(([status, count]) => `${count} ${status}`).join(" · ") || "empty"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={automationLabel(calendar) === "automation on" ? "brass" : "muted"}>{automationLabel(calendar)}</Badge>
                    <Badge tone="muted">{calendar.timezone}</Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EntryCard({ calendar, entry }: { calendar: ContentCalendar; entry: CalendarEntry }) {
  const patchCalendarItem = useApp((s) => s.patchCalendarItem);
  const removeCalendarItem = useApp((s) => s.removeCalendarItem);
  const writeCalendarItem = useApp((s) => s.writeCalendarItem);
  const publishCalendarItem = useApp((s) => s.publishCalendarItem);
  const [when, setWhen] = useState("");
  const [editing, setEditing] = useState(false);
  const canEdit = entry.status === "SCHEDULED" || entry.status === "SKIPPED";
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{entry.title}</div>
          <div className="mt-1 text-xs text-muted">
            {entry.kind} · write {new Date(entry.writeAt).toLocaleString("en-GB", { timeZone: calendar.timezone })} · publish{" "}
            {new Date(entry.publishAt).toLocaleString("en-GB", { timeZone: calendar.timezone })}
          </div>
          {entry.note ? <p className="mt-1 text-xs text-faint">{entry.note}</p> : null}
        </div>
        <Badge tone={ENTRY_TONE[entry.status]}>{ENTRY_LABEL[entry.status]}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit ? <Button onClick={() => writeCalendarItem(calendar.id, entry.id)}>Write now</Button> : null}
        {entry.status === "READY" && entry.jobId ? (
          <Button onClick={() => publishCalendarItem(calendar.id, entry.id)}>{calendar.publishMode === "published" ? "Publish now" : "Save draft now"}</Button>
        ) : null}
        {entry.runId ? (
          <Link to="/runs/$id" params={{ id: entry.runId }} className="inline-flex min-h-11 items-center text-sm text-brass">
            Open run
          </Link>
        ) : null}
        {entry.articleId ? (
          <Link to="/articles/$id" params={{ id: entry.articleId }} className="inline-flex min-h-11 items-center text-sm text-brass">
            Article
          </Link>
        ) : null}
        {entry.status === "SCHEDULED" ? (
          <Button variant="ghost" onClick={() => patchCalendarItem(calendar.id, entry.id, { status: "SKIPPED" })}>
            Skip
          </Button>
        ) : null}
        {entry.status === "SKIPPED" ? (
          <Button variant="ghost" onClick={() => patchCalendarItem(calendar.id, entry.id, { status: "SCHEDULED" })}>
            Restore
          </Button>
        ) : null}
        {canEdit ? (
          <>
            <Button variant="ghost" onClick={() => setEditing(!editing)}>
              Reschedule
            </Button>
            <Button variant="danger" onClick={() => removeCalendarItem(calendar.id, entry.id)}>
              Delete
            </Button>
          </>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={fieldClass} value={when} onChange={(e) => setWhen(e.target.value)} placeholder="YYYY-MM-DDTHH:MM" aria-label="New local time" />
          <Button
            onClick={() => {
              const parsed = Date.parse(when);
              if (Number.isNaN(parsed)) return;
              patchCalendarItem(calendar.id, entry.id, { publishAt: parsed });
              setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function CalendarDetail({ id }: { id: string }) {
  const hydrated = useHydrated();
  const calendar = useApp((s) => s.calendars.find((item) => item.id === id));
  const plans = useApp((s) => s.plans);
  const fillCalendarFromPlan = useApp((s) => s.fillCalendarFromPlan);
  const workerPaused = useApp((s) => s.workerPaused);
  const worker = useApp((s) => s.worker);
  const [view, setView] = useState<"list" | "month" | "cluster">("list");
  // Rule 7: "Calendar missing" only counts after the workspace has hydrated —
  // a "Write now" click before hydration would land in seed state and be wiped.
  if (!hydrated) return <SkeletonRows rows={5} />;
  if (!calendar) return <Empty title="Calendar missing" body="That calendar is not in this workspace." />;
  const planOptions = plans.filter((plan) => plan.siteId === calendar.siteId);
  const clusters = groupByCluster(calendar);
  const month = groupByMonth(calendar);
  return (
    <div>
      <PageIntro
        eyebrow={calendar.timezone}
        title={calendar.name}
        lede={automationLabel(calendar) === "automation on" ? `${calendar.automation} The worker must be online.` : "Manual. Nothing writes or publishes until you use the buttons on an entry or turn a switch on."}
      />
      {workerPaused ? (
        <div className="mb-3">
          <StateNote tone="partial" title="Worker paused" body="Automation is on hold until you resume the worker in the shell header. Nothing writes or publishes while it is paused." />
        </div>
      ) : null}
      <Switches calendar={calendar} />
       <div className="mb-5 flex flex-wrap items-center gap-3">
         <div className="segmented" aria-label="Calendar view">{(["list", "month", "cluster"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
             className="capitalize"
            onClick={() => setView(option)}
          >
            {option}
          </button>
         ))}</div>
        <span className="text-xs text-faint">
          server heartbeat {worker.lastBeatAt ? relTime(worker.lastBeatAt) : "never"} · {worker.online ? "online" : "offline"}
        </span>
        {planOptions.length ? (
          <select
            className={`${fieldClass} max-w-56`}
            value=""
            onChange={(e) => {
              if (e.target.value) fillCalendarFromPlan(calendar.id, e.target.value);
            }}
          >
            <option value="">Fill from a topic plan…</option>
            {planOptions.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.topic}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {view === "list" ? (
        <div className="space-y-2">
          {calendar.items.map((entry) => (
            <EntryCard key={entry.id} calendar={calendar} entry={entry} />
          ))}
          {!calendar.items.length ? <p className="text-sm text-muted">No entries. Fill from a topic plan or create a new calendar.</p> : null}
        </div>
      ) : null}
      {view === "month" ? (
        <div className="space-y-4">
          {[...month.entries()].map(([label, items]) => (
            <Card key={label} className="p-4">
              <div className="font-medium">{label}</div>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {items.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3">
                    <span>
                      {new Date(entry.publishAt).toLocaleString("en-GB", { timeZone: calendar.timezone, day: "2-digit", hour: "2-digit", minute: "2-digit" })} · {entry.title}
                    </span>
                    <Badge tone={ENTRY_TONE[entry.status]}>{entry.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : null}
      {view === "cluster" ? (
        <div className="space-y-4">
          {[...clusters.entries()].map(([kind, items]) => (
            <Card key={kind} className="p-4">
              <div className="font-medium capitalize">
                {kind} entries ({items.length})
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {items.map((entry) => (
                  <li key={entry.id}>
                    {entry.title} · {relTime(entry.publishAt)} · {entry.status}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function groupByMonth(calendar: ContentCalendar): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  for (const entry of [...calendar.items].sort((a, b) => a.publishAt - b.publishAt)) {
    const label = new Intl.DateTimeFormat("en-GB", { timeZone: calendar.timezone, month: "long", year: "numeric" }).format(new Date(entry.publishAt));
    map.set(label, [...(map.get(label) ?? []), entry]);
  }
  return map;
}

function groupByCluster(calendar: ContentCalendar): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  for (const entry of calendar.items) {
    const key = entry.kind === "pillar" ? "pillars" : entry.kind === "cluster" ? "clusters" : "keywords";
    map.set(key, [...(map.get(key) ?? []), entry]);
  }
  return map;
}
