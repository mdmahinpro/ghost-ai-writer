import { Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { HumanizeBanner, HUMANIZER_MISSING } from "@/components/humanize-pipeline";
import { AuthorAvatar } from "@/components/pages/authors";
import { bingChecks, bingScore, alignKeywordToQuery, nearDuplicateSibling } from "@/lib/bing";
import { composeArticle, keyCallsModel, keyPool, measureArticle, uniquenessAgainst } from "@/lib/engine";
import { authorVoiceBlock } from "@/lib/authors";
import { inboundCount } from "@/lib/link-graph";
import { stripVerify } from "@/lib/markdown";
import { articleFromMarkdown, ensureMarkdownLinks } from "@/lib/rewrite";
import { applyFetchedImages } from "@/lib/media-html";
import { placeImages } from "@/lib/images.functions";
import { articleImageSrc } from "@/lib/image-urls";
import { useApp, useHydrated } from "@/lib/store";
import { forgetArticles } from "@/lib/ops.functions";
import type { Article } from "@/lib/types";
import { Badge, Button, Card, Empty, PageIntro, SkeletonRows, StateNote, StatusGlyph, statusTone, fieldClass, fieldCompact } from "@/components/ui";
import { relTime } from "@/lib/utils";

export function ArticlesPage() {
  const hydrated = useHydrated();
  const siteId = useApp((s) => s.activeSiteId);
  const allArticles = useApp((s) => s.articles);
  const articles = useMemo(() => allArticles.filter((article) => article.siteId === siteId), [allArticles, siteId]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [engine, setEngine] = useState<"all" | "llm" | "fallback">("all");
  const [picked, setPicked] = useState<string[]>([]);
  // Deleting is two clicks: the first arms the button, the second drops the rows.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteArticles = useApp((s) => s.deleteArticles);
  const rows = useMemo(
    () =>
      articles.filter((article) => {
        const hit = `${article.title} ${article.slug} ${article.keyword}`.toLowerCase().includes(q.trim().toLowerCase());
        const statusOk = status === "all" || article.status === status;
        const engineOk = engine === "all" || article.engine === engine;
        return hit && statusOk && engineOk;
      }),
    [articles, q, status, engine],
  );

  const allPicked = rows.length > 0 && rows.every((article) => picked.includes(article.id));
  const toggleAll = () =>
    setPicked((current) =>
      rows.length > 0 && rows.every((article) => current.includes(article.id))
        ? current.filter((id) => !rows.some((article) => article.id === id))
        : [...new Set([...current, ...rows.map((article) => article.id)])],
    );

  // A new selection must not inherit the previous one's armed confirmation.
  useEffect(() => setConfirmDelete(false), [picked.length]);

  function exportCsv() {
    const header = ["title", "slug", "engine", "status", "links", "images", "uniqueness", "published"];
    const body = rows.map((article) =>
      [article.title, article.slug, article.engine, article.status, String(article.links.length), String(article.images.length), String(article.uniqueness), new Date(article.publishedAt).toISOString()]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "articles.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Rule 7: honest loading state before the store hydrates (after every hook).
  if (!hydrated) return <SkeletonRows rows={4} />;
  return (
    <div>
      <PageIntro eyebrow="Content" title="Articles" lede="Inventory from single-shot writes. Search stays on this website." />
      {articles.some((article) => article.humanState === "needs-key") ? (
        <div className="mb-4">
          <StateNote
            tone="partial"
            title={`${articles.filter((article) => article.humanState === "needs-key").length} article(s) waiting on humanization`}
            body="Those drafts were written and are held honestly: the bulletproof humanization pass has not finished yet. Live publishing stays blocked until the blader humanizer marks them done."
          />
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={`${fieldCompact} w-56`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, slug, keyword"
          aria-label="Filter articles"
        />
        <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5" role="tablist" aria-label="Status">
          {([
            ["all", "All", articles.length],
            ["draft", "Draft", articles.filter((a) => a.status === "draft").length],
            ["published", "Published", articles.filter((a) => a.status === "published").length],
          ] as const).map(([value, label, count]) => (
            <button
              key={value}
              role="tab"
              aria-selected={status === value}
              onClick={() => setStatus(value)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[12px] transition-colors duration-150 ${
                status === value ? "bg-surface-2 font-medium text-fg shadow-xs" : "text-muted hover:text-fg"
              }`}
            >
              {label}
              <span className="num text-[11px] text-faint">{count}</span>
            </button>
          ))}
        </div>
        <select
          className={`${fieldCompact} w-36`}
          value={engine}
          onChange={(e) => setEngine(e.target.value as typeof engine)}
          aria-label="Engine"
        >
          <option value="all">All engines</option>
          <option value="llm">LLM</option>
          <option value="fallback">Fallback</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <input
              type="checkbox"
              aria-label={allPicked ? `Clear the selection of ${rows.length} articles` : `Select all ${rows.length} articles`}
              checked={allPicked}
              ref={(node) => {
                if (node) node.indeterminate = picked.length > 0 && !allPicked;
              }}
              onChange={toggleAll}
              disabled={!rows.length}
              className="size-3.5 shrink-0 accent-[var(--color-accent)]"
            />
            {allPicked ? "Clear selection" : `Select all${rows.length ? ` (${rows.length})` : ""}`}
          </label>
          <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!picked.length}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              const slugs = articles.filter((article) => picked.includes(article.id)).map((article) => article.slug);
              // The server keeps its own copy of every article, so tell it too —
              // otherwise the CMS mirror keeps pushing rows the studio dropped.
              if (siteId && slugs.length) void forgetArticles({ data: { site_ref: siteId, slugs } });
              deleteArticles(picked);
              setPicked([]);
              setConfirmDelete(false);
            }}
          >
            {confirmDelete ? `Delete ${picked.length} for good` : `Delete${picked.length ? ` (${picked.length})` : ""}`}
          </Button>
        </div>
      </div>
      {!rows.length ? (
        <Empty title="No articles" body="Completed jobs land here with a Ghost ledger, downloaded photos, and internal links." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-elev">
          <div className="flex items-center gap-2.5 border-b border-line bg-surface px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
            <span aria-hidden="true" className="w-3.5 shrink-0" />
            <span className="hidden w-16 shrink-0 sm:inline">ID</span>
            <span className="min-w-0 flex-1">Title</span>
            <span className="hidden w-40 shrink-0 lg:inline">Slug</span>
            <span className="hidden w-28 shrink-0 text-right md:inline">Links</span>
            <span className="hidden w-14 shrink-0 text-right sm:inline">Images</span>
            <span className="hidden w-12 shrink-0 text-right sm:inline">Unique</span>
            <span className="w-16 shrink-0 text-right">Age</span>
          </div>
          {(["published", "draft"] as const)
            .map((key) => ({
              key,
              label: key === "published" ? "Published" : "Draft",
              count: rows.filter((article) => article.status === key).length,
              rows: rows.filter((article) => article.status === key),
            }))
            .filter((group) => group.count > 0)
            .map((group) => (
              <section key={group.key}>
                <header className="sticky top-14 z-10 flex h-9 items-center gap-2.5 border-b border-line bg-surface-2 px-4">
                  <input
                    type="checkbox"
                    aria-label={`Select the ${group.count} ${group.label.toLowerCase()} article(s)`}
                    checked={group.rows.every((article) => picked.includes(article.id))}
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked
                          ? [...new Set([...current, ...group.rows.map((article) => article.id)])]
                          : current.filter((id) => !group.rows.some((article) => article.id === id)),
                      )
                    }
                    className="size-3.5 shrink-0 accent-[var(--color-accent)]"
                  />
                  <StatusGlyph status={group.key} />
                  <span className="text-[12px] font-medium text-fg">{group.label}</span>
                  <span className="num text-[11px] text-faint">{group.count}</span>
                </header>
                {group.rows.map((article) => (
                  <div
                    key={article.id}
                    className="group flex items-center gap-2.5 border-b border-line/70 px-4 transition-colors duration-150 last:border-0 hover:bg-surface-2/60"
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${article.title}`}
                      checked={picked.includes(article.id)}
                      onChange={(event) =>
                        setPicked((current) => (event.target.checked ? [...current, article.id] : current.filter((id) => id !== article.id)))
                      }
                      className="size-3.5 shrink-0 accent-[var(--color-accent)] opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 checked:opacity-100"
                    />
                    <span className="num hidden w-16 shrink-0 text-[11px] text-faint sm:inline">{article.id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}</span>
                    <StatusGlyph status={article.status} className="sm:hidden" />
                    <Link
                      to="/articles/$id"
                      params={{ id: article.id }}
                      className="min-w-0 flex-1 truncate py-2 text-[13px] font-medium text-fg underline-offset-4 hover:underline"
                      title={article.title}
                    >
                      {article.title}
                    </Link>
                    <span className="num hidden w-40 shrink-0 truncate text-[11px] text-faint lg:inline">/{article.slug}</span>
                    <span className="num hidden w-28 shrink-0 items-center justify-end gap-1 text-[11px] text-muted md:inline-flex" title="Outbound · inbound links">
                      {article.links.length} out · {inboundCount(articles, article.slug)} in
                    </span>
                    <span className="num hidden w-14 shrink-0 text-right text-[11px] text-muted sm:inline" title="Selected images">
                      {article.images.filter((image) => image.selected).length} img
                    </span>
                    <span className="num hidden w-12 shrink-0 text-right text-[11px] text-muted sm:inline" title="Uniqueness">
                      {Math.round(
                        uniquenessAgainst(
                          article.title,
                          article.keyword,
                          articles
                            .filter((other) => other.id !== article.id)
                            .map((other) => ({
                              keyword: other.keyword,
                              title: other.title,
                              slug: other.slug,
                              sample: `${other.title}. ${other.sections.map((section) => section.heading).join(". ")}`,
                            })),
                          article.sections,
                        ) * 100,
                      )}
                      %
                    </span>
                    <span className="num w-16 shrink-0 text-right text-[11px] text-faint">{relTime(article.publishedAt)}</span>
                  </div>
                ))}
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

export function ArticleDetail({ id }: { id: string }) {
  const hydrated = useHydrated();
  const articles = useApp((s) => s.articles);
  const siteId = useApp((s) => s.activeSiteId);
  const site = useApp((s) => s.sites.find((item) => item.id === siteId));
  const authors = useApp((s) => s.authors);
  const article = articles.find((item) => item.id === id);
  const corpus = useMemo(() => articles.filter((item) => item.siteId === siteId), [articles, siteId]);
  const author = authors.find((item) => item.id === article?.authorId);
  const patchSite = useApp((s) => s.patchSite);
  const [publicUrl, setPublicUrl] = useState(site?.publicUrl ?? "");
  const [copied, setCopied] = useState<"html" | "md" | "">("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // Editing text in the studio, and taking the file with you. Both act on the
  // stored markdown, so what you save is exactly what the build and the CMS send.
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");

  function startEdit() {
    if (!article) return;
    setDraftText(`# ${article.title}\n\n${article.markdown}`);
    setEditing(true);
    setNote("");
  }

  function saveEdit() {
    if (!article) return;
    const body = articleFromMarkdown(draftText);
    const withImages = applyFetchedImages(body.html, body.markdown, article.images, article.keyword || article.title);
    useApp.getState().patchArticle(article.id, {
      ...body,
      html: withImages.html,
      markdown: withImages.markdown,
    });
    setEditing(false);
    setNote("Saved. Your text is what the next build ships.");
  }

  function exportMarkdown() {
    if (!article) return;
    const blob = new Blob([`# ${article.title}\n\n${article.markdown}\n`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${article.slug || "article"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Image retry. A slot that resolved to a dead or off-topic photo was stuck that
  // way: the fetch ran once during the run and nothing could ask again. Retrying
  // bumps the salt and hands the current sources in as `avoid`, so the server is
  // asked for different photos rather than the same ones once more.
  const [retrySalt, setRetrySalt] = useState(0);
  const [retrying, setRetrying] = useState<number[]>([]);
  // A held article could only be released from the Runs page. The job that holds
  // it is right here, so the button belongs here too.
  const jobs = useApp((s) => s.jobs);
  const retryJob = useApp((s) => s.retryJob);
  const heldJob = article?.jobId ? jobs.find((job) => job.id === article.jobId) : undefined;
  const holdReason = heldJob?.status === "review-held" || heldJob?.status === "publish-held" ? heldJob.status : "";

  async function retryImages(indexes: number[]) {
    if (!article || !indexes.length) return;
    const slots = indexes
      .map((index) => article.images[index])
      .filter(Boolean)
      .map((image) => ({ role: image.role, query: image.query, alt: image.alt }));
    if (!slots.length) return;
    setRetrying(indexes);
    const avoid = article.images.map((image) => image.src).filter((src): src is string => Boolean(src));
    const res = await placeImages({
      data: { slots, provider: "bing", avoid, salt: (retrySalt + 1) % 10000 },
    });
    setRetrying([]);
    if (!res.ok) {
      setNote(res.error ?? "The image fetch failed.");
      return;
    }
    if (!res.images.length) {
      setNote("No replacement photo came back for that slot. Try again — the picker is salted, so it varies.");
      return;
    }
    // Indexes arrived in order, so the nth result belongs to the nth retried slot.
    const images = [...article.images];
    indexes.forEach((index, position) => {
      const replacement = res.images[position];
      if (replacement && images[index]) images[index] = { ...images[index], ...replacement };
    });
    useApp.getState().patchArticle(article.id, { images });
    setRetrySalt((current) => (current + 1) % 10000);
    setNote(`Fetched ${res.images.length} replacement photo(s). Build again to ship them.`);
  }
  // Rule 7: "Article missing" only counts after the ledger has hydrated.
  if (!hydrated) return <SkeletonRows rows={5} />;
  if (!article) return <Empty title="Article missing" body="It is not in this studio ledger." />;
  const checks = bingChecks(article, corpus, site);
  const score = bingScore(checks);

  // One-click repairs for the three checklist items that are code-fixable.
  function fixCheck(id: string) {
    if (!article) return;
    if (id === "index") {
      const url = publicUrl.trim();
      patchSite({ robots: "index,follow", ...(url ? { publicUrl: url } : {}) });
      setNote(
        url
          ? "Robots set to index,follow and the public URL saved. Submit the URL list with IndexNow from Static Delivery."
          : "Robots set to index,follow. Add the public URL above to finish this check.",
      );
      return;
    }
    if (id === "query") {
      useApp.getState().patchArticle(article.id, alignKeywordToQuery(article));
      setNote("The query now leads the title and the opening paragraph in plain language — no heading stuffing.");
      return;
    }
    if (id === "unique") {
      const other = nearDuplicateSibling(article, corpus);
      if (other) {
        const withLink = (target: Article, source: Article): Article["links"] =>
          target.links.some((link) => link.targetSlug === source.slug)
            ? target.links
            : [...target.links, { anchor: source.title, targetSlug: source.slug, state: "LOCAL" }];
        useApp.getState().patchArticle(article.id, { links: withLink(article, other) });
        useApp.getState().patchArticle(other.id, { links: withLink(other, article) });
        setNote(`Kept one URL per intent: linked this page and “${other.title}” to each other instead of rewriting the same angle.`);
      } else {
        setNote("This draft overlaps its own corpus. Use “Regenerate draft” to rewrite it from a new angle.");
      }
      return;
    }
    setNote("That check is informational — it is reported, but there is nothing to auto-fix.");
  }

  async function copy(kind: "html" | "md") {
    await navigator.clipboard.writeText(kind === "html" ? article!.html : article!.markdown);
    setCopied(kind);
  }

  async function humanize() {
    setBusy(true);
    setNote("");
    try {
      const { humanizeWithBlader } = await import("@/lib/humanizer");
      const { keyPoolChat } = await import("@/lib/rewrite");
      const state = useApp.getState();
      const pool = keyPool(state, site?.voice.modelKeyId, Date.now(), site?.id).filter((key) => keyCallsModel(key));
      const result = await humanizeWithBlader({
        chat: keyPoolChat({ keys: pool, onPenalty: (keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error) }),
        markdown: article!.markdown,
        keyword: article!.keyword,
        title: article!.title,
        authorName: author?.name ?? article!.authorName,
        authorVoice: author ? authorVoiceBlock(author) : undefined,
        authorBannedPhrases: [...(site?.voice.bannedPhrases ?? []), ...(author?.voice.bannedPhrases ?? [])],
      });
      const linked = ensureMarkdownLinks(result.markdown, article!.links.map((link) => ({ anchor: link.anchor, slug: link.targetSlug })));
      const body = articleFromMarkdown(linked);
      const withImages = applyFetchedImages(body.html, body.markdown, article!.images, article!.keyword);
      useApp.getState().patchArticle(article!.id, {
        ...body,
        html: withImages.html,
        markdown: withImages.markdown,
        humanized: true,
        humanNote: result.note,
        humanizerScore: result.score,
        humanizerStripped: result.stripped,
        humanizerPasses: result.passes,
        humanizerNote: result.note,
        bulletproof: true,
      });
      setNote(`${result.note} · prose purity ${result.score}/100`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Humanization failed.");
    } finally {
      setBusy(false);
    }
  }

  const stats: [string, string][] = [
    ["Uniqueness", `${Math.round(uniquenessAgainst(article.title, article.keyword, corpus.filter((item) => item.id !== article.id).map((item) => ({ keyword: item.keyword, title: item.title, slug: item.slug, sample: `${item.title}. ${item.sections.map((section) => section.heading).join(". ")}` })), article.sections) * 100)}%`],
    ["Coverage", `${Math.round(measureArticle(article).coverage * 100)}%`],
    ["Intent match", `${Math.round(measureArticle(article).intent * 100)}%`],
    ["Words", String(article.words)],
    ["Links", `${article.links.length} out · ${inboundCount(corpus, article.slug)} in`],
    ["Bing score", `${Math.floor(score * 100)}%`],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="min-w-0 space-y-4 lg:col-span-3">
        <PageIntro eyebrow={article.keyword} title={article.title} lede={article.excerpt} />
        <HumanizeBanner />
        {!article.humanized ? (
          <Card className="rounded-xl p-4 text-[13px] leading-6 text-muted">
            {article.humanState === "running" || article.humanState === "pending"
              ? "Blader humanizer is auditing this draft for AI tells."
              : article.humanNote || HUMANIZER_MISSING}
          </Card>
        ) : (
          <Card className="rounded-xl p-4 text-[13px] leading-6 text-muted">{article.humanNote || "Blader humanizer pass is done."}</Card>
        )}
        {article.humanized && typeof article.humanizerScore === "number" ? (
          <Card className="space-y-3 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="eyebrow">Blader humanizer</div>
              <div className="flex gap-2">
                <Badge tone={article.humanizerScore >= 90 ? "ok" : article.humanizerScore >= 70 ? "brass" : "danger"}>prose purity {article.humanizerScore}/100</Badge>
                <Badge tone="muted">{article.humanizerPasses === 2 ? "audit + rewrite (2 passes)" : "deterministic pass"}</Badge>
              </div>
            </div>
            {article.humanizerStripped?.length ? (
              <div>
                <p className="text-[11px] text-faint">AI patterns stripped in Stage 3 revision:</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {article.humanizerStripped.map((pattern, index) => (
                    <li key={`${pattern}-${index}`} className="num rounded-sm border border-line bg-surface px-2 py-0.5 text-[11px] text-muted">
                      {pattern}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[11px] text-faint">No AI patterns remained after the pass.</p>
            )}
            {article.humanizerNote ? <p className="text-[11px] leading-5 text-faint">{article.humanizerNote}</p> : null}
          </Card>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(article.status)}>{article.status}</Badge>
          <Badge tone="muted">{article.engine}</Badge>
          {article.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
        {!article.html.includes("<img") ? (
          <Card className="rounded-xl p-4 text-[13px] leading-6 text-muted">{article.imageState === "empty" ? "No Bing photo passed the size check for this draft." : "Matching a Bing photo for this draft…"}</Card>
        ) : null}
        <Card className="rounded-xl p-5 sm:p-7">
          <article
              className="reading-prose mx-auto text-fg [&_a]:text-brass"
            onClick={(event) => {
              const anchor = (event.target as HTMLElement).closest("a");
              if (!anchor) return;
              event.preventDefault();
            }}
            dangerouslySetInnerHTML={{ __html: stripVerify(article.html) }}
          />
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => void copy("html")}>
              {copied === "html" ? "HTML copied" : "Copy HTML"}
            </Button>
            <Button variant="ghost" onClick={() => void copy("md")}>
              {copied === "md" ? "Markdown copied" : "Copy Markdown"}
            </Button>
            <Button onClick={() => void humanize()} disabled={busy}>
              {busy ? "Humanizing…" : "Bulletproof humanize"}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                useApp.getState().patchArticle(article.id, {
                  imageSalt: (article.imageSalt ?? 0) + 1,
                  imageState: "pending",
                  images: article.images.map((image) => ({ ...image, src: undefined, selected: false })),
                })
              }
            >
              Refresh photos
            </Button>
            <Button
              onClick={() => {
                const state = useApp.getState();
                const keyId = site?.voice.modelKeyId;
                const key = state.keys.find((item) => item.id === keyId);
                if (key?.secret && key.baseUrl) {
                  state.patchArticle(article.id, {
                    liveState: "pending",
                    liveError: undefined,
                    imageSalt: (article.imageSalt ?? 0) + 1,
                    imageState: "pending",
                    images: article.images.map((image) => ({ ...image, src: undefined, selected: false })),
                  });
                  setNote("Regenerating with your model. Photos are fetched after the new draft.");
                  return;
                }
                const angles = ["time", "money", "skip", "alternative", "daily", "compare", "conversation", "stop"];
                const angle = angles[((article.imageSalt ?? 0) + 1) % angles.length]!;
                const composed = composeArticle({
                  title: article.title,
                  keyword: article.keyword,
                  angle,
                  tone: site?.voice.tone ?? "plain",
                  sectionCount: site?.voice.sections ?? 5,
                  imageCount: site?.voice.sectionImages ?? 2,
                  links: article.links.map((link) => ({ anchor: link.anchor, slug: link.targetSlug })),
                  nicheTag: site?.nicheTag ?? "notes",
                  corpus: corpus
                    .filter((item) => item.id !== article.id)
                    .map((item) => ({
                      keyword: item.keyword,
                      title: item.title,
                      slug: item.slug,
                      sample: `${item.title}. ${item.sections.map((section) => section.heading).join(". ")}`,
                    })),
                });
                state.patchArticle(article.id, {
                  html: composed.html,
                  markdown: composed.markdown,
                  excerpt: composed.excerpt,
                  sections: composed.sections,
                  words: composed.words,
                  uniqueness: composed.uniqueness,
                  engine: "fallback",
                  liveState: "skipped",
                  imageSalt: (article.imageSalt ?? 0) + 1,
                  imageState: "pending",
                  images: composed.images,
                });
                setNote("Rewrote the draft from the next angle and queued new photos.");
              }}
            >
              Regenerate draft
            </Button>
            {article.ghostPush === "error" ? (
              <Button variant="ghost" onClick={() => useApp.getState().patchArticle(article.id, { ghostPush: "pending", liveError: undefined })}>
                Retry Ghost publish
              </Button>
            ) : null}
            {holdReason ? (
              <Button
                variant="ghost"
                onClick={() => {
                  if (article.jobId) retryJob(article.jobId);
                  setNote(
                    holdReason === "review-held"
                      ? "Queued for another attempt. Validation runs again and publishes if it clears."
                      : "Queued. The publish stage re-runs against the saved Ghost connection.",
                  );
                }}
              >
                Release the hold and publish
              </Button>
            ) : null}
            <Link
              to="/preview/$slug"
              params={{ slug: article.slug }}
              className="inline-flex min-h-10 items-center rounded-md px-1 text-[13px] font-medium text-muted underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline"
            >
              Preview static page
            </Link>
          </div>
          {note || article.humanNote || article.liveError || article.liveState === "running" || article.liveState === "pending" ? (
            <p className="mt-3 text-[13px] leading-6 text-muted">
              {article.liveState === "pending" || article.liveState === "running"
                ? "Live model is writing this draft."
                : note || article.liveError || article.humanNote}
            </p>
          ) : null}
        </Card>
      </div>
      <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:col-span-2 lg:self-start">
        <Card className="overflow-hidden rounded-xl p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface/60 px-4 py-3">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Properties</h2>
            <span className="num text-[11px] text-faint">{article.words} words</span>
          </div>
          <dl className="divide-y divide-line">
            {stats.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-4 py-2">
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="num truncate text-[12px] text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        {author ? (
          <Card className="rounded-xl p-4">
            <div className="eyebrow">Author</div>
            <div className="mt-2.5 flex items-start gap-3">
              <AuthorAvatar author={author} size={48} />
              <div className="min-w-0">
                <Link to="/authors/$id" params={{ id: author.id }} className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-fg underline-offset-4 hover:underline">
                  {author.name}
                </Link>
                <p className="text-[12px] text-muted">
                  {author.role} · {author.city}, {author.region}, US
                </p>
                <p className="num mt-1 text-[11px] text-faint">
                  {author.articleCount}/{author.maxArticles} articles · {author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId}` : "local byline"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-muted">{author.shortBio}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {author.expertise.map((tag) => (
                <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </Card>
        ) : null}
        <Card className="rounded-xl p-4">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Bing checklist</h2>
          <ul className="mt-2 divide-y divide-line">
            {checks.map((check) => (
              <li key={check.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-[13px] text-fg">
                  <span className="min-w-0">{check.label}</span>
                  {check.pass ? (
                    <Badge tone="ok">pass</Badge>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone="danger">fix</Badge>
                      <Button variant="ghost" className="min-h-7 px-2 text-[12px]" onClick={() => fixCheck(check.id)}>
                        Fix
                      </Button>
                    </span>
                  )}
                </div>
                {!check.pass ? <p className="mt-1 text-[11px] leading-5 text-muted">{check.tip}</p> : null}
                {check.id === "index" && !check.pass && !site?.publicUrl ? (
                  <input
                    className={`${fieldClass} mt-2 text-[12px]`}
                    value={publicUrl}
                    onChange={(event) => setPublicUrl(event.target.value)}
                    placeholder="https://your-site.com"
                    aria-label="Public URL"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="space-y-3 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Article text</h2>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={exportMarkdown}>
                Export .md
              </Button>
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={saveEdit}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  Edit article
                </Button>
              )}
            </div>
          </div>
          {editing ? (
            <textarea
              className={`${fieldClass} h-96 w-full font-mono text-[12px]`}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              aria-label="Article markdown"
              spellCheck={false}
            />
          ) : (
            <p className="text-[11px] leading-5 text-muted">
              {article.markdown.trim().split(/\s+/).length} words of stored markdown. Edit it here and the next build ships your
              text; export takes the file to Ghost's editor or anywhere else.
            </p>
          )}
        </Card>
        <Card className="rounded-xl p-4">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Ghost publish ledger</h2>
          <p className="mt-2 text-[12px] leading-5 text-muted">CONFIRMED · single-shot invariant. shots = {article.ledger.shots}</p>
          <dl className="num mt-3 space-y-1 text-[11px] leading-5 text-faint">
            <div>Mode {article.ledger.mode}</div>
            <div>Post {article.ledger.postId}</div>
            <div>Dispatched {new Date(article.ledger.dispatchedAt).toISOString()}</div>
            <div>Confirmed {new Date(article.ledger.confirmedAt).toISOString()}</div>
          </dl>
        </Card>
        <Card className="rounded-xl p-4">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Internal links</h2>
          <p className="num mt-1 text-[11px] text-faint">{inboundCount(corpus, article.slug)} inbound · {article.links.length} outbound · /post/slug/</p>
          <ul className="mt-2 divide-y divide-line">
            {article.links.map((link) => (
              <li key={link.targetSlug} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-fg">{link.anchor}</span>
                  <span className="num mt-0.5 block truncate text-[11px] text-faint">/post/{link.targetSlug}/</span>
                </span>
                <Badge tone={statusTone(link.state)}>{link.state}</Badge>
              </li>
            ))}
            {!article.links.length ? <li className="py-2 text-[13px] text-muted">No verified target in inventory yet.</li> : null}
          </ul>
        </Card>
        <Card className="space-y-3 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Images</h2>
            <Button
              variant="ghost"
              size="sm"
              disabled={Boolean(retrying.length) || !article.images.length}
              onClick={() => void retryImages(article.images.map((_, index) => index))}
            >
              {retrying.length > 1 ? "Fetching…" : "Fetch images again"}
            </Button>
          </div>
          <p className="text-[11px] leading-5 text-muted">Every slot resolves a real, topic-matched Bing thumbnail URL (dynamic, zero disk). A downloaded copy is uploaded to Ghost only when Ghost is live; the exported static site keeps the Bing URL.</p>
          {article.images.map((image, index) => (
            <div key={`${image.role}-${image.query}`}>
              <img
                src={articleImageSrc(image, article.keyword || article.title)}
                alt={image.alt}
                width={image.width || 474}
                height={image.height || 274}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="aspect-video w-full rounded-md border border-line object-cover"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={retrying.includes(index)}
                  onClick={() => void retryImages([index])}
                >
                  {retrying.includes(index) ? "Fetching…" : "Retry this image"}
                </Button>
                <span className="num text-[11px] text-faint">salt {retrySalt}</span>
              </div>
              <div className="num mt-1 text-[11px] leading-5 text-muted">
                {image.role} · {image.width || "…"}×{image.height || "…"} · c=7 · {image.selected ? "SELECTED" : "waiting"} · {image.license ?? "unknown-bing"}
              </div>
              <div className="num mt-1 break-all text-[11px] leading-5 text-faint">
                {articleImageSrc(image, article.keyword || article.title)}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-muted">{image.alt}</div>
            </div>
          ))}
        </Card>
        <Card className="rounded-xl p-4">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Stage tokens</h2>
          <ul className="num mt-2 space-y-1 text-[11px] leading-5 text-muted">
            {article.stageTokens.map((tokens, index) => (
              <li key={index}>
                Stage {index + 1}: {tokens}
                {index === 5 ? " · validation is 0 LLM tokens" : ""}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="rounded-xl p-4">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Revision notes</h2>
          <p className="mt-2 text-[13px] leading-6 text-muted">{article.revisionNotes}</p>
          <h3 className="mt-4 text-[12px] font-semibold text-fg">Must-cover</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] leading-5 text-muted">
            {article.mustCover.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="mt-4 text-[12px] font-semibold text-fg">Verify</h3>
          <p className="mt-1 text-[11px] text-muted">Verify before publish</p>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-5 text-brass-2">
            {article.verifyFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="eyebrow">{k}</div>
      <div className="num mt-1 text-[15px] text-fg">{v}</div>
    </div>
  );
}
