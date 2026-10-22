import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { goldenSteps } from "@/lib/engine";
import { SetupGuide } from "@/components/setup-guide";
import { useBeat } from "@/components/shell";
import { Badge, Card, statusTone } from "@/components/ui";
import { compact, nextUtcResetLabel, relTime, utcDay } from "@/lib/utils";

export function OverviewPage() {
  const data = useApp();
  // Rule 7 hooks rule: every hook runs before any early return so the order is stable.
  const beat = useBeat((s) => s.at);
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
  const tokensToday = data.events
    .filter((event) => event.state === "SETTLED" && utcDay(event.at) === day)
    .reduce((sum, event) => sum + event.tokens, 0);
  const links = articles.reduce((sum, article) => sum + article.links.length, 0);
  const verified = articles.reduce(
    (sum, article) => sum + article.links.filter((link) => link.state === "GHOST_CONFIRMED" || link.state === "STATIC_CONFIRMED").length,
    0,
  );
  const localLinks = Math.max(0, links - verified);
  const published = articles.filter((article) => article.status === "published" || article.ledger.confirmed).length;
  const build = data.builds.find((item) => item.siteId === site.id);
  const steps = goldenSteps(data, site);
  const done = steps.filter((step) => step.done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const running = jobs.filter((job) => job.status === "running" || job.status === "queued").length;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const ghostLive = site.ghost.mode === "live";
  const edges = articles
    .flatMap((article) => article.links.slice(0, 2).map((link) => ({ from: article.title, anchor: link.anchor, slug: link.targetSlug })))
    .slice(0, 8);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass-2">Desk</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Overview</h1>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Articles" value={String(articles.length)} hint={`${published} published`} />
        <Stat label="Active runs" value={String(runs.filter((run) => run.status === "running" || run.status === "queued").length)} hint={`${running} jobs queued`} />
        <Stat label="Link graph" value={String(links)} hint={`${verified} verified · ${localLinks} local`} />
        <Stat label="Tokens today" value={compact(tokensToday)} hint={tokensToday ? "settled today" : "no usage today"} />
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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="px-5 py-5">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-faint">{label}</div>
      <div className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-2 text-sm text-muted">{hint}</div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-1.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right text-fg">{v}</dd>
    </div>
  );
}
