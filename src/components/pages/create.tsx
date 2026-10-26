import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { classifyLines } from "@/lib/operator";
import { keyCallsModel, keyPool } from "@/lib/engine";
import { proposePlan } from "@/lib/rewrite";
import { useApp, useHydrated } from "@/lib/store";
import { Badge, Button, Card, Field, PageIntro, fieldClass } from "@/components/ui";

const SAMPLE = "how to narrow a research question\nfield notes after a failed experiment\nreading lists that stay short";

export function CreatePage() {
  const navigate = useNavigate();
  // Rule 7: mutating actions wait for IndexedDB hydration or the run is lost.
  const hydrated = useHydrated();
  const siteId = useApp((s) => s.activeSiteId);
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]!);
  const keys = useApp((s) => s.keys);
  const limits = useApp((s) => s.limits);
  const ideas = useApp((s) => s.ideas);
  const plansAll = useApp((s) => s.plans);
  const plans = useMemo(() => plansAll.filter((plan) => plan.siteId === siteId), [plansAll, siteId]);
  const nicheIdeas = ideas?.siteId === siteId ? ideas : null;
  const queueKeywords = useApp((s) => s.queueKeywords);
  const runIdeas = useApp((s) => s.runIdeas);
  const clearCooldowns = useApp((s) => s.clearCooldowns);
  const makePlan = useApp((s) => s.makePlan);
  const failPlan = useApp((s) => s.failPlan);
  const installModelPlan = useApp((s) => s.installModelPlan);
  const [planning, setPlanning] = useState(false);
  const [tab, setTab] = useState<"keywords" | "plan">("keywords");
  const [lines, setLines] = useState("");
  const [publishMode, setPublishMode] = useState<"default" | "draft" | "live">("draft");
  const [modelKeyId, setModelKeyId] = useState("default");
  const [variants, setVariants] = useState(false);
  const [research, setResearch] = useState("");
  const [niche, setNiche] = useState(site.nicheTag.replace(/-/g, " "));
  const [ideaCount, setIdeaCount] = useState(8);
  const [thinking, setThinking] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [ideaMode, setIdeaMode] = useState<"ideas" | "research">("ideas");
  const [topic, setTopic] = useState("");

  const { marks, kept } = classifyLines(lines, limits.keywordCap);
  const ideaOptions = useMemo(() => [8, 12, 16, 20, 50, 100].filter((count) => limits.ideaCap == null || count <= limits.ideaCap), [limits.ideaCap]);
  const effective = publishMode === "default" ? site.voice.publishAs : publishMode;
  // Only this workspace's keys: a key saved in another workspace is not offered
  // here, and a workspace that has none must have one added by hand.
  const siteKeys = useMemo(() => keys.filter((key) => key.siteId === site.id), [keys, site.id]);
  const chosen = siteKeys.find((key) => key.id === (modelKeyId === "default" ? site.voice.modelKeyId : modelKeyId));
  // A key saved on the server keeps no local `secret` by design — `addKey` seals it
  // there and drops it here, leaving `serverKeyId` as the proof it exists. Treating
  // "no secret" as "no key" disabled Start run for every server-saved key.
  const keyReady = Boolean(chosen && (chosen.serverKeyId !== undefined || chosen.secret));
  const needsKey = Boolean(chosen && chosen.kind === "custom" && !keyReady && chosen.provider !== "Studio");

  function addKeyword(keyword: string) {
    setLines((prev) => (prev.trim() ? `${prev.replace(/\s*$/, "")}\n${keyword}` : keyword));
    setAdded((prev) => (prev.includes(keyword) ? prev : [...prev, keyword]));
  }

  return (
    <div>
      <PageIntro
        eyebrow="Content"
        title="Create"
        lede="A run turns keywords into articles. Each keyword is written in six stages, then sent to Ghost once. Ideas are suggestions only — nothing is queued until you start the run."
      />
      <div className="segmented mb-6" aria-label="Create mode">
        {(["keywords", "plan"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            aria-pressed={tab === item}
          >
            {item === "keywords" ? "Keywords" : "Topic plan"}
          </button>
        ))}
      </div>

      {tab === "keywords" ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="space-y-4 p-5 lg:col-span-3">
            <Field
              label="Keywords (one per line)"
              hint={`${kept.length}${limits.keywordCap == null ? "" : `/${limits.keywordCap}`} will be submitted — ${limits.keywordCap == null ? "no cap; 10,000+ is fine" : "cap set in Settings"}. Blank lines and repeats are dropped. Lines over 200 characters are marked Too long.`}
            >
              <textarea value={lines} onChange={(e) => setLines(e.target.value)} rows={8} className={fieldClass} placeholder="One keyword per line" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setLines(SAMPLE)}>
                Add sample keywords
              </Button>
              <Button variant="ghost" onClick={() => clearCooldowns()} title="Clear key cooldowns and re-queue failed jobs">
                Clear cooldown & retry all pending jobs
              </Button>
              <Button
                disabled={!hydrated || !kept.length || needsKey}
                title={hydrated ? undefined : "Still connecting to the workspace store…"}
                onClick={() => {
                  void (async () => {
                    const runId = await queueKeywords({
                      lines: kept.join("\n"),
                      publishMode,
                      modelKeyId,
                      allowVariants: variants,
                      // Humanization is not optional in the pipeline: the draft
                      // and revision prompts both carry the linter's tell list,
                      // so every run is written humanized. There is no switch.
                      bulletproof: true,
                      researchUrls: research.split("\n").map((line) => line.trim()).filter(Boolean),
                    });
                    if (runId) navigate({ to: "/runs/$id", params: { id: runId } });
                  })();
                }}
              >
                Start run ({kept.length})
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Publish as" hint={`Effective: ${effective === "live" ? "Publish live in Ghost" : "Save as Ghost draft"}. Frozen when the run starts.`}>
                <select className={fieldClass} value={publishMode} onChange={(e) => setPublishMode(e.target.value as typeof publishMode)}>
                  <option value="default">Site default ({site.voice.publishAs})</option>
                  <option value="live" disabled={site.ghost.mode !== "live"}>
                    Publish live in Ghost{site.ghost.mode === "live" ? "" : " (locked — draft only)"}
                  </option>
                  <option value="draft">Save as Ghost draft (review first)</option>
                </select>
              </Field>
              <Field
                label="AI model"
                hint={
                  siteKeys.length === 0
                    ? "No AI key is saved in this workspace yet. Add one on AI Keys."
                    : needsKey
                      ? "This model needs a key."
                      : "This workspace's key uses the model on Content settings."
                }
              >
                <select className={fieldClass} value={modelKeyId} onChange={(e) => setModelKeyId(e.target.value)}>
                  <option value="default">This workspace’s key</option>
                  {siteKeys.map((key) => (
                    <option key={key.id} value={key.id} disabled={key.disabled}>
                      {key.label} · {key.model}
                      {key.disabled ? " · needs a key" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-brass" checked={variants} onChange={(e) => setVariants(e.target.checked)} />
              <span>
                <span className="block text-fg">Allow intentional variants</span>
                <span className="text-muted">Leave this off. Exact matches are refused unless you deliberately want a second angle.</span>
              </span>
            </label>
            <p className="text-sm text-muted">
              <span className="block text-fg">Humanization is automatic</span>
              Every run is written against the Blader humanizer's tell list — the draft and the revision both carry it, and
              the publish gate lints for the same patterns. There is no switch to turn it off.
            </p>
            <Field label="Research URLs" hint="Optional. One https URL per line. When the web-search switch is Tavily, Firecrawl, or Auto-Fallback (Settings → AI Keys & Usage), these pages are fetched before the model writes.">
              <textarea className={fieldClass} rows={3} value={research} onChange={(e) => setResearch(e.target.value)} placeholder="https://example.com/source" />
            </Field>
          </Card>
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-5">
              <h2 className="font-display text-xl">Normalized preview</h2>
              <ul className="mt-3 space-y-2 font-mono text-[13px] leading-6 text-muted">
                {marks.some((mark) => mark.state !== "blank") ? (
                  marks
                    .filter((mark) => mark.state !== "blank")
                    .map((mark, index) => (
                      <li key={`${mark.text}-${index}`} className={mark.state === "ok" ? "text-fg" : "text-danger"}>
                        {mark.state === "ok" ? mark.text : `${mark.text} — ${mark.state === "too-long" ? "Too long" : mark.state === "over-limit" ? "Over limit" : "Repeat"}`}
                      </li>
                    ))
                ) : (
                  <li>Nothing yet.</li>
                )}
              </ul>
            </Card>
            <Card className="p-5">
              <h2 className="font-display text-xl">What happens next</h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted">
                <li>Up to {limits.concurrency} article{limits.concurrency === 1 ? "" : "s"} write at a time on this website — raise it in Settings → Content.</li>
                <li>Six stages: Intent & Blueprint, Draft, Revision, Metadata, Enrichment, Validation & Publish.</li>
                <li>Duplicates are refused at exact, lexical, then semantic. Close calls wait as Review held.</li>
                <li>Stage 6 writes to Ghost once. A timeout reconciles by slug. It does not POST again.</li>
                <li>Photos come from Bing thumbnails: the query is the article title, and the frame is 1200×630 for the hero or 575×274 in the column, cropped with c=7.</li>
              <li>Internal links use phrases already in the paragraph and only point at pages on this site.</li>
              </ol>
            </Card>
            <Card className="p-5">
              <div className="segmented mb-4" aria-label="Idea source">
                <button aria-pressed={ideaMode === "ideas"} onClick={() => setIdeaMode("ideas")}>
                  AI ideas
                </button>
                <button aria-pressed={ideaMode === "research"} onClick={() => setIdeaMode("research")}>
                  Research (live sources)
                </button>
              </div>
              {ideaMode === "ideas" ? (
                <>
              <h2 className="text-lg font-semibold">AI keyword ideas</h2>
               <p className="mt-2 text-sm leading-6 text-muted">
                Suggestions are not search volume. Ideas already covered by articles, queued work, or Ghost posts are left out. Adding one does not start a run.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input className={fieldClass} value={niche} onChange={(e) => setNiche(e.target.value)} aria-label="Seed topic" placeholder="Seed topic" />
                <select className={fieldClass} value={ideaCount} onChange={(e) => setIdeaCount(Number(e.target.value))} aria-label="How many ideas">
                  {ideaOptions.map((count) => (
                    <option key={count} value={count}>
                      {count} ideas
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  disabled={niche.trim().length < 3 || thinking}
                  onClick={() => {
                    setThinking(true);
                    window.setTimeout(() => {
                      runIdeas(niche, ideaCount);
                      setAdded([]);
                      setThinking(false);
                    }, 500);
                  }}
                >
                  {thinking ? "Thinking…" : "Suggest"}
                </Button>
              </div>
              {nicheIdeas ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-faint">
                    <span>
                      Suggestions for “{nicheIdeas.niche}” · {nicheIdeas.engine} · {nicheIdeas.filtered} filtered · {nicheIdeas.tokens.toLocaleString()} tokens
                    </span>
                    <button
                      className="text-brass"
                      onClick={() => {
                        const room = nicheIdeas.items
                          .filter((idea) => !added.includes(idea.keyword))
                          .slice(0, limits.keywordCap == null ? undefined : Math.max(0, limits.keywordCap - kept.length));
                        for (const idea of room) addKeyword(idea.keyword);
                      }}
                    >
                      Add all
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {nicheIdeas.items.map((idea) => {
                      const on = added.includes(idea.keyword);
                      return (
                        <li key={idea.keyword} className="flex items-start justify-between gap-2 rounded-lg border border-line p-3">
                          <div>
                            <div className="text-sm">{idea.keyword}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                              <Badge>{idea.intent}</Badge>
                              <span>{idea.reason}</span>
                            </div>
                          </div>
                          <button className={`grid size-11 shrink-0 place-items-center rounded-lg border ${on ? "border-ok text-ok" : "border-line text-brass"}`} onClick={() => addKeyword(idea.keyword)} aria-label={`Add ${idea.keyword}`}>
                            {on ? "✓" : "+"}
                          </button>
                        </li>
                      );
                    })}
                    {!nicheIdeas.items.length ? <li className="text-sm text-muted">Every suggestion was already covered or rejected as commodity.</li> : null}
                    {nicheIdeas.rejected?.length ? <li className="text-xs text-faint">{nicheIdeas.rejected.length} model suggestions rejected by the {nicheIdeas.rejected.map((item) => item.layer).join(", ")} gate.</li> : null}
                  </ul>
                </div>
              ) : null}
                </>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold">Research from live sources</h2>
                  <p className="mt-2 text-xs leading-5 text-muted">
                    Paste pages you actually read, one https URL per line. With the web-search switch on (Tavily / Firecrawl / Auto-Fallback), those pages are fetched before the draft. Nothing here is search volume.
                  </p>
                  <textarea className={`${fieldClass} mt-3`} rows={5} value={research} onChange={(e) => setResearch(e.target.value)} placeholder="https://gophd.com/post/…" aria-label="Research URLs" />
                  <p className="mt-2 text-xs text-faint">Commodity headings — tips, tools, challenges, “effectively” — are filtered out of idea rounds.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="space-y-4 p-5 lg:col-span-3">
            <Field label="Topic" hint="At least 3 characters. Broad enough for a main guide, specific enough to own. A single word usually comes back vague.">
              <input className={fieldClass} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="home espresso" />
            </Field>
            <Button
              disabled={topic.trim().length < 3 || planning}
              onClick={() => {
                setPlanning(true);
                void (async () => {
                  try {
                    // Hotfix: only a credential-eligible key may propose a model plan.
                    // The studio ledger key has no secret/baseUrl — fall back to makePlan.
                    const pool = keyPool(useApp.getState(), site.voice.modelKeyId, Date.now(), site.id).filter((key) => keyCallsModel(key));
                    if (pool.length) {
                      const proposed = await proposePlan({ keys: pool, topic });
                      if (proposed) {
                        const saved = installModelPlan(topic, proposed.pillar, proposed.clusters);
                        if (saved.planId) {
                          navigate({ to: "/topic-plans/$id", params: { id: saved.planId } });
                          return;
                        }
                      }
                      const failedId = failPlan(topic, "The model could not return 6 distinct supporting clusters after one expansion retry. Check the key pool on AI Keys.");
                      navigate({ to: "/topic-plans/$id", params: { id: failedId } });
                      return;
                    }
                    const planId = makePlan(topic);
                    if (planId) navigate({ to: "/topic-plans/$id", params: { id: planId } });
                  } finally {
                    setPlanning(false);
                  }
                })();
              }}
            >
              {planning ? "Asking your model…" : "Generate topic plan"}
            </Button>
            <p className="text-sm leading-6 text-muted">
              If a model key with a base URL is saved, that model writes the pillar and the cluster titles. Otherwise the studio uses a local outline. Nothing is written until you queue the plan. Clusters run before the pillar.
            </p>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h2 className="font-display text-xl">Recent plans</h2>
            <ul className="mt-3 divide-y divide-line">
              {plans.slice(0, 6).map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <Link to="/topic-plans/$id" params={{ id: plan.id }} className="truncate">
                    {plan.topic}
                  </Link>
                  <Badge tone={plan.status === "completed" ? "ok" : "brass"}>{plan.status}</Badge>
                </li>
              ))}
              {!plans.length ? <li className="py-4 text-sm text-muted">No plans yet.</li> : null}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
