import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { goldenSteps } from "@/lib/engine";
import { SetupGuide } from "@/components/setup-guide";
import { useBeat } from "@/components/shell";
import { Badge, Card, statusTone } from "@/components/ui";
import { compact, nextUtcResetLabel, relTime, utcDay } from "@/lib/utils";
import { BENTO_BUTTER, BENTO_CORAL, BENTO_PINK, BENTO_SKY, KpiBento, type BentoCard } from "@/components/dash/kpi-bento";
import { VelocityChart } from "@/components/dash/velocity-chart";
import { BreakdownCard, type BreakdownRow } from "@/components/dash/breakdown-card";
import { PostLedger, type LedgerRow } from "@/components/dash/post-ledger";
import { TelemetryDrawer } from "@/components/dash/telemetry-drawer";
import { CommandBar } from "@/components/dash/command-bar";
import { bucketEvents, weekOverWeek, type Timeframe, type VelocityEvent } from "@/lib/velocity-buckets";

export function OverviewPage() {
  const data = useApp();
  // Rule 7 hooks rule: every hook runs before any early return so the order is stable.
  const beat = useBeat((s) => s.at);
  // Rule 7 hooks rule: hook order is stable across renders, so this sits with the others.
  const [timeframe, setTimeframe] = useState<Timeframe>("1W");
  const site = data.sites.find((item) => item.id === data.activeSiteId) ?? data.sites[0];
  if (!site) {
    return (
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">No workspace yet</h1>
        <p className="mt-3 text-sm text-muted">Create a website workspace to start. An owner account has no workspace cap.</p>
        <Link to="/workspaces" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brass px-4 text-sm font-medium text-ink">
          Website workspaces
        </Link>
      </div>
    );
  }
  const articles = data.articles.filter((article) => article.siteId === site.id);
  const runs = data.runs.filter((run) => run.siteId === site.id);
  const jobs = data.jobs.filter((job) => job.siteId === site.id);
  const day = utcDay(Date.now());
  const links = articles.reduce((sum, article) => sum + article.links.length, 0);
  const build = data.builds.find((item) => item.siteId === site.id);
  const steps = goldenSteps(data, site);
  const done = steps.filter((step) => step.done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const ghostLive = site.ghost.mode === "live";
  const edges = articles
    .flatMap((article) => article.links.slice(0, 2).map((link) => ({ from: article.title, anchor: link.anchor, slug: link.targetSlug })))
    .slice(0, 8);

  // ---- Phase 2 dashboard data: everything below is measured, nothing invented ----
  const now = Date.now();
  const velocityEvents: VelocityEvent[] = [
    ...articles.map((article) => ({
      at: article.publishedAt || article.ledger.confirmedAt || 0,
      kind: "published" as const,
      amount: article.words,
    })),
    ...jobs.map((job) => ({ at: job.createdAt || 0, kind: "generated" as const, amount: job.tokens })),
  ].filter((event) => event.at > 0);
  const buckets = bucketEvents(velocityEvents, now, timeframe);

  const scheduledCalendar = data.calendars
    .filter((calendar) => calendar.siteId === site.id)
    .reduce((sum, calendar) => sum + calendar.items.filter((item) => item.status === "SCHEDULED").length, 0);
  const queued = jobs.filter((job) => job.status === "queued").length + scheduledCalendar;
  const drafting = jobs.filter((job) => job.status === "running").length;
  const week = weekOverWeek(
    articles.filter((article) => article.status === "published").map((article) => article.publishedAt),
    now,
  );
  const stageMs = jobs.flatMap((job) => job.stages.filter((stage) => stage.status === "done").map((stage) => stage.durationMs)).filter((ms) => ms > 0);
  const avgStageMs = stageMs.length ? Math.round(stageMs.reduce((sum, ms) => sum + ms, 0) / stageMs.length) : null;

  const bento: BentoCard[] = [
    {
      label: "Queued topics",
      value: String(queued),
      hint: scheduledCalendar ? `${scheduledCalendar} scheduled on the calendar` : "nothing scheduled",
      accent: BENTO_CORAL,
    },
    {
      label: "Drafting / in motion",
      value: String(drafting),
      hint: `${data.worker.activeJobs ?? 0} held by the worker`,
      accent: BENTO_BUTTER,
    },
    {
      label: "Published to Ghost (7d)",
      value: String(week.thisWeek),
      hint: `${week.lastWeek} in the week before`,
      accent: BENTO_PINK,
      delta:
        week.deltaPct === null
          ? undefined
          : { text: `${week.deltaPct > 0 ? "+" : ""}${week.deltaPct}%`, positive: week.deltaPct >= 0 },
    },
    {
      label: "Worker & API health",
      value: data.workerPaused ? "Paused" : data.worker.online ? "Online" : "Idle",
      hint: avgStageMs === null ? "no stage timings yet" : `avg stage ${avgStageMs} ms`,
      accent: BENTO_SKY,
    },
  ];

  // The reference puts a proportional breakdown beside the hero figure. These are
  // counted from the same state the KPIs use, so the two can never disagree.
  const drafts = articles.filter((article) => article.status === "draft").length;
  const published = articles.filter((article) => article.status === "published").length;
  const pipeline: BreakdownRow[] = [
    { label: "Queued topics", value: queued, tone: "queued" },
    { label: "Drafting now", value: drafting, tone: "drafting" },
    { label: "Drafts awaiting publish", value: drafts, tone: "review" },
    { label: "Published to Ghost", value: published, tone: "shipped" },
  ];

  const ledger: LedgerRow[] = [...articles]
    .sort((left, right) => right.publishedAt - left.publishedAt)
    .slice(0, 8)
    .map((article) => {
      const job = jobs.find((item) => item.id === article.jobId);
      const confirmed = article.ledger.confirmed && article.ledger.confirmedAt && article.ledger.dispatchedAt;
      return {
        id: article.id,
        title: article.title,
        slug: article.slug,
        status: article.status,
        keyword: article.keyword,
        publishedAt: article.publishedAt,
        words: article.words,
        costUsd: typeof job?.costUsd === "number" ? job.costUsd : null,
        syncMs: confirmed ? article.ledger.confirmedAt - article.ledger.dispatchedAt : null,
      };
    });

  const telemetry = [
    { label: "Jobs generated", hint: "per bucket", values: buckets.map((bucket) => bucket.generated), color: "var(--color-brass)" },
    { label: "Words written", hint: "published copy", values: buckets.map((bucket) => bucket.words), color: "var(--color-ok)" },
    { label: "Tokens settled", hint: "model usage", values: buckets.map((bucket) => bucket.tokens), color: "#ff1e56" },
  ];
  const logs = data.activity
    .filter((entry) => entry.siteId === site.id)
    .slice(0, 40)
    .map((entry) => ({ id: entry.id, at: entry.at, tone: entry.tone, message: entry.message }));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass-2">Desk</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-4xl">Overview</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{site.name}</span>
            <Badge tone={site.ghost.status === "connected" ? "ok" : site.ghost.status === "error" ? "danger" : "muted"}>
              {site.ghost.status === "connected" ? "Connected" : site.ghost.status === "error" ? "Error" : "Not connected"}
            </Badge>
            <span>{ghostLive ? "Ghost live" : site.ghost.mode === "studio" ? "Ghost sandbox" : "Ghost off"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/create" className="inline-flex min-h-11 items-center rounded-lg bg-brass px-4 text-sm font-medium text-ink">
            Create content
          </Link>
          <Link to="/connections" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm">
            Connections
          </Link>
        </div>
      </header>

      <SetupGuide />

      <KpiBento cards={bento} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <VelocityChart
            points={buckets.map((bucket) => ({ label: bucket.label, published: bucket.published, generated: bucket.generated }))}
            timeframe={timeframe}
            onTimeframe={setTimeframe}
            deltaPct={week.deltaPct}
          />
          <PostLedger rows={ledger} />
        </div>
        <div className="min-w-0 space-y-4">
          <BreakdownCard rows={pipeline} hint="Every stage of the desk, right now." />
          <TelemetryDrawer series={telemetry} logs={logs} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Golden path</h2>
              <p className="text-sm text-muted">The full product journey — your progress to a deployed static site</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-brass">{pct}%</div>
              <div className="font-mono text-xs text-faint">
                {done}/{steps.length} steps
              </div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map((step) => (
              <li key={step.label}>
                <Link to={step.href} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-brass">
                  <span className={step.done ? "text-brass" : "text-faint"}>{step.done ? "✓" : "○"}</span>
                  <span className="min-w-0">
                    <span className={step.done ? "block text-fg" : "block text-muted"}>{step.label}</span>
                    {!step.done ? <span className="block text-xs text-faint">{step.reason}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">System health</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Worker" v={data.workerPaused ? "Offline" : "Connected"} />
            <Row k="This site · running" v={String(jobs.filter((job) => job.status === "running").length)} />
            <Row k="This site · completed / failed" v={`${completed} / ${failed}`} />
            <Row k="Last heartbeat" v={beat ? relTime(beat) : "just now"} />
          </dl>
          <div className="mt-4 border-t border-line pt-3">
            {keyRows(data, day).map((row) => (
              <div key={row.id} className="flex items-center justify-between py-1 text-sm">
                <span>{row.label}</span>
                <span className="text-muted">
                  {compact(row.tokens)} {row.allowanceUsd > 0 ? "" : "(unlimited)"}
                </span>
              </div>
            ))}
            <p className="mt-2 text-xs text-faint">Resets {nextUtcResetLabel()} · UTC day</p>
          </div>
        </Card>
      </div>

      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-xs uppercase tracking-widest text-faint">Last static build</div>
          {build ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={statusTone(build.status)}>{build.status}</Badge>
              <span>
                {build.pages} pages · {Math.round(build.bytes / 1024)} KB · {relTime(build.at)}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No build yet.</p>
          )}
        </div>
        <Link to="/static-delivery" className="text-sm text-brass">
          Open delivery
        </Link>
      </Card>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent runs</h2>
            <Link to="/runs" className="text-sm text-brass">
              View all
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {runs.slice(0, 5).map((run) => (
              <li key={run.id}>
                <Link to="/runs/$id" params={{ id: run.id }} className="flex min-w-0 items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{run.title}</span>
                    <span className="text-xs text-faint">
                      {run.type} · {jobs.filter((job) => job.runId === run.id).length} jobs · {relTime(run.createdAt)}
                    </span>
                  </span>
                  <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                </Link>
              </li>
            ))}
            {!runs.length ? <li className="py-6 text-sm text-muted">No runs on this website yet.</li> : null}
          </ul>
        </Card>
        <Card className="min-w-0 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent articles</h2>
            <Link to="/articles" className="text-sm text-brass">
              View all
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {articles.slice(0, 5).map((article) => (
              <li key={article.id}>
                <Link to="/articles/$id" params={{ id: article.id }} className="flex min-w-0 items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{article.title}</span>
                    <span className="text-xs text-faint">
                      {article.engine} · {article.status} · {relTime(article.publishedAt)}
                    </span>
                  </span>
                  <Badge tone={statusTone(article.status)}>{article.status}</Badge>
                </Link>
              </li>
            ))}
            {!articles.length ? <li className="py-6 text-sm text-muted">No articles yet.</li> : null}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-lg font-semibold">Internal link graph</h2>
        <p className="mt-1 text-xs text-faint">{links} edges</p>
        <ul className="mt-3 divide-y divide-line">
          {edges.map((edge, index) => (
            <li key={`${edge.slug}-${index}`} className="py-2 text-sm">
              <span className="text-muted">{edge.from.slice(0, 48)}</span>
              <span className="text-faint"> links to </span>
              <span>“{edge.anchor}”</span>
            </li>
          ))}
          {!edges.length ? <li className="py-4 text-sm text-muted">Links appear after a second article is published.</li> : null}
        </ul>
      </Card>

      <CommandBar />
    </div>
  );
}

function keyRows(data: { keys: { id: string; label: string; allowanceUsd: number; disabled: boolean }[]; events: { keyId: string; state: string; at: number; tokens: number }[] }, day: string) {
  return data.keys
    .filter((key) => !key.disabled)
    .slice(0, 3)
    .map((key) => ({
      id: key.id,
      label: key.label,
      allowanceUsd: key.allowanceUsd,
      tokens: data.events.filter((event) => event.keyId === key.id && event.state === "SETTLED" && utcDay(event.at) === day).reduce((sum, event) => sum + event.tokens, 0),
    }));
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-1.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right text-fg">{v}</dd>
    </div>
  );
}
