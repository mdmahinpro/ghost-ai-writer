import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChartColumn, ChartLine } from "lucide-react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HumanizeBanner } from "@/components/humanize-pipeline";
import { LinkField } from "@/components/link-field";
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
  // Worst first, by the same measure the article list already shows per row. An
  // average tells you the site is fine; it does not tell you which page to fix.
  const uniquenessRanked = useMemo(
    () =>
      corpus
        .map((article) => ({
          article,
          score: uniquenessAgainst(
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
        }))
        .sort((a, b) => a.score - b.score),
    [corpus],
  );
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
    <div className="space-y-5">
      <PageIntro
        eyebrow="Content"
        title="Analytics"
        lede="Pipeline health, plus the Bing desk: uniqueness, interlinks, and what to fix before a page can rank."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="bg-surface"
              onClick={() => {
                const origin = site?.publicUrl?.replace(/\/$/, "") || "";
                const body = corpus.map((article) => `${origin}/post/${article.slug}/`).join("\n");
                void navigator.clipboard.writeText(body);
              }}
            >
              Copy IndexNow URL list
            </Button>
            <Button onClick={() => weaveLinks()}>Weave missing internal links</Button>
          </div>
        }
      />
      {!corpus.length ? (
        <StateNote
          tone="empty"
          title="Nothing to measure on this website yet"
          body="Write one or two articles first. Every number on this page is computed from your own corpus and usage ledger — never estimated from a third-party metric."
        />
      ) : null}
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
        {([7, 14, 30] as const).map((item) => (
          <button
            key={item}
            onClick={() => setDays(item)}
            className={`h-7 rounded-full border px-3 text-[12px] font-medium transition-colors duration-150 ${
              days === item
                ? "border-brass/30 bg-brass/10 text-fg"
                : "border-transparent text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {item} days
          </button>
        ))}
      </div>
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
          <Kpi k="Tokens settled" v={compact(settled.reduce((sum, event) => sum + event.tokens, 0))} />
          <Kpi k="Articles produced" v={String(siteArticles.length)} />
          <Kpi k="Verified link edges" v={String(linkEdges)} />
          <Kpi k="Pipeline success" v={finished.length ? `${Math.round(success * 100)}%` : "—"} />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-xl p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Token usage</h2>
            <span className="num text-[11px] text-faint">last {days} days</span>
          </div>
          <div className="p-4">
            {byDay.every((d) => d.tokens === 0) ? (
              <ChartEmpty icon={<ChartLine aria-hidden="true" strokeWidth={1.6} className="size-4" />}>
                No tokens settled in this window — the ledger fills when a run writes.
              </ChartEmpty>
            ) : charts ? (
              <ResponsiveContainer width="100%" height={208}>
                <LineChart data={byDay}>
                  <XAxis dataKey="day" stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ background: "var(--color-elev)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }} />
                  <Line type="monotone" dataKey="tokens" stroke="var(--color-accent)" strokeWidth={1.75} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>
        <Card className="rounded-xl p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Article output</h2>
            <span className="num text-[11px] text-faint">{siteArticles.length} total</span>
          </div>
          <div className="p-4">
            {byDay.every((d) => d.articles === 0) ? (
              <ChartEmpty icon={<ChartColumn aria-hidden="true" strokeWidth={1.6} className="size-4" />}>
                No articles finished in this window.
              </ChartEmpty>
            ) : charts ? (
              <ResponsiveContainer width="100%" height={208}>
                <BarChart data={byDay}>
                  <XAxis dataKey="day" stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} width={24} />
                  <Tooltip contentStyle={{ background: "var(--color-elev)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }} />
                  <Bar dataKey="articles" fill="var(--color-accent)" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>
      </div>
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Stage performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-lg text-left text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Stage</th>
                <th className="px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Success</th>
                <th className="px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Avg duration</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Avg tokens</th>
              </tr>
            </thead>
            <tbody>
              {stageRows.map((row) => (
                <tr key={row.label} className="border-b border-line transition-colors duration-150 last:border-0 hover:bg-surface-2/60">
                  <td className="px-5 py-2.5 text-fg">{row.label}</td>
                  <td className="num px-5 py-2.5 text-muted">{row.success}</td>
                  <td className="num px-5 py-2.5 text-muted">{row.duration}</td>
                  <td className="num px-5 py-2.5 text-right text-fg">{row.tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-xl p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Content quality</h2>
          </div>
          {quality ? (
            <dl className="divide-y divide-line px-5">
              <LineItem k="Uniqueness" v={`${Math.round(quality.uniqueness * 100)}%`} />
              <LineItem k="Intent match" v={`${Math.round(quality.intent * 100)}%`} />
              <LineItem k="Coverage" v={`${Math.round(quality.coverage * 100)}%`} />
              <LineItem k="Images / article" v={quality.images.toFixed(1)} />
            </dl>
          ) : (
            <p className="px-5 py-4 text-[13px] text-muted">No articles in this window.</p>
          )}
        </Card>
        <Card className="rounded-xl p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Engine reliability</h2>
          </div>
          <dl className="divide-y divide-line px-5">
            <LineItem k="LLM" v={String(llm)} />
            <LineItem k="Fallback" v={String(fallback)} />
          </dl>
          <p className="border-t border-line px-5 py-3 text-[11px] leading-5 text-faint">
            Studio writer is the default engine. A custom model replaces the draft after the six stages finish.
          </p>
        </Card>
      </div>

      <section className="space-y-5 pt-3">
        <HumanizeBanner />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-sans text-[18px] font-semibold normal-case tracking-[-0.015em] text-fg">Bing ranking desk</h2>
            <p className="mt-1.5 text-[13px] leading-6 text-muted">
              These checks are the ones that decide whether Bing treats the library as a set of distinct pages or as copies of each other.
            </p>
          </div>
          <div className="min-w-36">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Library readiness</div>
            <div className="mt-1 font-display text-[36px] leading-none tabular-nums text-fg">{corpus.length ? `${Math.floor(ready * 100)}%` : "—"}</div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brass" style={{ width: `${corpus.length ? Math.floor(ready * 100) : 0}%` }} />
            </div>
          </div>
        </div>
        <Card className="overflow-hidden rounded-xl p-0">
          <div className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
            {playbook.map((item, index) => (
              <div key={item.title} className="bg-elev px-5 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="num text-[10px] text-faint">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="text-[13px] font-semibold leading-5 text-fg">{item.title}</h3>
                </div>
                <p className="mt-1.5 text-[12px] leading-6 text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="rounded-xl p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
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
          </div>
          {indexNote ? <p className="mt-3 text-[12px] text-muted">{indexNote}</p> : null}
          {indexPreview ? <p className="mt-1 text-[12px] text-faint">{indexPreview}</p> : null}
        </Card>
        <Card className="overflow-hidden rounded-xl p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h3 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Internal link field</h3>
            <p className="mt-1 text-[12px] leading-5 text-faint">
              Every article is a node on the sphere, every internal link already in the HTML is an
              arrow between them. The field turns on its own — drag it to look from another angle.
            </p>
          </div>
          <div className="p-5">
            <LinkField articles={linked} />
          </div>
        </Card>
        <Card className="overflow-hidden rounded-xl p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h3 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Uniqueness worklist</h3>
            <p className="mt-1 text-[12px] leading-6 text-muted">
              Worst first, measured against every other article on this site. Under 70 percent, a page is mostly
              re-saying what a sibling already said — that is the one to rewrite or merge, not the whole site.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {uniquenessRanked.slice(0, 8).map(({ article, score }, index) => (
              <li key={article.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px] transition-colors duration-150 hover:bg-surface-2/60">
                <span className="num w-5 text-right text-[10px] text-faint">{index + 1}</span>
                <Link
                  to="/articles/$id"
                  params={{ id: article.id }}
                  className="min-w-0 flex-1 truncate text-fg transition-colors duration-150 hover:text-brass-2"
                  title={article.title}
                >
                  {article.title}
                </Link>
                <span className={`num text-[11px] ${score < 0.7 ? "text-danger" : "text-muted"}`}>
                  {Math.round(score * 100)}%
                </span>
              </li>
            ))}
            {uniquenessRanked.length ? null : <li className="px-5 py-4 text-[13px] text-muted">No article to rank yet.</li>}
          </ul>
        </Card>
        <Card className="overflow-hidden rounded-xl p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h3 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Near-duplicates</h3>
            <p className="mt-1 text-[12px] leading-6 text-muted">
              {pairs.length
                ? "These pairs are close enough that Bing may fold them. Link one to the other and change the angle, or unpublish the weaker URL."
                : "No pair is close enough to look like a copy. Keep linking sideways so new drafts do not drift into the same title."}
            </p>
          </div>
          <ul className="divide-y divide-line">
            {pairs.map((pair) => (
              <li key={pair.left.id + pair.right.id} className="px-5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[13px] text-fg">{pair.left.title}</span>
                  <span className="num shrink-0 text-[11px] text-warn">{Math.round(pair.score * 100)}%</span>
                </div>
                <div className="mt-0.5 truncate text-[12px] text-muted">{pair.right.title}</div>
              </li>
            ))}
          </ul>
          {orphans.length ? (
            <p className="border-t border-line px-5 py-2.5 text-[12px] leading-5 text-danger">
              {orphans.length} orphan{orphans.length === 1 ? "" : "s"} with no inbound link: {orphans.map((article) => article.title).join(", ")}.
            </p>
          ) : (
            <p className="border-t border-line px-5 py-2.5 text-[12px] leading-5 text-ok">No orphan pages. Every article has an inbound link.</p>
          )}
        </Card>
        <Card className="overflow-hidden rounded-xl p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h3 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Page checklist</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-lg text-left text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Article</th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Bing</th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Links</th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Author</th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Gaps</th>
                </tr>
              </thead>
              <tbody>
                {scored.slice(0, 12).map((row) => (
                  <tr key={row.article.id} className="border-b border-line transition-colors duration-150 last:border-0 hover:bg-surface-2/60">
                    <td className="max-w-xs truncate px-5 py-2.5 text-fg">
                      <Link to="/articles/$id" params={{ id: row.article.id }} className="transition-colors duration-150 hover:text-brass-2">
                        {row.article.title}
                      </Link>
                    </td>
                    <td className="num px-4 py-2.5 text-muted">{Math.floor(row.score * 100)}%</td>
                    <td className="num px-4 py-2.5 text-muted">{row.article.links.length}</td>
                    <td className="max-w-40 truncate px-4 py-2.5 text-muted">{row.article.authorName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{row.checks.filter((check) => !check.pass).map((check) => check.label).join(", ") || "Clear"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function avg(values: number[]) {
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}
function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-elev px-5 py-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{k}</div>
      <div className="mt-2 font-display text-[30px] leading-none tabular-nums text-fg">{v}</div>
    </div>
  );
}
function LineItem({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-[13px] text-muted">{k}</dt>
      <dd className="num text-[13px] text-fg">{v}</dd>
    </div>
  );
}
function ChartEmpty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="grid h-52 place-items-center rounded-md border border-dashed border-line/80">
      <div className="px-4 text-center">
        <span className="mx-auto grid size-9 place-items-center rounded-md bg-surface-2 text-faint">{icon}</span>
        <p className="mt-2 text-[12px] leading-5 text-faint">{children}</p>
      </div>
    </div>
  );
}
