import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApp, useHydrated } from "@/lib/store";
import { Badge, Button, Card, Empty, Field, PageIntro, SkeletonRows, fieldClass, statusTone } from "@/components/ui";
import { relTime } from "@/lib/utils";

export function PlansPage() {
  const siteId = useApp((s) => s.activeSiteId);
  const plansAll = useApp((s) => s.plans);
  const plans = useMemo(() => plansAll.filter((plan) => plan.siteId === siteId), [plansAll, siteId]);
  return (
    <div>
      <PageIntro eyebrow="Content" title="Topic plans" lede="A plan is a pillar plus supporting topics. Review it before anything is written. Clusters dispatch first." />
      {!plans.length ? (
        <Empty title="No topic plans" body="Generate one from Create. Nothing is written to Ghost until you queue selected topics." action={<Link to="/create" className="text-sm text-brass">Open Create</Link>} />
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link key={plan.id} to="/topic-plans/$id" params={{ id: plan.id }} className="block">
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-display text-2xl">{plan.topic}</div>
                  <div className="mt-1 text-xs text-muted">
                    {plan.clusters.filter((c) => !c.excluded).length} clusters kept{plan.error ? ` · ${plan.error}` : ""} · {relTime(plan.createdAt)}
                  </div>
                </div>
                <Badge tone={statusTone(plan.status)}>{plan.status === "review" ? "READY" : plan.status}</Badge>
              </Card>
            </Link>
          ))}
        </div>
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

  return (
    <div>
      <PageIntro eyebrow="Topic plan" title={plan.topic} lede="Pillar and cluster topics. Unselected topics are excluded when you queue. Excluded topics are never generated." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(plan.status)}>{plan.status === "review" ? "READY" : plan.status}</Badge>
        <span className="text-sm text-muted">{dispatched} cluster topics already completed</span>
        {plan.runId ? (
          <Link to="/runs/$id" params={{ id: plan.runId }} className="text-sm text-brass">
            View run
          </Link>
        ) : null}
      </div>
      {review ? (
        <Card className="mb-4 grid gap-3 p-5 sm:grid-cols-2">
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
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-brass">Pillar page</span>
          <Badge>Pillar</Badge>
        </div>
        <h2 className="mt-2 font-display text-3xl">{plan.pillarTitle}</h2>
        <p className="mt-2 text-sm text-muted">{plan.pillarAngle}</p>
        <p className="mt-2 text-xs text-faint">Queued last, after every included cluster has resolved.</p>
      </Card>
      <h2 className="mb-3 mt-6 font-display text-2xl">Pillar & cluster topics · {selected.length} selected</h2>
      <div className="space-y-2">
        {plan.clusters.map((cluster, index) => {
          const job = jobs.find((item) => item.id === cluster.jobId);
          const on = cluster.selected !== false && !cluster.excluded;
          return (
            <Card key={cluster.id} className="p-4">
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
                  <span>
                    <span className={on ? "block font-medium" : "block text-faint line-through"}>{cluster.title}</span>
                    <span className="mt-1 block text-xs text-muted">{cluster.angle.includes("—") ? cluster.angle.split("—").slice(1).join("—").trim() : cluster.angle}</span>
                    <span className="mt-1 block text-xs text-faint">{cluster.source === "you" ? "You wrote this" : "AI-suggested topic"} · {job ? job.status : "PROPOSED"}</span>
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {job ? <Badge tone={statusTone(job.status)}>{job.status}</Badge> : null}
                  {review ? (
                    <>
                      <Button variant="quiet" onClick={() => moveCluster(plan.id, cluster.id, -1)} disabled={index === 0} aria-label="Move up">
                        Up
                      </Button>
                      <Button variant="quiet" onClick={() => moveCluster(plan.id, cluster.id, 1)} disabled={index === plan.clusters.length - 1} aria-label="Move down">
                        Down
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(cluster.id);
                          setDraftTitle(cluster.title);
                          setDraftAngle(cluster.angle);
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => updateCluster(plan.id, cluster.id, { excluded: on, selected: !on })}>
                        {on ? "Exclude" : "Restore"}
                      </Button>
                      <Button variant="danger" onClick={() => removeCluster(plan.id, cluster.id)}>
                        Remove
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              {editing === cluster.id ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
            </Card>
          );
        })}
      </div>
      {review ? (
        <Card className="mt-4 space-y-3 p-5">
          <h3 className="font-display text-xl">Add topic</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Article title" hint="At least 3 characters.">
              <input className={fieldClass} value={ownTitle} onChange={(e) => setOwnTitle(e.target.value)} />
            </Field>
            <Field label="Angle" hint="Optional. At least 10 characters if you write one.">
              <input className={fieldClass} value={ownAngle} onChange={(e) => setOwnAngle(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-brass" checked={asPillar} onChange={(e) => setAsPillar(e.target.checked)} />
            Make this the pillar page for the plan
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
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
            <Button
              disabled={!hydrated || selected.length < 2}
              title={hydrated ? undefined : "Still connecting to the workspace store…"}
              onClick={() => {
                void (async () => {
                  const runId = await queueTopic(plan.id, { publishMode, modelKeyId });
                  if (runId) navigate({ to: "/runs/$id", params: { id: runId } });
                })();
              }}
            >
              Queue selected ({selected.length})
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
