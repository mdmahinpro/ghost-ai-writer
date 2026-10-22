import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApp, useHydrated } from "@/lib/store";
import type { ResearchProject, ResearchStageKey } from "@/lib/types";
import { Badge, Button, Card, Empty, Field, PageIntro, SkeletonRows, StateNote, fieldClass } from "@/components/ui";
import { relTime } from "@/lib/utils";

const TABS = ["Overview", "Niche", "Audiences", "Problems", "Topic map", "Queries", "Coverage", "Clusters & plan"] as const;
type Tab = (typeof TABS)[number];

function statusPill(project: ResearchProject) {
  if (project.status === "ready") return <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">READY</span>;
  if (project.status === "failed") return <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-500">FAILED</span>;
  return <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">PARTIAL</span>;
}

function StageCard({ project, stageKey }: { project: ResearchProject; stageKey: ResearchStageKey }) {
  const retryResearchStage = useApp((s) => s.retryResearchStage);
  const stage = project.stages.find((record) => record.key === stageKey)!;
  const failed = stage.status === "failed";
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{stage.name}</span>
          <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs uppercase tracking-widest text-faint">{stage.engine}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={stage.status === "done" ? "ok" : failed ? "danger" : "muted"}>{stage.status}</Badge>
          <span className="text-xs text-faint">{stage.tokens ? `${stage.tokens.toLocaleString()} tok` : stage.engine === "derived" ? "0 tok (derived)" : "—"}</span>
          {stage.durationMs ? <span className="text-xs text-faint">{(stage.durationMs / 1000).toFixed(1)}s</span> : null}
          {stage.attempts ? <span className="text-xs text-faint">×{stage.attempts}</span> : null}
          {failed ? (
            <Button className="min-h-8 px-2 py-1 text-xs" onClick={() => retryResearchStage(project.id, stageKey)}>
              Retry from here
            </Button>
          ) : null}
        </div>
      </div>
      {failed && stage.error ? <p className="mt-2 text-xs leading-5 text-red-500">{stage.error}</p> : null}
      {stage.note ? <p className="mt-2 text-xs leading-5 text-faint">{stage.note}</p> : null}
      {stage.status === "done" ? <Provenance project={project} stageKey={stageKey} /> : null}
    </div>
  );
}

