import { Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { ArrowRight, PlayCircle, TriangleAlert } from "lucide-react";
import { keyCallsModel, runMetrics, usdFor } from "@/lib/engine";
import { useApp, useHydrated } from "@/lib/store";
import { Button, Card, PageIntro, SkeletonRows, StateNote, jobBadge, statusTone } from "@/components/ui";
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

function pillTone(tone: ReturnType<typeof statusTone>): "ok" | "danger" | "warn" | "muted" {
  return tone === "brass" ? "muted" : tone;
}

function Pill({ tone = "muted", children }: { tone?: "ok" | "danger" | "warn" | "muted"; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${
        tone === "ok"
          ? "border-ok/30 bg-ok/10 text-ok"
          : tone === "danger"
            ? "border-danger/30 bg-danger/10 text-danger"
            : tone === "warn"
              ? "border-warn/30 bg-warn/10 text-warn"
              : "border-line bg-surface text-muted"
      }`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  return <Pill tone={tone === "brass" ? "warn" : tone}>{label ?? status}</Pill>;
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
    <div className="space-y-5">
      <PageIntro
        eyebrow="Content"
        title="Runs"
        lede="Content generation runs — durable jobs that survive a refresh. Two articles per website at a time. Work continues if you leave this page, unless the worker is offline."
      />
      {keysCooling || failedJobs ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <TriangleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-warn" />
            <span>
              {keysCooling ? `${keysCooling} key${keysCooling === 1 ? "" : "s"} cooling · ` : ""}
              {failedJobs ? `${failedJobs} failed job${failedJobs === 1 ? "" : "s"}` : ""}
            </span>
          </p>
          <Button variant="secondary" size="sm" onClick={() => clearCooldowns()}>
            Clear cooldown & retry all pending jobs
          </Button>
        </div>
      ) : null}
      <L3Proof />
      {runs.some((run) => run.status === "partial" || run.status === "failed") ? (
        <StateNote
          tone={runs.some((run) => run.status === "failed") ? "error" : "partial"}
          title="Some runs did not finish cleanly"
          body="Refused or failed jobs stay on their run with the reason, and nothing was published. Open the run to restart a specific job or leave it refused."
        />
      ) : null}
      {!runs.length ? (
        <div className="rounded-xl border border-line bg-elev px-6 py-16 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-lg bg-brass/10 text-brass">
            <PlayCircle aria-hidden="true" strokeWidth={1.6} className="size-5" />
          </span>
          <h2 className="mt-4 font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">No runs yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-muted">
            Start with 2–3 keywords. Refusals stay on the run so you can see why a keyword never wrote.
          </p>
          <Link
            className="mt-5 inline-flex min-h-9 items-center rounded-md bg-brass px-3.5 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-brass-2"
            to="/create"
          >
            Create
          </Link>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-xl p-0">
          <div className="divide-y divide-line">
            {runs.map((run) => {
              const mine = jobs.filter((job) => job.runId === run.id);
              const metrics = runMetrics(mine);
              return (
                <Link
                  key={run.id}
                  to="/runs/$id"
                  params={{ id: run.id }}
                  className="group block px-5 py-4 transition-colors duration-150 hover:bg-surface-2/60"
                >
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="truncate text-[14px] font-medium text-fg">{run.title}</span>
                        <StatusPill status={run.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-faint">
                        <span>{run.type === "topic-plan" ? "Topic plan" : "Keywords"}</span>
                        <span aria-hidden="true">·</span>
                        <span className="num">{mine.length} jobs</span>
                        <span aria-hidden="true">·</span>
                        <span className="num">{run.createdAt ? relTime(run.createdAt) : "—"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                      <span className="num text-ok">{metrics.completed} completed</span>
                      <span className="num text-muted">{metrics.inflight} running</span>
                      {metrics.held ? <span className="num text-muted">{metrics.held} held</span> : null}
                      {metrics.waiting ? <span className="num text-muted">{metrics.waiting} waiting to publish</span> : null}
                      {metrics.failed ? <span className="num text-danger">{metrics.failed} failed</span> : null}
                    </div>
                    <div className="num w-16 text-right text-[13px] text-fg">{money(metrics.usd)}</div>
                    <ArrowRight
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4 shrink-0 text-faint transition-colors duration-150 group-hover:text-fg"
                    />
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brass" style={{ width: `${metrics.progress}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
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
  if (!run) return <EmptyRun />;
  const site = sites.find((item) => item.id === run.siteId);
  const isServerRun = run.modelKeyId === "server";
  const key = isServerRun ? undefined : keys.find((item) => item.id === run.modelKeyId);
  const callsModel = isServerRun ? true : keyCallsModel(key);
  const recorded = jobs.some((job) => job.modelUsage?.draft || job.modelUsage?.revision);
  const sample = { prompt: 640, completion: 812, total: 1452 };
  const metrics = runMetrics(jobs);
  const refused = jobs.filter((job) => job.status === "refused");
  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow={`${site?.name ?? "Workspace"} · ${run.type === "topic-plan" ? "Topic plan" : "Keywords"}`}
        title={run.title}
        lede={
          run.publishMode === "live"
            ? "Publishing live in Ghost. This choice was frozen when the run started."
            : "Saving as Ghost drafts. This choice was frozen when the run started."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={run.status} />
            <Button
              variant="secondary"
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
        }
      />
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="grid md:grid-cols-2 md:divide-x md:divide-line">
          <div className="p-5">
            <div className="eyebrow">This run’s key</div>
            {isServerRun ? (
              <p className="mt-2.5 text-[13px] leading-6 text-muted">
                No local key is used for this run. Draft and revision are written by the server worker using the provider sealed on the server — token counts and cost are the provider totals reported by the ledger, not estimates.
              </p>
            ) : (
              <>
                <p className="mt-2.5 text-[13px] leading-6 text-muted">
                  {recorded
                    ? "Draft and revision on this run settled provider usage. The token count is the provider total, and the cost is that total times the key price per million. The article body is the model text, not the template."
                    : callsModel
                      ? `${key?.label} has a secret and a base URL. Draft and revision call the model and replace the template. The ledger uses the provider’s usage total.`
                      : `${key?.label ?? "This key"} has no secret and base URL. The article stays the template. Every stage records 0 tokens, $0, and “estimated — no model called”.`}
                </p>
                {key?.lastError ? (
                  <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 font-mono text-[11px] leading-5 break-words text-danger">
                    {key.lastError}
                    {key.cooldownUntil ? (
                      <span className="block text-faint">Cooldown for another {Math.max(0, Math.round((key.cooldownUntil - Date.now()) / 1000))}s</span>
                    ) : null}
                  </p>
                ) : null}
                {key?.cooldownUntil || key?.lastError ? (
                  <Button className="mt-3" variant="ghost" size="sm" onClick={() => clearCooldowns()}>
                    Clear cooldown & retry all pending jobs
                  </Button>
                ) : null}
              </>
            )}
          </div>
          <div className="border-t border-line p-5 md:border-t-0">
            <div className="eyebrow">How a real usage object is billed</div>
            <p className="mt-2.5 text-[13px] leading-6 text-muted">
              {isServerRun
                ? "The server worker reports the provider’s real usage per call — a provider total of prompt + completion tokens settles cost at the server provider’s rate. Revision is a second call. Intent, metadata, enrichment, and publish stay at 0."
                : `A provider usage of ${sample.prompt} prompt + ${sample.completion} completion settles ${sample.total} tokens · ${money(usdFor(sample.total, key?.pricePerM ?? 6))} at this key’s price. Revision is a second call. Intent, metadata, enrichment, and publish stay at 0.`}
            </p>
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
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
            <div key={label} className="bg-elev px-4 py-3.5">
              <div className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{label}</div>
              <div className="mt-1.5 font-display text-[24px] leading-none text-fg">{value}</div>
            </div>
          ))}
        </div>
        <div className="h-1 bg-surface-2">
          <div className="h-full bg-brass" style={{ width: `${metrics.progress}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line bg-surface/60 px-4 py-2.5 text-[12px] text-muted">
          <span className="num text-fg">{metrics.progress}%</span>
          <span className="num">{money(metrics.usd)}</span>
          <span className="num">{compact(metrics.tokens)} tokens</span>
          <span className="num">{metrics.settledCalls} settled calls</span>
          {metrics.cancelled ? <span className="num">{metrics.cancelled} cancelled</span> : null}
        </div>
      </Card>
      {refused.length ? (
        <Card className="rounded-xl p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-sans text-[14px] font-semibold normal-case tracking-[-0.01em] text-fg">Refused at the submission gate (duplicate protection)</h2>
          </div>
          <ul className="divide-y divide-line">
            {refused.map((job) => (
              <li key={job.id} className="px-5 py-2.5 text-[13px] text-muted">
                {job.keyword} — {job.refusalReason}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="divide-y divide-line">
          {jobs.map((job) => (
            <div key={job.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-fg">{job.title}</span>
                    <StatusPill
                      status={job.status}
                      label={job.refusalReason && job.status === "refused" ? job.refusalReason : jobBadge(job.status)}
                    />
                  </div>
                  <div className="mt-1 text-[12px] text-faint">
                    {job.kind}
                    {job.variant ? " · variant" : ""} · {job.keyword}
                    {(job.attempt ?? 1) > 1 ? ` · attempt ${job.attempt}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {job.status === "failed" ? (
                    <Button variant="secondary" size="sm" onClick={() => retryJob(job.id)}>
                      Restart failed
                    </Button>
                  ) : null}
                  {job.status === "review-held" ? (
                    <>
                      <Button size="sm" onClick={() => decideJob(job.id, true)}>
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => decideJob(job.id, false)}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {job.status === "publish-held" ? (
                    <Button size="sm" onClick={() => releaseJob(job.id)}>
                      {run.publishMode === "live" ? "Publish now" : "Save to Ghost now"}
                    </Button>
                  ) : null}
                  {job.status === "refused" || job.status === "completed" ? (
                    <Button variant="ghost" size="sm" onClick={() => variantJob(job.id)}>
                      {job.articleId ? "Regenerate article" : "Regenerate as variant"}
                    </Button>
                  ) : null}
                  {job.articleId && (job.status === "completed" || job.status === "publish-held") ? (
                    <Link
                      to="/articles/$id"
                      params={{ id: job.articleId }}
                      className="inline-flex min-h-8 items-center rounded-md border border-line bg-surface px-3 text-[13px] text-fg transition-colors duration-150 hover:border-line-strong"
                    >
                      {run.publishMode === "live" && job.status === "completed" ? "Published" : "Article"}
                    </Link>
                  ) : null}
                </div>
              </div>
              {job.failReason ? <p className="mt-2 text-[13px] leading-6 text-danger">{job.failReason}</p> : null}
              {job.embedNote ? <p className="mt-2 text-[13px] leading-6 text-muted">{job.embedNote}</p> : null}
              {job.status === "review-held" ? <p className="mt-2 text-[13px] leading-6 text-muted">{job.refusalReason}</p> : null}
              {typeof job.humanizerScore === "number" ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Pill tone={job.humanizerScore >= 90 ? "ok" : job.humanizerScore >= 70 ? "warn" : "danger"}>
                    Blader humanizer · prose purity {job.humanizerScore}/100
                  </Pill>
                  <Pill>{job.humanizerPasses === 2 ? "audit + rewrite (2 passes)" : "deterministic pass"}</Pill>
                  {job.humanizerStripped?.length ? (
                    <span className="num text-[11px] text-faint">{job.humanizerStripped.length} AI pattern(s) stripped in revision</span>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
                {job.stages.map((stage) => (
                  <div key={stage.key} className="bg-elev px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-fg">{stage.label}</span>
                      <Pill tone={pillTone(statusTone(stage.status))}>{stageLabel(stage.status)}</Pill>
                    </div>
                    <div className="num mt-1 text-[11px] leading-5 text-faint">
                      {stage.status === "done" ? `${stage.tokens} tokens` : stage.status === "running" ? (callsModel && (stage.key === "draft" || stage.key === "revision") ? "calling the model…" : "in progress…") : "waiting"}
                      {stage.note ? ` · ${stage.note}` : ""}
                      {stage.key === "publish" && stage.status === "done" ? " · 0 LLM" : ""}
                      {stage.finishedAt && stage.startedAt ? ` · ${Math.max(1, Math.round((stage.finishedAt - stage.startedAt) / 100) / 10)}s` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EmptyRun() {
  return (
    <div className="rounded-xl border border-line bg-elev px-6 py-16 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-lg bg-surface-2 text-faint">
        <PlayCircle aria-hidden="true" strokeWidth={1.6} className="size-5" />
      </span>
      <h2 className="mt-4 font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Run missing</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-muted">That run is not in this studio.</p>
    </div>
  );
}
