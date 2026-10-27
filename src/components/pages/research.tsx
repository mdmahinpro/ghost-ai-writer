import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useApp, useHydrated } from "@/lib/store";
import type { ResearchProject, ResearchStageKey } from "@/lib/types";
import { Badge, Button, Card, Field, PageIntro, SkeletonRows, StateNote, fieldClass } from "@/components/ui";
import { relTime } from "@/lib/utils";

const TABS = ["Overview", "Niche", "Audiences", "Problems", "Topic map", "Queries", "Coverage", "Clusters & plan"] as const;
type Tab = (typeof TABS)[number];

function statusPill(project: ResearchProject) {
  if (project.status === "ready") return <span className="inline-flex items-center rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[11px] font-medium leading-5 text-ok">READY</span>;
  if (project.status === "failed") return <span className="inline-flex items-center rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] font-medium leading-5 text-danger">FAILED</span>;
  return <span className="inline-flex items-center rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[11px] font-medium leading-5 text-warn">PARTIAL</span>;
}

function StageCard({ project, stageKey }: { project: ResearchProject; stageKey: ResearchStageKey }) {
  const retryResearchStage = useApp((s) => s.retryResearchStage);
  const stage = project.stages.find((record) => record.key === stageKey)!;
  const failed = stage.status === "failed";
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[13px] font-medium text-fg">{stage.name}</span>
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{stage.engine}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={stage.status === "done" ? "ok" : failed ? "danger" : "muted"}>{stage.status}</Badge>
          <span className="num text-[11px] text-faint">{stage.tokens ? `${stage.tokens.toLocaleString()} tok` : stage.engine === "derived" ? "0 tok (derived)" : "—"}</span>
          {stage.durationMs ? <span className="num text-[11px] text-faint">{(stage.durationMs / 1000).toFixed(1)}s</span> : null}
          {stage.attempts ? <span className="num text-[11px] text-faint">×{stage.attempts}</span> : null}
          {failed ? (
            <Button variant="secondary" size="sm" onClick={() => retryResearchStage(project.id, stageKey)}>
              Retry from here
            </Button>
          ) : null}
        </div>
      </div>
      {failed && stage.error ? <p className="mt-2 text-[11px] leading-5 text-danger">{stage.error}</p> : null}
      {stage.note ? <p className="mt-2 text-[11px] leading-5 text-faint">{stage.note}</p> : null}
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
    <div className="mt-1.5">
      <button type="button" className="text-[11px] font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-brass" onClick={() => setOpen(!open)}>
        {open ? "Hide provenance" : "Show provenance"}
      </button>
      {open ? <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-line bg-surface p-3 font-mono text-[11px] leading-5 text-muted">{JSON.stringify(slice, null, 2)}</pre> : null}
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
      <div className="rounded-md bg-surface px-4 py-3">
        <Badge tone="ok">pillar</Badge>
        <div className="mt-2 text-[13px] font-semibold text-fg">{universe?.pillar ?? "—"}</div>
        <p className="mt-1 text-[11px] leading-5 text-faint">Queued last; each cluster writes first.</p>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {clusters.map((cluster) => (
          <li key={cluster.id} className="py-2.5">
            <div className="text-[13px] font-medium text-fg">{cluster.title}</div>
            <div className="mt-1 text-[12px] leading-5 text-muted">{cluster.angle}</div>
            {cluster.queries.length ? <div className="num mt-1 text-[11px] text-faint">Owns {cluster.queries.length} query(ies)</div> : null}
          </li>
        ))}
        {!clusters.length ? <li className="py-2 text-[12px] text-muted">R9 has not produced clusters yet.</li> : null}
      </ul>
      <Button
        className="mt-4"
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
    <Card className="overflow-hidden rounded-xl p-0">
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-fg">{project.niche}</h2>
            <p className="num mt-1 text-[11px] text-faint">
              {done}/11 stages · {project.breadth} · attempt {project.attempts} · {relTime(project.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusPill(project)}
            <Button size="sm" onClick={() => void runResearch(project.id)}>
              {done ? "Resume the missing stages" : "Run the 11-stage engine"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => archiveResearch(project.id)}>
              {project.archived ? "Restore" : "Archive"}
            </Button>
          </div>
        </div>
        <div className="segmented mt-4" aria-label="Research sections">
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
      </div>
      <div className="space-y-3 p-5 text-sm">
        {tab === "Overview" ? (
          <>
           <p className="max-w-prose text-[13px] leading-6 text-muted">
              AI interpretation — an AI reading of your description and corpus. Your corrections take precedence. Never shows volume, difficulty, rankings, or traffic.
            </p>
            <div className="divide-y divide-line">
              {project.facts.map((fact) => (
                <div key={fact.id} className="py-3">
                  <Badge>{fact.label}</Badge>
                   <p className="mt-2 max-w-prose text-[13px] leading-6 text-muted">{fact.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 divide-y divide-line border-t border-line">
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
                  <div className="divide-y divide-line">
                    <div className="py-3">
                      <div className="eyebrow">Entity map</div>
                      <p className="mt-1.5 text-[13px] leading-6 text-muted">{project.output.niche.entityMap}</p>
                    </div>
                    <div className="py-3">
                      <div className="eyebrow">Purpose</div>
                      <p className="mt-1.5 text-[13px] leading-6 text-muted">{project.output.niche.purpose}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[...project.output.niche.subNiches, ...project.output.niche.terminology].map((tag) => (
                      <span key={tag} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )
            : <p className="text-[13px] text-muted">R1 has not completed yet.</p>
          : null}
        {tab === "Audiences"
          ? (project.output.audience ?? []).map((row, index) => (
              <div key={index} className="border-b border-line py-3 last:border-b-0">
                <div className="text-[13px] font-medium text-fg">{row.persona}</div>
                <p className="mt-1 text-[12px] text-muted">Intent: {row.intent}</p>
                <p className="mt-0.5 text-[12px] text-muted">Pain: {row.pain}</p>
              </div>
            ))
          : null}
        {tab === "Problems"
          ? (project.output.problems ?? []).map((row, index) => (
              <div key={index} className="border-b border-line py-3 last:border-b-0">
                <Badge tone="danger">{row.persona}</Badge>
                <p className="mt-2 text-[13px] leading-6 text-muted">{row.problem}</p>
              </div>
            ))
          : null}
        {tab === "Topic map"
          ? project.output.topicUniverse
            ? (
                <div>
                  <div className="text-[13px] font-semibold text-fg">{project.output.topicUniverse.pillar}</div>
                  <ul className="mt-2 divide-y divide-line border-t border-line">
                    {project.output.topicUniverse.clusters.map((cluster) => (
                      <li key={cluster.title} className="py-1.5 text-[13px] text-muted">· {cluster.title}</li>
                    ))}
                  </ul>
                </div>
              )
            : <p className="text-[13px] text-muted">R4 has not completed yet.</p>
          : null}
        {tab === "Queries" ? <QueryTable project={project} /> : null}
        {tab === "Coverage"
          ? (project.output.coverage ?? []).map((row) => (
              <div key={row.queryId} className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-fg">{row.query}</div>
                  <div className="mt-1 text-[11px] leading-5 text-faint">{row.evidence}</div>
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
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface text-left text-[10px] uppercase tracking-[0.12em] text-faint">
            <th className="p-2.5">Query</th>
            <th className="p-2.5">Intent</th>
            <th className="p-2.5">State</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {queries.map((query) => (
            <tr key={query.id} className={query.status === "merged" ? "opacity-50" : ""}>
              <td className="p-2.5 text-[13px] text-fg">
                {query.query}
                {query.status === "merged" ? <div className="mt-0.5 text-[11px] text-faint">merged into {query.mergedInto}</div> : null}
              </td>
              <td className="p-2.5 text-[12px] text-muted">{query.intent ?? "—"}</td>
              <td className="p-2.5 font-mono text-[11px] text-muted">{query.status}</td>
            </tr>
          ))}
          {!queries.length ? (
            <tr>
              <td className="p-3 text-[12px] text-muted" colSpan={3}>
                R5 has not produced queries yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ResearchEmpty() {
  return (
    <div className="rounded-xl border border-line bg-elev px-6 py-14 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-lg bg-brass/10 text-brass">
        <FlaskConical aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-fg">No research yet</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-muted">Start from your own description. The engine completes 11 stages, and a good run turns into a topic plan with clusters first.</p>
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
        action={
          <div className="flex items-end gap-6">
            <div className="text-right">
              <div className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-fg tabular-nums">{mine.length}</div>
              <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-faint">projects</div>
            </div>
            <div className="border-l border-line pl-6 text-right">
              <div className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-faint tabular-nums">{archived.length}</div>
              <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-faint">archived</div>
            </div>
          </div>
        }
      />
      <Card className="mb-5 rounded-xl p-0">
        <div className="space-y-4 p-5">
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
                  className={`min-h-9 rounded-md border px-3 text-[13px] capitalize transition-colors duration-150 ${breadth === option ? "border-brass bg-brass/10 text-fg" : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg"}`}
                  onClick={() => setBreadth(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-3.5">
          <Button
            disabled={niche.trim().length < 3}
            onClick={() => {
              addResearch(niche, notes, breadth);
              setNotes("");
            }}
          >
            Research this niche
          </Button>
        </div>
      </Card>
      {!mine.length ? (
        <ResearchEmpty />
      ) : (
        <div className="space-y-4">
          {mine.map((project) => (
            <div key={project.id}>
              <div className="mb-1.5 text-[11px] text-faint">breadth: {project.breadth}</div>
              {openId === project.id ? (
                <ProjectDetail project={project} />
              ) : (
                <Card className="rounded-xl p-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-fg">{project.niche}</h2>
                    <div className="flex items-center gap-2">
                      {statusPill(project)}
                      <span className="num text-[11px] text-faint">{relTime(project.createdAt)}</span>
                    </div>
                  </div>
                  {project.status !== "ready" && project.stages.some((stage) => stage.status === "failed") ? (
                    <div className="px-5 pb-4">
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
                  <div className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3.5">
                    <Button size="sm" onClick={() => setOpenId(project.id)}>Open the 11-stage detail</Button>
                    <Link to="/create" className="text-[13px] font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-brass">
                      Or get keyword ideas
                    </Link>
                  </div>
                </Card>
              )}
            </div>
          ))}
          {archived.length ? (
            <Card className="overflow-hidden rounded-xl p-0">
              <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
                <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Archived ({archived.length})</h3>
              </div>
              <ul className="divide-y divide-line">
                {archived.map((project) => (
                  <li key={project.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0 truncate text-[12px] text-muted">
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
    <Button variant="secondary" size="sm" onClick={() => archiveResearch(project.id)}>
      Restore
    </Button>
  );
}
