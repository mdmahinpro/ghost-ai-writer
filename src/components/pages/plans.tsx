import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Layers } from "lucide-react";
import { useApp, useHydrated } from "@/lib/store";
import { Badge, Button, Card, Empty, Field, PageIntro, SkeletonRows, fieldClass, statusTone } from "@/components/ui";
import { relTime } from "@/lib/utils";

function PlansEmpty() {
  return (
    <div className="rounded-xl border border-line bg-elev px-6 py-14 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-lg bg-brass/10 text-brass">
        <Layers aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-fg">No topic plans</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-6 text-muted">Generate one from Create. Nothing is written to Ghost until you queue selected topics.</p>
      <Link to="/create" className="mt-5 inline-flex min-h-10 items-center rounded-md bg-brass px-4 text-sm font-medium text-ink shadow-xs transition-colors duration-150 hover:bg-brass-2">
        Open Create
      </Link>
    </div>
  );
}

export function PlansPage() {
  const siteId = useApp((s) => s.activeSiteId);
  const plansAll = useApp((s) => s.plans);
  const plans = useMemo(() => plansAll.filter((plan) => plan.siteId === siteId), [plansAll, siteId]);
  return (
    <div>
      <PageIntro
        eyebrow="Content"
        title="Topic plans"
        lede="A plan is a pillar plus supporting topics. Review it before anything is written. Clusters dispatch first."
        action={
          <Link
            to="/create"
            className="inline-flex min-h-10 items-center rounded-md bg-brass px-4 text-sm font-medium text-ink shadow-xs transition-colors duration-150 hover:bg-brass-2"
          >
            Open Create
          </Link>
        }
      />
      {!plans.length ? (
        <PlansEmpty />
      ) : (
        <Card className="overflow-hidden rounded-xl p-0">
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
            <span className="eyebrow">Plans</span>
            <span className="num text-[11px] text-faint">{plans.length}</span>
          </div>
          <div className="divide-y divide-line">
            {plans.map((plan) => (
              <Link key={plan.id} to="/topic-plans/$id" params={{ id: plan.id }} className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-2/60">
                <div className="min-w-0">
                  <div className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-fg">{plan.topic}</div>
                  <div className="num mt-1 truncate text-[11px] text-faint">
                    {plan.clusters.filter((c) => !c.excluded).length} clusters kept{plan.error ? ` · ${plan.error}` : ""} · {relTime(plan.createdAt)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={statusTone(plan.status)}>{plan.status === "review" ? "READY" : plan.status}</Badge>
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-4 text-faint transition-colors duration-150 group-hover:text-fg" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function PlanDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const plan = useApp((s) => s.plans.find((item) => item.id === id));
  const jobs = useApp((s) => s.jobs);
  const keys = useApp((s) => s.keys);
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]!);
  // Keys are per workspace: only this workspace's own keys are offered here.
  const siteKeys = keys.filter((key) => key.siteId === site.id);
  const updateCluster = useApp((s) => s.updateCluster);
  const moveCluster = useApp((s) => s.moveCluster);
  const removeCluster = useApp((s) => s.removeCluster);
  const addCluster = useApp((s) => s.addCluster);
  const queueTopic = useApp((s) => s.queueTopic);
  const [publishMode, setPublishMode] = useState<"default" | "draft" | "live">("draft");
  const [modelKeyId, setModelKeyId] = useState("default");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAngle, setDraftAngle] = useState("");
  const [ownTitle, setOwnTitle] = useState("");
  const [ownAngle, setOwnAngle] = useState("");
  const [asPillar, setAsPillar] = useState(false);
  // Rule 7: "Plan missing" only counts after the workspace has hydrated.
  if (!hydrated) return <SkeletonRows rows={5} />;
  if (!plan) return <Empty title="Plan missing" body="That topic plan is not on this browser." />;
  const review = plan.status === "review";
  const selected = plan.clusters.filter((cluster) => cluster.selected !== false && !cluster.excluded);
  const dispatched = plan.clusters.filter((cluster) => cluster.jobId && jobs.find((job) => job.id === cluster.jobId)?.status === "completed").length;

  const queueSelected = () => {
    void (async () => {
      const runId = await queueTopic(plan.id, { publishMode, modelKeyId });
      if (runId) navigate({ to: "/runs/$id", params: { id: runId } });
    })();
  };

  return (
    <div>
      <PageIntro
        eyebrow="Topic plan"
        title={plan.topic}
        lede="Pillar and cluster topics. Unselected topics are excluded when you queue. Excluded topics are never generated."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {plan.runId ? (
              <Link
                to="/runs/$id"
                params={{ id: plan.runId }}
                className="inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-fg shadow-xs transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
              >
                View run
              </Link>
            ) : null}
            {review ? (
              <Button
                disabled={!hydrated || selected.length < 2}
                title={hydrated ? undefined : "Still connecting to the workspace store…"}
                onClick={queueSelected}
              >
                Queue selected ({selected.length})
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone={statusTone(plan.status)}>{plan.status === "review" ? "READY" : plan.status}</Badge>
        <span className="text-[12px] text-muted">{dispatched} cluster topics already completed</span>
      </div>
      {review ? (
        <Card className="mb-4 grid gap-3 rounded-xl p-5 sm:grid-cols-2">
          <Field label="Publish as" hint={`Effective: ${publishMode === "default" ? site.voice.publishAs : publishMode}`}>
            <select className={fieldClass} value={publishMode} onChange={(e) => setPublishMode(e.target.value as typeof publishMode)}>
              <option value="default">Site default ({site.voice.publishAs})</option>
              <option value="live">Publish live in Ghost</option>
              <option value="draft">Save as Ghost draft</option>
            </select>
          </Field>
          <Field label="AI model" hint={siteKeys.length === 0 ? "No AI key is saved in this workspace yet. Add one on AI Keys." : undefined}>
            <select className={fieldClass} value={modelKeyId} onChange={(e) => setModelKeyId(e.target.value)}>
              <option value="default">This workspace’s key</option>
              {siteKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.label}
                </option>
              ))}
            </select>
          </Field>
        </Card>
      ) : null}
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <span className="eyebrow">Pillar page</span>
          <Badge>Pillar</Badge>
        </div>
        <div className="p-5">
          <h2 className="max-w-3xl font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-fg">{plan.pillarTitle}</h2>
          <p className="mt-2 max-w-prose text-[13px] leading-6 text-muted">{plan.pillarAngle}</p>
          <p className="mt-3 text-[11px] text-faint">Queued last, after every included cluster has resolved.</p>
        </div>
      </Card>
      <div className="mb-3 mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Pillar & cluster topics</h2>
          <p className="mt-0.5 text-[12px] text-muted">{selected.length} selected</p>
        </div>
      </div>
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="divide-y divide-line">
          {plan.clusters.map((cluster, index) => {
            const job = jobs.find((item) => item.id === cluster.jobId);
            const on = cluster.selected !== false && !cluster.excluded;
            return (
              <div key={cluster.id} className="px-5 py-3.5 transition-colors duration-150 hover:bg-surface-2/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex min-w-0 items-start gap-3">
                    {review ? (
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-brass"
                        checked={on}
                        onChange={(event) => updateCluster(plan.id, cluster.id, { selected: event.target.checked, excluded: !event.target.checked })}
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span className={on ? "block text-[13px] font-medium text-fg" : "block text-[13px] text-faint line-through"}>{cluster.title}</span>
                      <span className="mt-1 block text-[12px] leading-5 text-muted">{cluster.angle.includes("—") ? cluster.angle.split("—").slice(1).join("—").trim() : cluster.angle}</span>
                      <span className="mt-1 block text-[11px] text-faint">{cluster.source === "you" ? "You wrote this" : "AI-suggested topic"} · {job ? job.status : "PROPOSED"}</span>
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    {job ? <Badge tone={statusTone(job.status)}>{job.status}</Badge> : null}
                    {review ? (
                      <>
                        <Button variant="quiet" size="sm" onClick={() => moveCluster(plan.id, cluster.id, -1)} disabled={index === 0} aria-label="Move up">
                          Up
                        </Button>
                        <Button variant="quiet" size="sm" onClick={() => moveCluster(plan.id, cluster.id, 1)} disabled={index === plan.clusters.length - 1} aria-label="Move down">
                          Down
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(cluster.id);
                            setDraftTitle(cluster.title);
                            setDraftAngle(cluster.angle);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => updateCluster(plan.id, cluster.id, { excluded: on, selected: !on })}>
                          {on ? "Exclude" : "Restore"}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => removeCluster(plan.id, cluster.id)}>
                          Remove
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                {editing === cluster.id ? (
                  <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto]">
                    <input className={fieldClass} value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} aria-label="Title" />
                    <input className={fieldClass} value={draftAngle} onChange={(e) => setDraftAngle(e.target.value)} aria-label="Angle" />
                    <Button
                      onClick={() => {
                        updateCluster(plan.id, cluster.id, { title: draftTitle.trim(), angle: draftAngle.trim() });
                        setEditing(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
      {review ? (
        <Card className="mt-4 rounded-xl p-5">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Add topic</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Article title" hint="At least 3 characters.">
              <input className={fieldClass} value={ownTitle} onChange={(e) => setOwnTitle(e.target.value)} />
            </Field>
            <Field label="Angle" hint="Optional. At least 10 characters if you write one.">
              <input className={fieldClass} value={ownAngle} onChange={(e) => setOwnAngle(e.target.value)} />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" className="size-4 accent-brass" checked={asPillar} onChange={(e) => setAsPillar(e.target.checked)} />
            Make this the pillar page for the plan
          </label>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              disabled={ownTitle.trim().length < 3 || (ownAngle.trim().length > 0 && ownAngle.trim().length < 10)}
              onClick={() => {
                addCluster(plan.id, ownTitle, ownAngle, asPillar);
                setOwnTitle("");
                setOwnAngle("");
                setAsPillar(false);
              }}
            >
              Add topic
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
