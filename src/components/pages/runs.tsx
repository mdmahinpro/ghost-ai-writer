import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { keyCallsModel, runMetrics, usdFor } from "@/lib/engine";
import { useApp, useHydrated } from "@/lib/store";
import { Badge, Button, Card, Empty, PageIntro, SkeletonRows, StateNote, jobBadge, statusTone } from "@/components/ui";
import { L3Proof } from "@/components/l3-proof";
import { money, compact, relTime } from "@/lib/utils";

function downloadCsv(name: string, rows: string[][]) {
  const body = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function RunsPage() {
  const hydrated = useHydrated();
  const siteId = useApp((s) => s.activeSiteId);
  const runsAll = useApp((s) => s.runs);
  const runs = useMemo(() => runsAll.filter((run) => run.siteId === siteId), [runsAll, siteId]);
  const jobs = useApp((s) => s.jobs);
  const clearCooldowns = useApp((s) => s.clearCooldowns);
  const keysCooling = useApp((s) => s.keys.filter((key) => key.cooldownUntil).length);
  const failedJobs = useMemo(() => jobs.filter((job) => job.status === "failed").length, [jobs]);
  // Rule 7: honest loading state before the store hydrates.
  if (!hydrated) return <SkeletonRows rows={5} />;
  return (
    <div>
      <PageIntro eyebrow="Content" title="Runs" lede="Content generation runs — durable jobs that survive a refresh. Two articles per website at a time. Work continues if you leave this page, unless the worker is offline." />
      {keysCooling || failedJobs ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brass/40 bg-brass/5 px-4 py-3">
          <p className="text-sm text-muted">
            {keysCooling ? `${keysCooling} key${keysCooling === 1 ? "" : "s"} cooling · ` : ""}
            {failedJobs ? `${failedJobs} failed job${failedJobs === 1 ? "" : "s"}` : ""}
          </p>
          <Button
            variant="ghost"
            onClick={() => clearCooldowns()}
          >
            Clear cooldown & retry all pending jobs
          </Button>
        </div>
      ) : null}
      <L3Proof />
      {runs.some((run) => run.status === "partial" || run.status === "failed") ? (
        <div className="mb-4">
          <StateNote
            tone={runs.some((run) => run.status === "failed") ? "error" : "partial"}
            title="Some runs did not finish cleanly"
            body="Refused or failed jobs stay on their run with the reason, and nothing was published. Open the run to restart a specific job or leave it refused."
          />
        </div>
      ) : null}
      {!runs.length ? (
        <Empty title="No runs yet" body="Start with 2–3 keywords. Refusals stay on the run so you can see why a keyword never wrote." action={<Link className="text-sm text-brass" to="/create">Create</Link>} />
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const mine = jobs.filter((job) => job.runId === run.id);
            const metrics = runMetrics(mine);
            return (
              <Link key={run.id} to="/runs/$id" params={{ id: run.id }} className="block">
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{run.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {run.type === "topic-plan" ? "Topic plan" : "Keywords"} · {mine.length} jobs · {relTime(run.createdAt)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="text-ok">{metrics.completed} completed</span>
                      <span className="text-brass">{metrics.inflight} running</span>
                      {metrics.held ? <span>{metrics.held} held</span> : null}
                      {metrics.waiting ? <span>{metrics.waiting} waiting to publish</span> : null}
                      {metrics.failed ? <span className="text-danger">{metrics.failed} failed</span> : null}
                    </div>
                  </div>
                  <span className="text-sm text-muted">{money(metrics.usd)}</span>
                  <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function stageLabel(status: string) {
  if (status === "running") return "in progress…";
  if (status === "pending") return "waiting";
  if (status === "done") return "done";
  return status;
}

export function RunDetail({ id }: { id: string }) {
  const hydrated = useHydrated();
  const run = useApp((s) => s.runs.find((item) => item.id === id));
  const jobsAll = useApp((s) => s.jobs);
  const jobs = useMemo(() => jobsAll.filter((job) => job.runId === id), [jobsAll, id]);
  const sites = useApp((s) => s.sites);
  const keys = useApp((s) => s.keys);
  const stopRun = useApp((s) => s.stopRun);
  const retryJob = useApp((s) => s.retryJob);
  const clearCooldowns = useApp((s) => s.clearCooldowns);
  const variantJob = useApp((s) => s.variantJob);
  const decideJob = useApp((s) => s.decideJob);
  const releaseJob = useApp((s) => s.releaseJob);
  // Rule 7: never show "Run missing" while the workspace is still hydrating from
  // IndexedDB — a run created just before this mount is there after hydration.
  if (!hydrated) return <SkeletonRows rows={5} />;
  if (!run) return <Empty title="Run missing" body="That run is not in this studio." />;
  const site = sites.find((item) => item.id === run.siteId);
  const key = keys.find((item) => item.id === run.modelKeyId);
  const callsModel = keyCallsModel(key);
  const recorded = jobs.some((job) => job.modelUsage?.draft || job.modelUsage?.revision);
  const sample = { prompt: 640, completion: 812, total: 1452 };
  const metrics = runMetrics(jobs);
  const refused = jobs.filter((job) => job.status === "refused");
  return (
    <div>
      <PageIntro
        eyebrow={`${site?.name ?? "Workspace"} · ${run.type === "topic-plan" ? "Topic plan" : "Keywords"}`}
        title={run.title}
        lede={
          run.publishMode === "live"
            ? "Publishing live in Ghost. This choice was frozen when the run started."
            : "Saving as Ghost drafts. This choice was frozen when the run started."
        }
      />
      <Card className="mb-4 grid gap-3 p-4 md:grid-cols-2">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-faint">This run’s key</div>
          <p className="mt-2 text-sm leading-6 text-muted">
            {recorded
              ? "Draft and revision on this run settled provider usage. The token count is the provider total, and the cost is that total times the key price per million. The article body is the model text, not the template."
              : callsModel
              ? `${key?.label} has a secret and a base URL. Draft and revision call the model and replace the template. The ledger uses the provider’s usage total.`
              : `${key?.label ?? "This key"} has no secret and base URL. The article stays the template. Every stage records 0 tokens, $0, and “estimated — no model called”.`}
          </p>
          {key?.lastError ? (
            <p className="mt-2 rounded-lg border border-danger/30 bg-danger/5 px-2 py-1.5 font-mono text-xs break-words text-danger">
              {key.lastError}
              {key.cooldownUntil ? <span className="block text-faint">Cooldown for another {Math.max(0, Math.round((key.cooldownUntil - Date.now()) / 1000))}s</span> : null}
            </p>
          ) : null}
          {key?.cooldownUntil || key?.lastError ? (
            <Button className="mt-2" variant="ghost" onClick={() => clearCooldowns()}>
              Clear cooldown & retry all pending jobs
            </Button>
          ) : null}
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-faint">How a real usage object is billed</div>
          <p className="mt-2 text-sm leading-6 text-muted">
            A provider usage of {sample.prompt} prompt + {sample.completion} completion settles {sample.total} tokens · {money(usdFor(sample.total, key?.pricePerM ?? 6))} at this key’s price. Revision is a second call. Intent, metadata, enrichment, and publish stay at 0.
          </p>
        </div>
      </Card>
      <Card className="mb-4 overflow-hidden p-0">
        <div className="grid grid-cols-3 divide-line/70 sm:grid-cols-6 sm:divide-x">
          {(
            [
              ["Completed", metrics.completed],
              ["In flight", metrics.inflight],
              ["Failed", metrics.failed],
              ["Refused", metrics.refused],
              ["Awaiting review", metrics.held],
              ["Waiting to publish", metrics.waiting],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="px-3.5 py-3">
              <div className="truncate text-[11px] uppercase tracking-[0.06em] text-faint">{label}</div>
              <div className="num mt-1 text-[18px] leading-none text-fg">{value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line bg-surface/40 px-3.5 py-2 text-[12px] text-muted">
          <span className="num text-fg">{metrics.progress}%</span>
          <span className="num">{money(metrics.usd)}</span>
          <span className="num">{compact(metrics.tokens)} tokens</span>
          <span className="num">{metrics.settledCalls} settled calls</span>
          {metrics.cancelled ? <span className="num">{metrics.cancelled} cancelled</span> : null}
          <Badge tone={statusTone(run.status)}>{run.status}</Badge>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `${run.title.replace(/\s+/g, "-").toLowerCase()}.csv`,
                  [
                    ["keyword", "status", "kind", "variant", "attempt", "tokens", "usd", "article", "reason"],
                    ...jobs.map((job) => [
                      job.keyword,
                      jobBadge(job.status),
                      job.kind,
                      job.variant ? "yes" : "no",
                      String(job.attempt ?? 1),
                      String(job.tokens),
                      String(job.costUsd),
                      job.articleId ?? "",
                      job.refusalReason ?? job.failReason ?? "",
                    ]),
                  ],
                )
              }
            >
              CSV
            </Button>
            {run.status === "queued" || run.status === "running" ? (
              <Button variant="danger" size="sm" onClick={() => stopRun(run.id)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
      {refused.length ? (
        <Card className="mb-4 p-4">
          <h2 className="font-medium">Refused at the submission gate (duplicate protection)</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {refused.map((job) => (
              <li key={job.id}>
                {job.keyword} — {job.refusalReason}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{job.title}</div>
                <div className="text-xs text-muted">
                  {job.kind}
                  {job.variant ? " · variant" : ""} · {job.keyword}
                  {(job.attempt ?? 1) > 1 ? ` · attempt ${job.attempt}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={statusTone(job.status)}>{job.refusalReason && job.status === "refused" ? job.refusalReason : jobBadge(job.status)}</Badge>
                {job.status === "failed" ? (
                  <Button variant="ghost" onClick={() => retryJob(job.id)}>
                    Restart failed
                  </Button>
                ) : null}
                {job.status === "review-held" ? (
                  <>
                    <Button onClick={() => decideJob(job.id, true)}>Approve</Button>
                    <Button variant="danger" onClick={() => decideJob(job.id, false)}>
                      Reject
                    </Button>
                  </>
                ) : null}
                {job.status === "publish-held" ? (
                  <Button onClick={() => releaseJob(job.id)}>{run.publishMode === "live" ? "Publish now" : "Save to Ghost now"}</Button>
                ) : null}
                {job.status === "refused" || job.status === "completed" ? (
                  <Button variant="ghost" onClick={() => variantJob(job.id)}>
                    {job.articleId ? "Regenerate article" : "Regenerate as variant"}
                  </Button>
                ) : null}
                {job.articleId && (job.status === "completed" || job.status === "publish-held") ? (
                  <Link to="/articles/$id" params={{ id: job.articleId }} className="inline-flex min-h-11 items-center text-sm text-brass">
                    {run.publishMode === "live" && job.status === "completed" ? "Published" : "Article"}
                  </Link>
                ) : null}
              </div>
            </div>
            {job.failReason ? <p className="mt-2 text-sm text-danger">{job.failReason}</p> : null}
            {job.embedNote ? <p className="mt-2 text-sm text-muted">{job.embedNote}</p> : null}
            {job.status === "review-held" ? <p className="mt-2 text-sm text-muted">{job.refusalReason}</p> : null}
            {typeof job.humanizerScore === "number" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={job.humanizerScore >= 90 ? "ok" : job.humanizerScore >= 70 ? "brass" : "danger"}>
                  Blader humanizer · prose purity {job.humanizerScore}/100
                </Badge>
                <Badge tone="muted">{job.humanizerPasses === 2 ? "audit + rewrite (2 passes)" : "deterministic pass"}</Badge>
                {job.humanizerStripped?.length ? <span className="text-xs text-faint">{job.humanizerStripped.length} AI pattern(s) stripped in revision</span> : null}
              </div>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {job.stages.map((stage) => (
                <div key={stage.key} className="rounded-lg border border-line bg-elev px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{stage.label}</span>
                    <Badge tone={statusTone(stage.status)}>{stageLabel(stage.status)}</Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-faint">
                    {stage.status === "done" ? `${stage.tokens} tokens` : stage.status === "running" ? (callsModel && (stage.key === "draft" || stage.key === "revision") ? "calling the model…" : "in progress…") : "waiting"}
                    {stage.note ? ` · ${stage.note}` : ""}
                    {stage.key === "publish" && stage.status === "done" ? " · 0 LLM" : ""}
                    {stage.finishedAt && stage.startedAt ? ` · ${Math.max(1, Math.round((stage.finishedAt - stage.startedAt) / 100) / 10)}s` : ""}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
