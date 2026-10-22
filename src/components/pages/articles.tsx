import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HumanizeBanner, HUMANIZER_MISSING } from "@/components/humanize-pipeline";
import { AuthorAvatar } from "@/components/pages/authors";
import { bingChecks, bingScore, alignKeywordToQuery, nearDuplicateSibling } from "@/lib/bing";
import { composeArticle, keyCallsModel, keyPool, measureArticle, uniquenessAgainst } from "@/lib/engine";
import { authorVoiceBlock } from "@/lib/authors";
import { inboundCount } from "@/lib/link-graph";
import { stripVerify } from "@/lib/markdown";
import { articleFromMarkdown, ensureMarkdownLinks } from "@/lib/rewrite";
import { applyFetchedImages } from "@/lib/media-html";
import { articleImageSrc } from "@/lib/image-urls";
import { useApp, useHydrated } from "@/lib/store";
import type { Article } from "@/lib/types";
import { Badge, Button, Card, Empty, PageIntro, SkeletonRows, StateNote, statusTone, fieldClass } from "@/components/ui";
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
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${fieldClass} max-w-sm`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, slug, keyword" aria-label="Filter articles" />
        <select className={`${fieldClass} max-w-40`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <select className={`${fieldClass} max-w-40`} value={engine} onChange={(e) => setEngine(e.target.value as typeof engine)} aria-label="Engine">
          <option value="all">All engines</option>
          <option value="llm">LLM</option>
          <option value="fallback">Fallback</option>
        </select>
        <Button variant="ghost" onClick={exportCsv} disabled={!rows.length}>
          Export CSV
        </Button>
        <Button
          variant="ghost"
          disabled={!picked.length}
          onClick={() => {
            deleteArticles(picked);
            setPicked([]);
          }}
        >
          Delete selected{picked.length ? ` (${picked.length})` : ""}
        </Button>
      </div>
      {!rows.length ? (
        <Empty title="No articles" body="Completed jobs land here with a Ghost ledger, downloaded photos, and internal links." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-xl text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-widest text-faint">
              <tr>
                <th className="px-3 py-3 font-medium">
                  <input
                    type="checkbox"
                    aria-label="Select all shown articles"
                    checked={rows.length > 0 && rows.every((article) => picked.includes(article.id))}
                    onChange={(event) => setPicked(event.target.checked ? rows.map((article) => article.id) : [])}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-3 py-3 font-medium">Engine</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Links</th>
                <th className="px-3 py-3 font-medium">Images</th>
                <th className="px-3 py-3 font-medium">Unique</th>
                <th className="px-3 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((article) => (
                <tr key={article.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${article.title}`}
                      checked={picked.includes(article.id)}
                      onChange={(event) =>
                        setPicked((current) => (event.target.checked ? [...current, article.id] : current.filter((id) => id !== article.id)))
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to="/articles/$id" params={{ id: article.id }} className="font-medium">
                      {article.title}
                    </Link>
                    <div className="text-xs text-faint">/{article.slug}{article.authorName ? ` · ${article.authorName}` : ""}</div>
                  </td>
                  <td className="px-3 py-3">{article.engine}</td>
                  <td className="px-3 py-3">
                    <Badge tone={statusTone(article.status)}>{article.status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    {article.links.length} out · {inboundCount(articles, article.slug)} in
                  </td>
                  <td className="px-3 py-3">{article.images.filter((image) => image.selected).length}</td>
                  <td className="px-3 py-3">
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
                  </td>
                  <td className="px-3 py-3 text-muted">{relTime(article.publishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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
      const pool = keyPool(state, site?.voice.modelKeyId, Date.now()).filter((key) => keyCallsModel(key));
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

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <PageIntro eyebrow={article.keyword} title={article.title} lede={article.excerpt} />
        <HumanizeBanner />
        {!article.humanized ? (
          <Card className="p-4 text-sm leading-6 text-muted">
            {article.humanState === "running" || article.humanState === "pending"
              ? "Blader humanizer is auditing this draft for AI tells."
              : article.humanNote || HUMANIZER_MISSING}
          </Card>
        ) : (
          <Card className="p-4 text-sm text-muted">{article.humanNote || "Blader humanizer pass is done."}</Card>
        )}
        {article.humanized && typeof article.humanizerScore === "number" ? (
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-widest text-faint">Blader humanizer</div>
              <div className="flex gap-2">
                <Badge tone={article.humanizerScore >= 90 ? "ok" : article.humanizerScore >= 70 ? "brass" : "danger"}>prose purity {article.humanizerScore}/100</Badge>
                <Badge tone="muted">{article.humanizerPasses === 2 ? "audit + rewrite (2 passes)" : "deterministic pass"}</Badge>
              </div>
            </div>
            {article.humanizerStripped?.length ? (
              <div>
                <p className="text-xs text-faint">AI patterns stripped in Stage 3 revision:</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {article.humanizerStripped.map((pattern, index) => (
                    <li key={`${pattern}-${index}`} className="rounded border border-line px-2 py-0.5 font-mono text-xs text-muted">
                      {pattern}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-faint">No AI patterns remained after the pass.</p>
            )}
            {article.humanizerNote ? <p className="text-xs text-faint">{article.humanizerNote}</p> : null}
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
          <Card className="p-4 text-sm text-muted">{article.imageState === "empty" ? "No Bing photo passed the size check for this draft." : "Matching a Bing photo for this draft…"}</Card>
        ) : null}
        <Card className="p-5">
          <article
              className="reading-prose mx-auto text-fg [&_a]:text-brass"
            onClick={(event) => {
              const anchor = (event.target as HTMLElement).closest("a");
              if (!anchor) return;
              event.preventDefault();
            }}
            dangerouslySetInnerHTML={{ __html: stripVerify(article.html) }}
          />
          <div className="mt-4 flex flex-wrap gap-2">
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
            <Link to="/preview/$slug" params={{ slug: article.slug }} className="inline-flex min-h-11 items-center text-sm text-brass">
              Preview static page
            </Link>
          </div>
          {note || article.humanNote || article.liveError || article.liveState === "running" || article.liveState === "pending" ? (
            <p className="mt-3 text-sm text-muted">
              {article.liveState === "pending" || article.liveState === "running"
                ? "Live model is writing this draft."
                : note || article.liveError || article.humanNote}
            </p>
          ) : null}
        </Card>
      </div>
      <div className="space-y-4 lg:col-span-2">
        <Card className="grid grid-cols-2 gap-3 p-4 text-sm">
          <Stat k="Uniqueness" v={`${Math.round(uniquenessAgainst(article.title, article.keyword, corpus.filter((item) => item.id !== article.id).map((item) => ({ keyword: item.keyword, title: item.title, slug: item.slug, sample: `${item.title}. ${item.sections.map((section) => section.heading).join(". ")}` })), article.sections) * 100)}%`} />
          <Stat k="Coverage" v={`${Math.round(measureArticle(article).coverage * 100)}%`} />
          <Stat k="Intent match" v={`${Math.round(measureArticle(article).intent * 100)}%`} />
          <Stat k="Words" v={String(article.words)} />
          <Stat k="Links" v={`${article.links.length} out · ${inboundCount(corpus, article.slug)} in`} />
          <Stat k="Bing" v={`${Math.floor(score * 100)}%`} />
        </Card>
        {author ? (
          <Card className="p-4 text-sm">
            <div className="text-xs uppercase tracking-widest text-faint">Author</div>
            <div className="mt-2 flex items-start gap-3">
              <AuthorAvatar author={author} size={48} />
              <div className="min-w-0">
                <Link to="/authors/$id" params={{ id: author.id }} className="block text-lg font-semibold tracking-tight">
                  {author.name}
                </Link>
                <p className="text-muted">
                  {author.role} · {author.city}, {author.region}, US
                </p>
                <p className="mt-1 text-xs text-faint">
                  {author.articleCount}/{author.maxArticles} articles · {author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId}` : "local byline"}
                </p>
              </div>
            </div>
            <p className="mt-2 leading-6 text-muted">{author.shortBio}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {author.expertise.map((tag) => (
                <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </Card>
        ) : null}
        <Card className="p-4 text-sm">
          <h2 className="text-lg font-semibold tracking-tight">Bing checklist</h2>
          <ul className="mt-3 space-y-2">
            {checks.map((check) => (
              <li key={check.id}>
                <div className="flex items-center justify-between gap-2">
                  <span>{check.label}</span>
                  {check.pass ? (
                    <Badge tone="ok">pass</Badge>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Badge tone="danger">fix</Badge>
                      <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => fixCheck(check.id)}>
                        Fix
                      </Button>
                    </span>
                  )}
                </div>
                {!check.pass ? <p className="mt-1 text-xs leading-5 text-muted">{check.tip}</p> : null}
                {check.id === "index" && !check.pass && !site?.publicUrl ? (
                  <input
                    className={`${fieldClass} mt-2 text-xs`}
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
        <Card className="p-4 text-sm">
          <h2 className="font-display text-xl">Ghost publish ledger</h2>
          <p className="mt-2 text-muted">CONFIRMED · single-shot invariant. shots = {article.ledger.shots}</p>
          <dl className="mt-3 space-y-1 text-xs">
            <div>Mode {article.ledger.mode}</div>
            <div>Post {article.ledger.postId}</div>
            <div>Dispatched {new Date(article.ledger.dispatchedAt).toISOString()}</div>
            <div>Confirmed {new Date(article.ledger.confirmedAt).toISOString()}</div>
          </dl>
        </Card>
        <Card className="p-4">
          <h2 className="font-display text-xl">Internal links</h2>
          <p className="mt-1 text-xs text-faint">{inboundCount(corpus, article.slug)} inbound · {article.links.length} outbound · /post/slug/</p>
          <ul className="mt-2 space-y-2 text-sm">
            {article.links.map((link) => (
              <li key={link.targetSlug} className="flex items-center justify-between gap-2">
                <span>
                  {link.anchor}
                  <span className="mt-0.5 block font-mono text-xs text-faint">/post/{link.targetSlug}/</span>
                </span>
                <Badge tone={statusTone(link.state)}>{link.state}</Badge>
              </li>
            ))}
            {!article.links.length ? <li className="text-muted">No verified target in inventory yet.</li> : null}
          </ul>
        </Card>
        <Card className="space-y-3 p-4">
          <h2 className="font-display text-xl">Images</h2>
          <p className="text-xs leading-5 text-muted">Every slot resolves a real, topic-matched Bing thumbnail URL (dynamic, zero disk). A downloaded copy is uploaded to Ghost only when Ghost is live; the exported static site keeps the Bing URL.</p>
          {article.images.map((image) => (
            <div key={`${image.role}-${image.query}`}>
              <img
                src={articleImageSrc(image, article.keyword || article.title)}
                alt={image.alt}
                width={image.width || 474}
                height={image.height || 274}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="aspect-video w-full rounded-lg object-cover"
              />
              <div className="mt-1 text-xs text-muted">
                {image.role} · {image.width || "…"}×{image.height || "…"} · c=7 · {image.selected ? "SELECTED" : "waiting"} · {image.license ?? "unknown-bing"}
              </div>
              <div className="mt-1 break-all font-mono text-xs text-faint">
                {articleImageSrc(image, article.keyword || article.title)}
              </div>
              <div className="text-xs text-muted">{image.alt}</div>
            </div>
          ))}
        </Card>
        <Card className="p-4 text-sm">
          <h2 className="font-display text-xl">Stage tokens</h2>
          <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
            {article.stageTokens.map((tokens, index) => (
              <li key={index}>
                Stage {index + 1}: {tokens}
                {index === 5 ? " · validation is 0 LLM tokens" : ""}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4 text-sm">
          <h2 className="font-display text-xl">Revision notes</h2>
          <p className="mt-2 leading-6 text-muted">{article.revisionNotes}</p>
          <h3 className="mt-4 text-fg">Must-cover</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
            {article.mustCover.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="mt-4 text-fg">Verify</h3>
          <p className="mt-1 text-xs text-muted">Verify before publish</p>
          <ul className="mt-2 space-y-1 text-brass-2">
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
      <div className="text-xs uppercase tracking-widest text-faint">{k}</div>
      <div className="font-display text-2xl">{v}</div>
    </div>
  );
}
