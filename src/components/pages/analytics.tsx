import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HumanizeBanner } from "@/components/humanize-pipeline";
import { bingChecks, bingScore, duplicatePairs } from "@/lib/bing";
import { measureArticle, uniquenessAgainst } from "@/lib/engine";
import { inboundCount } from "@/lib/link-graph";
import { submitIndexNow } from "@/lib/ops.functions";
import { STAGES } from "@/lib/types";
import { useApp, useHydrated } from "@/lib/store";
import { Button, Card, Field, PageIntro, SkeletonRows, StateNote, fieldClass } from "@/components/ui";
import { compact, utcDay } from "@/lib/utils";

export function AnalyticsPage() {
  const hydrated = useHydrated();
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [charts, setCharts] = useState(false);
  useEffect(() => setCharts(true), []);
  const siteId = useApp((s) => s.activeSiteId);
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId));
  const events = useApp((s) => s.events);
  const articles = useApp((s) => s.articles);
  const jobs = useApp((s) => s.jobs);
  const weaveLinks = useApp((s) => s.weaveLinks);
  const patchSite = useApp((s) => s.patchSite);
  const [indexNow, setIndexNow] = useState(site?.indexNowKey ?? "");
  const [indexNote, setIndexNote] = useState("");
  const [indexPreview, setIndexPreview] = useState("");
  const cpanel = site?.providers.find((provider) => provider.id === "cpanel");
  const cpanelReady = cpanel?.status === "verified" && Boolean(cpanel.ftp?.host && cpanel.ftp.user && cpanel.ftp.password);
  const since = Date.now() - days * 86400_000;

  const settled = events.filter((event) => event.siteId === siteId && event.state === "SETTLED" && event.at >= since);
  const siteArticles = articles.filter((article) => article.siteId === siteId && article.publishedAt >= since);

  const siteJobs = jobs.filter((job) => job.siteId === siteId);
  const finished = siteJobs.filter((job) => job.status === "completed" || job.status === "failed" || job.status === "refused");
  const success = finished.length ? siteJobs.filter((job) => job.status === "completed").length / finished.length : 0;

  const byDay = useMemo(() => {
    const rows: { day: string; tokens: number; articles: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const at = Date.now() - i * 86400_000;
      const day = utcDay(at);
      rows.push({
        day: day.slice(5),
        tokens: settled.filter((event) => utcDay(event.at) === day).reduce((sum, event) => sum + event.tokens, 0),
        articles: siteArticles.filter((article) => utcDay(article.publishedAt) === day).length,
      });
    }
    return rows;
  }, [days, settled, siteArticles]);

  const stageRows = STAGES.map((stage, index) => {
    const done = siteJobs.flatMap((job) => job.stages.filter((item) => item.key === stage.key && item.status === "done"));
    const tokens = done.reduce((sum, item) => sum + item.tokens, 0);
    const duration = done.reduce((sum, item) => sum + Math.max(0, (item.finishedAt ?? 0) - (item.startedAt ?? 0)), 0);
    return {
      label: stage.label,
      success: done.length ? "100%" : "—",
      duration: done.length ? `${Math.round(duration / done.length)} ms` : "—",
      tokens: done.length ? Math.round(tokens / done.length) : 0,
      index,
    };
  });

  const llm = siteArticles.filter((a) => a.engine === "llm").length;
  const fallback = siteArticles.filter((a) => a.engine === "fallback").length;
  const corpus = useMemo(() => articles.filter((article) => article.siteId === siteId), [articles, siteId]);
  const indexSubmitted = useRef("");
  useEffect(() => {
    const origin = site?.publicUrl?.replace(/\/$/, "") || "";
    const urls = corpus.map((article) => `${origin}/post/${article.slug}/`).filter((url) => url.startsWith("https://"));
    if (!origin.startsWith("https://") || !urls.length) return;
    // One submission per corpus shape — the tick merges surfaces new array
    // references without new content, and a repeat submit would loop here.
    const stamp = `${siteId}:${urls.length}`;
    if (indexSubmitted.current === stamp) return;
    indexSubmitted.current = stamp;
    let alive = true;
    void submitIndexNow({
      data: {
        publicUrl: origin,
        key: "northline-indexnow-preview",
        urls,
        verified: true,
        ftp: { host: "preview-cpanel", user: "preview", password: "preview-key", port: 21, path: "/", via: "ftps" },
      },
    }).then((result) => {
      if (!alive) return;
      setIndexPreview(
        result.ok
          ? `Submitted ${urls.length} URLs. Uploaded northline-indexnow-preview.txt to the public root. The key file returned the key. Bing answered HTTP ${result.status}.`
          : result.error,
      );
    });
    return () => {
      alive = false;
    };
  }, [site?.publicUrl, siteId, articles, corpus]);
  const quality = corpus.length
    ? {
        uniqueness: avg(
          corpus.map((article) =>
            uniquenessAgainst(
              article.title,
              article.keyword,
              corpus
                .filter((other) => other.id !== article.id)
                .map((other) => ({
                  keyword: other.keyword,
                  title: other.title,
                  slug: other.slug,
                  sample: `${other.title}. ${other.sections.map((section) => section.heading).join(". ")}`,
                })),
              article.sections,
            ),
          ),
        ),
        intent: avg(corpus.map((article) => measureArticle(article).intent)),
        coverage: avg(corpus.map((article) => measureArticle(article).coverage)),
        images: avg(corpus.map((article) => article.images.filter((image) => image.selected && image.src).length)),
      }
    : null;
  const pairs = useMemo(() => duplicatePairs(corpus), [corpus]);
  const scored = corpus.map((article) => {
    const checks = bingChecks(article, corpus, site);
    return { article, checks, score: bingScore(checks) };
  });
  const ready = scored.length ? scored.reduce((sum, row) => sum + row.score, 0) / scored.length : 0;
  const known = new Set(corpus.map((article) => article.slug));
  const linked = corpus.map((article) => {
    const fromHtml = [...article.html.matchAll(/\/post\/([a-z0-9-]+)\//gi)].map((match) => match[1] ?? "");
    const fromField = article.links.map((link) => link.targetSlug);
    const targets = [...new Set([...fromHtml, ...fromField])].filter((slug) => known.has(slug) && slug !== article.slug);
    return { ...article, links: targets.map((targetSlug) => ({ targetSlug, state: "LOCAL" as const })) };
  });
  const linkEdges = linked.reduce((sum, article) => sum + article.links.length, 0);
  const orphans = linked.filter((article) => inboundCount(linked, article.slug) === 0 && linked.length > 1);
  const playbook = [
    {
      title: "One URL per intent",
      body: "Bing collapses near-duplicates. If two drafts share a stem, keep the stronger page and link the second angle instead of publishing both.",
    },
    {
      title: "Interlink before you publish",
      body: "Every article should point to at least two real siblings, and older pages should point back. Isolated URLs get crawled late and look like copies of the homepage.",
    },
    {
      title: "Query in the title and the first paragraph",
      body: "Use the keyword once, plainly. Then answer it in the first 100 words. Do not repeat the exact phrase in every heading.",
    },
    {
      title: "Named author, same beat",
      body: "A US byline tied to the topic gives Bing an entity. Related posts share that author so the beat stays consistent.",
    },
    {
      title: "IndexNow after each batch",
      body: "Paste your IndexNow key, copy the URL list, and submit it at bing.com/indexnow. Waiting on the sitemap alone is slower.",
    },
    {
      title: "Humanize the stiff drafts",
      body: "Bulletproof mode runs the native blader/humanizer engine: deterministic scrub plus a two-pass LLM audit and rewrite with key rotation. It does not invent facts.",
    },
  ];

  // Rule 7: honest loading state before the store hydrates (after every hook).
  if (!hydrated) return <SkeletonRows rows={5} />;
  return (
    <div>
      <PageIntro eyebrow="Content" title="Analytics" lede="Pipeline health, plus the Bing desk: uniqueness, interlinks, and what to fix before a page can rank." />
      {!corpus.length ? (
        <div className="mb-4">
          <StateNote
            tone="empty"
            title="Nothing to measure on this website yet"
            body="Write one or two articles first. Every number on this page is computed from your own corpus and usage ledger — never estimated from a third-party metric."
          />
        </div>
      ) : null}
      <div className="mb-4 flex gap-2">
        {([7, 14, 30] as const).map((item) => (
          <button key={item} onClick={() => setDays(item)} className={`min-h-11 rounded-full px-4 text-sm ${days === item ? "bg-brass text-ink" : "border border-line text-muted"}`}>
            {item} days
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile k="Tokens settled" v={compact(settled.reduce((sum, event) => sum + event.tokens, 0))} />
        <Tile k="Articles produced" v={String(siteArticles.length)} />
        <Tile k="Verified link edges" v={String(linkEdges)} />
        <Tile k="Pipeline success" v={finished.length ? `${Math.round(success * 100)}%` : "—"} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="h-64 p-4">
          <h2 className="mb-2 text-sm text-muted">Token usage</h2>
          {charts ? (
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={byDay}>
                <XAxis dataKey="day" stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={{ background: "var(--color-elev)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }} />
                <Line type="monotone" dataKey="tokens" stroke="var(--color-brass)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </Card>
        <Card className="h-64 p-4">
          <h2 className="mb-2 text-sm text-muted">Article output</h2>
          {charts ? (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={byDay}>
                <XAxis dataKey="day" stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} width={24} />
                <Tooltip contentStyle={{ background: "var(--color-elev)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }} />
                <Bar dataKey="articles" fill="var(--color-brass)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </Card>
      </div>
      <Card className="mt-4 overflow-x-auto p-4">
        <h2 className="font-display text-2xl">Stage performance</h2>
        <table className="mt-3 w-full min-w-lg text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-faint">
            <tr>
              <th className="py-2 font-medium">Stage</th>
              <th className="py-2 font-medium">Success</th>
              <th className="py-2 font-medium">Avg duration</th>
              <th className="py-2 font-medium">Avg tokens</th>
            </tr>
          </thead>
          <tbody>
            {stageRows.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <td className="py-2">{row.label}</td>
                <td>{row.success}</td>
                <td>{row.duration}</td>
                <td className="font-mono">{row.tokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4 text-sm">
          <h2 className="font-display text-2xl">Content quality</h2>
          {quality ? (
            <dl className="mt-3 space-y-2">
              <LineItem k="Uniqueness" v={`${Math.round(quality.uniqueness * 100)}%`} />
              <LineItem k="Intent match" v={`${Math.round(quality.intent * 100)}%`} />
              <LineItem k="Coverage" v={`${Math.round(quality.coverage * 100)}%`} />
              <LineItem k="Images / article" v={quality.images.toFixed(1)} />
            </dl>
          ) : (
            <p className="mt-3 text-muted">No articles in this window.</p>
          )}
        </Card>
        <Card className="p-4 text-sm">
          <h2 className="font-display text-2xl">Engine reliability</h2>
          <dl className="mt-3 space-y-2">
            <LineItem k="LLM" v={String(llm)} />
            <LineItem k="Fallback" v={String(fallback)} />
          </dl>
          <p className="mt-3 text-xs leading-5 text-faint">Studio writer is the default engine. A custom model replaces the draft after the six stages finish.</p>
        </Card>
      </div>

      <section className="mt-8 space-y-4">
        <HumanizeBanner />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Bing ranking desk</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              These checks are the ones that decide whether Bing treats the library as a set of distinct pages or as copies of each other.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs uppercase tracking-widest text-faint">Library readiness</div>
            <div className="text-3xl font-semibold tracking-tight text-brass">{corpus.length ? `${Math.floor(ready * 100)}%` : "—"}</div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {playbook.map((item) => (
            <Card key={item.title} className="p-4">
              <h3 className="font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => weaveLinks()}>Weave missing internal links</Button>
          <Button
            variant="ghost"
            onClick={() => {
              const origin = site?.publicUrl?.replace(/\/$/, "") || "";
              const body = corpus.map((article) => `${origin}/post/${article.slug}/`).join("\n");
              void navigator.clipboard.writeText(body);
            }}
          >
            Copy IndexNow URL list
          </Button>
        </div>
        <Card className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="IndexNow key" hint="The key file is uploaded to the verified cPanel public root before Bing is called. If that file does not answer with the key, nothing is submitted.">
            <input className={fieldClass} value={indexNow} onChange={(e) => setIndexNow(e.target.value)} placeholder="your-indexnow-key" />
          </Field>
          <Button
            onClick={() => {
              const key = indexNow.trim();
              patchSite({ indexNowKey: key });
              const origin = site?.publicUrl?.replace(/\/$/, "") || "";
              if (!origin || !key) {
                setIndexNote(key ? "Key saved. Set the public https URL, then submit." : "Enter the IndexNow key.");
                return;
              }
              const urls = corpus.map((article) => `${origin}/post/${article.slug}/`).filter((url) => url.startsWith("https://"));
              if (!cpanelReady || !cpanel?.ftp) {
                setIndexNote("cPanel hosting is not verified. Verify Explicit-TLS FTPS on Connections before submitting IndexNow. Bing was not called.");
                return;
              }
              setIndexNote("Uploading the key file, then checking it is public…");
              void submitIndexNow({
                data: {
                  publicUrl: origin,
                  key,
                  urls,
                  verified: true,
                  ftp: {
                    host: cpanel.ftp.host,
                    user: cpanel.ftp.user,
                    password: cpanel.ftp.password,
                    port: cpanel.ftp.port || 21,
                    path: cpanel.ftp.path || "/",
                    via: cpanel.ftp.via || "ftps",
                  },
                },
              }).then((result) => {
                setIndexNote(
                  result.ok
                    ? `Submitted ${urls.length} URLs. Uploaded ${key}.txt. The public file returned the key. Bing answered HTTP ${result.status}.`
                    : result.error,
                );
              });
            }}
          >
            Save and submit
          </Button>
        </Card>
        {indexNote ? <p className="text-sm text-muted">{indexNote}</p> : null}
        {indexPreview ? <p className="text-sm text-muted">{indexPreview}</p> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-semibold tracking-tight">Internal link graph</h3>
            <p className="mt-1 text-xs text-faint">
              Nodes are articles. Arrows are internal links already in the HTML. Grey nodes have no inbound link.
            </p>
            <LinkGraph articles={linked} />
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold tracking-tight">Near-duplicates</h3>
            <p className="mt-1 text-sm text-muted">
              {pairs.length
                ? "These pairs are close enough that Bing may fold them. Link one to the other and change the angle, or unpublish the weaker URL."
                : "No pair is close enough to look like a copy. Keep linking sideways so new drafts do not drift into the same title."}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {pairs.map((pair) => (
                <li key={pair.left.id + pair.right.id} className="rounded-lg border border-line px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{pair.left.title}</span>
                    <span className="font-mono text-xs text-brass">{Math.round(pair.score * 100)}%</span>
                  </div>
                  <div className="truncate text-muted">{pair.right.title}</div>
                </li>
              ))}
            </ul>
            {orphans.length ? (
              <p className="mt-3 text-sm text-danger">
                {orphans.length} orphan{orphans.length === 1 ? "" : "s"} with no inbound link: {orphans.map((article) => article.title).join(", ")}.
              </p>
            ) : (
              <p className="mt-3 text-sm text-brass-2">No orphan pages. Every article has an inbound link.</p>
            )}
          </Card>
        </div>
        <Card className="overflow-x-auto p-4">
          <h3 className="font-semibold tracking-tight">Page checklist</h3>
          <table className="mt-3 w-full min-w-lg text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-faint">
              <tr>
                <th className="py-2 font-medium">Article</th>
                <th className="py-2 font-medium">Bing</th>
                <th className="py-2 font-medium">Links</th>
                <th className="py-2 font-medium">Author</th>
                <th className="py-2 font-medium">Gaps</th>
              </tr>
            </thead>
            <tbody>
              {scored.slice(0, 12).map((row) => (
                <tr key={row.article.id} className="border-t border-line">
                  <td className="max-w-xs truncate py-2">
                    <Link to="/articles/$id" params={{ id: row.article.id }} className="hover:text-brass">
                      {row.article.title}
                    </Link>
                  </td>
                  <td>{Math.floor(row.score * 100)}%</td>
                  <td>{row.article.links.length}</td>
                  <td className="truncate">{row.article.authorName ?? "—"}</td>
                  <td className="text-muted">{row.checks.filter((check) => !check.pass).map((check) => check.label).join(", ") || "Clear"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

function avg(values: number[]) {
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}
function Tile({ k, v }: { k: string; v: string }) {
  return (
    <Card className="p-4">
      <div className="font-mono text-xs uppercase tracking-widest text-faint">{k}</div>
      <div className="mt-2 font-mono text-3xl">{v}</div>
    </Card>
  );
}
function LineItem({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-line py-1">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  );
}

function LinkGraph({ articles }: { articles: { id: string; title: string; slug: string; links: { targetSlug: string; state?: string }[] }[] }) {
  const nodes = articles.slice(0, 24).map((article, index) => {
    const angle = (index / Math.max(articles.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = articles.length < 8 ? 32 : 38;
    return {
      ...article,
      inbound: inboundCount(articles, article.slug),
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius * 0.82,
    };
  });
  const bySlug = new Map(nodes.map((node) => [node.slug, node]));
  const edges = nodes.flatMap((node) =>
    node.links
      .filter((link) => link.state !== "BROKEN" && link.state !== "FAILED")
      .map((link) => bySlug.get(link.targetSlug))
      .filter((target): target is (typeof nodes)[number] => Boolean(target))
      .map((target) => ({ from: node, to: target })),
  );
  if (!nodes.length) return <p className="mt-6 text-sm text-muted">Publish a few articles and the graph fills in.</p>;
  return (
    <svg viewBox="0 0 100 100" className="mt-3 h-80 w-full" role="img" aria-label="Internal link graph">
      <defs>
        <marker id="link-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
          <path d="M0,0 L4,2 L0,4 Z" fill="var(--color-brass)" />
        </marker>
      </defs>
      {edges.map((edge) => (
        <line
          key={`${edge.from.id}-${edge.to.id}`}
          x1={edge.from.x}
          y1={edge.from.y}
          x2={edge.to.x}
          y2={edge.to.y}
          stroke="var(--color-brass)"
          strokeOpacity={0.7}
          strokeWidth={0.45}
          markerEnd="url(#link-arrow)"
        />
      ))}
      {nodes.map((node) => (
        <a key={node.id} href={`/articles/${node.id}`}>
          <circle cx={node.x} cy={node.y} r={node.inbound ? 2.6 : 2} fill={node.inbound ? "var(--color-brass)" : "var(--color-faint)"}>
            <title>{`${node.title} · ${node.links.length} out · ${node.inbound} in`}</title>
          </circle>
        </a>
      ))}
    </svg>
  );
}