function Provenance({ project, stageKey }: { project: ResearchProject; stageKey: ResearchStageKey }) {
  const [open, setOpen] = useState(false);
  const output = project.output;
  const slice = useMemo(() => {
    switch (stageKey) {
      case "niche":
        return output.niche ? { entityMap: output.niche.entityMap, subNiches: output.niche.subNiches, terminology: output.niche.terminology, purpose: output.niche.purpose } : null;
      case "audience":
        return output.audience;
      case "problem":
        return output.problems;
      case "topic-universe":
        return output.topicUniverse;
      case "query-expansion":
        return output.queries?.map((query) => ({ query: query.query, topic: query.topic }));
      case "intent-class":
        return output.queries?.filter((query) => query.intent).map((query) => ({ query: query.query, intent: query.intent }));
      case "semantic-consolidation":
        return output.queries?.filter((query) => query.status === "merged").map((query) => ({ merged: query.query, into: query.mergedInto }));
      case "coverage":
        return output.coverage;
      case "cluster-construction":
        return output.clusters;
      case "action-class":
        return output.actions;
      case "priority":
        return output.priority;
      default:
        return null;
    }
  }, [output, stageKey]);
  return (
    <div className="mt-2">
      <button type="button" className="text-xs text-brass" onClick={() => setOpen(!open)}>
        {open ? "Hide provenance" : "Show provenance"}
      </button>
      {open ? <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-paper/70 p-2 text-xs leading-5">{JSON.stringify(slice, null, 2)}</pre> : null}
    </div>
  );
}

function ClusterList({ project }: { project: ResearchProject }) {
  const queuePlanFromResearch = useApp((s) => s.queuePlanFromResearch);
  const navigate = useNavigate();
  const clusters = project.output.clusters ?? [];
  const universe = project.output.topicUniverse;
  return (
    <div>
      <div className="rounded-lg border border-line p-3">
        <Badge tone="ok">pillar</Badge>
        <div className="mt-2 font-semibold">{universe?.pillar ?? "—"}</div>
        <p className="mt-1 text-xs leading-5 text-faint">Queued last; each cluster writes first.</p>
      </div>
      <ul className="mt-3 space-y-2">
        {clusters.map((cluster) => (
          <li key={cluster.id} className="rounded-lg border border-line p-3">
            <div className="font-medium">{cluster.title}</div>
            <div className="mt-1 text-sm text-muted">{cluster.angle}</div>
            {cluster.queries.length ? <div className="mt-1 text-xs text-faint">Owns {cluster.queries.length} query(ies)</div> : null}
          </li>
        ))}
        {!clusters.length ? <li className="text-sm text-muted">R9 has not produced clusters yet.</li> : null}
      </ul>
      <Button
        className="mt-3"
        onClick={() => {
          const planId = queuePlanFromResearch(project.id);
          if (planId) navigate({ to: "/topic-plans/$id", params: { id: planId } });
        }}
      >
        Build the topic plan from these clusters
      </Button>
    </div>
  );
}

function ProjectDetail({ project }: { project: ResearchProject }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const runResearch = useApp((s) => s.runResearch);
  const archiveResearch = useApp((s) => s.archiveResearch);
  const done = project.stages.filter((stage) => stage.status === "done").length;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">{project.niche}</h2>
        <div className="flex items-center gap-2">
          {statusPill(project)}
          <span className="text-xs text-faint">
            {done}/11 stages · {project.breadth} · attempt {project.attempts} · {relTime(project.createdAt)}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="min-h-9 px-3 py-1.5 text-sm" onClick={() => void runResearch(project.id)}>
          {done ? "Resume the missing stages" : "Run the 11-stage engine"}
        </Button>
        <Button className="min-h-9 px-3 py-1.5 text-sm" variant="ghost" onClick={() => archiveResearch(project.id)}>
          {project.archived ? "Restore" : "Archive"}
        </Button>
      </div>
       <div className="segmented mt-5" aria-label="Research sections">
        {TABS.map((entry) => (
          <button
            key={entry}
            type="button"
            aria-pressed={tab === entry}
            onClick={() => setTab(entry)}
          >
            {entry}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {tab === "Overview" ? (
          <>
           <p className="max-w-prose text-sm leading-6 text-muted">
              AI interpretation — an AI reading of your description and corpus. Your corrections take precedence. Never shows volume, difficulty, rankings, or traffic.
            </p>
            {project.facts.map((fact) => (
              <div key={fact.id} className="rounded-lg border border-line p-3">
                <Badge>{fact.label}</Badge>
                 <p className="mt-2 max-w-prose leading-7 text-muted">{fact.text}</p>
              </div>
            ))}
            <div className="mt-3 space-y-2">
              {project.stages.map((stage) => (
                <StageCard key={stage.key} project={project} stageKey={stage.key} />
              ))}
            </div>
          </>
        ) : null}
        {tab === "Niche"
          ? project.output.niche
            ? (
                <div className="space-y-2">
                  <Card className="p-3">
                    <div className="text-xs uppercase tracking-widest text-faint">Entity map</div>
                    <p className="mt-2 leading-6">{project.output.niche.entityMap}</p>
                  </Card>
                  <Card className="p-3">
                    <div className="text-xs uppercase tracking-widest text-faint">Purpose</div>
                    <p className="mt-2 leading-6">{project.output.niche.purpose}</p>
                  </Card>
                  <div className="flex flex-wrap gap-1.5">
                    {[...project.output.niche.subNiches, ...project.output.niche.terminology].map((tag) => (
                      <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )
            : <p className="text-muted">R1 has not completed yet.</p>
          : null}
        {tab === "Audiences"
          ? (project.output.audience ?? []).map((row, index) => (
              <Card key={index} className="p-3">
                <div className="font-medium">{row.persona}</div>
                <p className="mt-1 text-sm text-muted">Intent: {row.intent}</p>
                <p className="mt-1 text-sm text-muted">Pain: {row.pain}</p>
              </Card>
            ))
          : null}
        {tab === "Problems"
          ? (project.output.problems ?? []).map((row, index) => (
              <Card key={index} className="p-3">
                <Badge tone="danger">{row.persona}</Badge>
                <p className="mt-2 leading-6">{row.problem}</p>
              </Card>
            ))
          : null}
        {tab === "Topic map"
          ? project.output.topicUniverse
            ? (
                <div>
                  <div className="font-semibold">{project.output.topicUniverse.pillar}</div>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {project.output.topicUniverse.clusters.map((cluster) => (
                      <li key={cluster.title}>· {cluster.title}</li>
                    ))}
                  </ul>
                </div>
              )
            : <p className="text-muted">R4 has not completed yet.</p>
          : null}
        {tab === "Queries" ? <QueryTable project={project} /> : null}
        {tab === "Coverage"
          ? (project.output.coverage ?? []).map((row) => (
              <div key={row.queryId} className="flex items-start justify-between gap-3 rounded-lg border border-line p-3">
                <div>
                  <div className="font-medium">{row.query}</div>
                  <div className="mt-1 text-xs text-faint">{row.evidence}</div>
                </div>
                <Badge tone={row.state === "covered" ? "ok" : row.state === "partial" ? "muted" : "danger"}>{row.state}</Badge>
              </div>
            ))
          : null}
        {tab === "Clusters & plan" ? <ClusterList project={project} /> : null}
      </div>
    </Card>
  );
}

function QueryTable({ project }: { project: ResearchProject }) {
  const queries = project.output.queries ?? [];
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-paper/70 text-left text-xs uppercase tracking-widest text-faint">
            <th className="p-2">Query</th>
            <th className="p-2">Intent</th>
            <th className="p-2">State</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {queries.map((query) => (
            <tr key={query.id} className={query.status === "merged" ? "opacity-50" : ""}>
              <td className="p-2">
                {query.query}
                {query.status === "merged" ? <div className="text-xs text-faint">merged into {query.mergedInto}</div> : null}
              </td>
              <td className="p-2">{query.intent ?? "—"}</td>
              <td className="p-2">{query.status}</td>
            </tr>
          ))}
          {!queries.length ? (
            <tr>
              <td className="p-3 text-muted" colSpan={3}>
                R5 has not produced queries yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function ResearchPage() {
  const hydrated = useHydrated();
  const siteId = useApp((s) => s.activeSiteId);
  const projects = useApp((s) => s.research);
  const addResearch = useApp((s) => s.addResearch);
  const mine = useMemo(() => projects.filter((project) => project.siteId === siteId && !project.archived), [projects, siteId]);
  const archived = useMemo(() => projects.filter((project) => project.siteId === siteId && project.archived), [projects, siteId]);
  const [niche, setNiche] = useState("");
  const [notes, setNotes] = useState("");
  const [breadth, setBreadth] = useState<ResearchProject["breadth"]>("standard");
  const [openId, setOpenId] = useState<string | null>(null);

  // Rule 7: a real loading state instead of an empty flash before the store hydrates.
  if (!hydrated) return <SkeletonRows rows={4} />;

  return (
    <div>
      <PageIntro
        eyebrow="Content"
        title="Research"
        lede="An 11-stage engine studies the niche you describe — niche, audiences, problems, topic universe, real queries, intent, semantic consolidation, coverage, clusters, actions, priority. It never shows search volume, difficulty, rankings, or traffic, and stage retries continue from what is missing without re-charging the rest."
      />
      <Card className="mb-4 space-y-3 p-5">
        <Field label="Niche" hint="At least 3 characters. Example: specialty coffee brewing at home.">
          <input className={fieldClass} value={niche} onChange={(e) => setNiche(e.target.value)} />
        </Field>
        <Field label="Notes you want kept" hint="Saved with the evidence label You wrote this.">
          <textarea className={fieldClass} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Corpus breadth" hint="How wide R5 casts for real user queries.">
          <div className="flex gap-2">
            {(["compact", "standard", "wide"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={breadth === option}
                className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${breadth === option ? "border-brass bg-brass/10 text-brass" : "border-line"}`}
                onClick={() => setBreadth(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </Field>
        <Button
          disabled={niche.trim().length < 3}
          onClick={() => {
            addResearch(niche, notes, breadth);
            setNotes("");
          }}
        >
          Research this niche
        </Button>
      </Card>
      {!mine.length ? (
        <Empty title="No research yet" body="Start from your own description. The engine completes 11 stages, and a good run turns into a topic plan with clusters first." />
      ) : (
        <div className="space-y-4">
          {mine.map((project) => (
            <div key={project.id}>
              <div className="text-xs text-faint">breadth: {project.breadth}</div>
              {openId === project.id ? (
                <ProjectDetail project={project} />
              ) : (
                <Card className="p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-2xl">{project.niche}</h2>
                    <div className="flex items-center gap-2">
                      {statusPill(project)}
                      <span className="text-xs text-faint">{relTime(project.createdAt)}</span>
                    </div>
                  </div>
                  {project.status !== "ready" && project.stages.some((stage) => stage.status === "failed") ? (
                    <div className="mt-3">
                      <StateNote
                        tone={project.stagesCompleted ? "partial" : "error"}
                        title={project.stagesCompleted ? `${project.stagesCompleted}/11 stages complete` : "The first stage failed"}
                        body={
                          project.stages.find((stage) => stage.status === "failed")?.error ??
                          "A model stage stopped safely. Retry continues from what is missing without re-charging finished stages."
                        }
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => setOpenId(project.id)}>Open the 11-stage detail</Button>
                    <Link to="/create" className="inline-flex min-h-11 items-center text-sm text-brass">
                      Or get keyword ideas
                    </Link>
                  </div>
                </Card>
              )}
            </div>
          ))}
          {archived.length ? (
            <Card className="p-5">
              <h3 className="font-semibold">Archived ({archived.length})</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {archived.map((project) => (
                  <li key={project.id} className="flex items-center justify-between gap-3">
                    <span className="text-muted">
                      {project.niche} · {project.status}
                    </span>
                    <ArchivedToggle project={project} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ArchivedToggle({ project }: { project: ResearchProject }) {
  const archiveResearch = useApp((s) => s.archiveResearch);
  return (
    <Button className="min-h-8 px-2 py-1 text-xs" onClick={() => archiveResearch(project.id)}>
      Restore
    </Button>
  );
}
