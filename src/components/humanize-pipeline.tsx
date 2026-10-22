import { useEffect, useMemo, useRef } from "react";
import { authorVoiceBlock } from "@/lib/authors";
import { articleFromMarkdown, ensureMarkdownLinks } from "@/lib/rewrite";
import { applyFetchedImages } from "@/lib/media-html";
import { bingChecks, bingScore } from "@/lib/bing";
import { humanizeWithBlader, BLADER_SOURCE } from "@/lib/humanizer";
import { siteChat } from "@/lib/rewrite";
import { useApp } from "@/lib/store";
import { uid } from "@/lib/utils";
import { Card } from "@/components/ui";
import type { Article, AuthorProfile, Site } from "@/lib/types";

type HumanizeArticle = Article;
type HumanizeSite = Site;
type HumanizeAuthor = AuthorProfile;

export const HUMANIZER_PENDING_NOTE = "Blader humanizer queued. A deterministic pass always runs; a live key adds the surgical audit + rewrite.";
export const HUMANIZER_MISSING = HUMANIZER_PENDING_NOTE;

export function HumanizePipeline() {
  const stateRef = useRef(useApp.getState());
  const busy = useRef(new Set<string>());
  const cooldown = useRef(new Map<string, number>());
  const active = useApp((s) =>
    s.articles.some(
      (item) => !item.humanized && item.humanState !== "running" && item.humanState !== "error" && item.liveState !== "pending" && item.liveState !== "running",
    ),
  );

  useEffect(() => {
    if (!active) return;
    const pass = () => {
      stateRef.current = useApp.getState();
      const { articles, sites } = stateRef.current;
      const article = articles.find(
        (item) => !item.humanized && item.humanState !== "running" && item.humanState !== "error" && item.liveState !== "pending" && item.liveState !== "running",
      );
      if (!article || busy.current.has(article.id)) return;
      if (Date.now() < (cooldown.current.get(article.id) ?? 0)) return;
      const site = sites.find((item) => item.id === article.siteId);
      const author = useApp.getState().authors.find((item) => item.id === article.authorId);
      busy.current.add(article.id);
      useApp.getState().patchArticle(article.id, { humanState: "running", humanNote: "Blader humanizer is rewriting this draft." });
      void (async () => {
        try {
          await runHumanizer(article, site, author);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Humanization failed.";
          useApp.getState().patchArticle(article.id, {
            humanized: false,
            humanState: "error",
            humanNote: message,
          });
        } finally {
          cooldown.current.set(article.id, Date.now() + 500);
          window.setTimeout(() => busy.current.delete(article.id), 500);
        }
      })();
    };
    void pass();
    const timer = window.setInterval(pass, 1500);
    return () => window.clearInterval(timer);
  }, [active]);

  return null;
}

async function runHumanizer(
  article: HumanizeArticle,
  site: HumanizeSite | undefined,
  author: HumanizeAuthor | undefined,
) {
  const current = useApp.getState().articles.find((item) => item.id === article.id) ?? article;
  const result = await humanizeWithBlader({
    chat: siteChat((keyId, status, error) => useApp.getState().penalizeKey(keyId, status, error)),
    markdown: current.markdown,
    keyword: current.keyword,
    title: current.title,
    authorName: author?.name ?? article.authorName,
    authorVoice: author ? authorVoiceBlock(author) : undefined,
    authorBannedPhrases: [...(site?.voice.bannedPhrases ?? []), ...(author?.voice.bannedPhrases ?? [])],
  });
  // Honest metering: the two-pass rewrite lands in the same SETTLED ledger.
  if (result.usage) {
    useApp.setState((s) => ({
      events: [
        {
          id: uid("evt"),
          pairId: `hum_${article.id}:${Date.now()}`,
          siteId: article.siteId,
          keyId: result.keyId ?? "key_studio",
          at: Date.now(),
          state: "SETTLED" as const,
          provider: "Blader humanizer",
          model: result.llm ? "audit+rewrite" : "deterministic",
          stage: "humanize",
          tokens: result.usage!.total,
          usd: 0,
        },
        ...s.events,
      ],
    }));
  }
  const linked = ensureMarkdownLinks(result.markdown, current.links.map((link) => ({ anchor: link.anchor, slug: link.targetSlug })));
  const body = articleFromMarkdown(linked);
  const withMedia = applyFetchedImages(body.html, linked, current.images, current.keyword);
  useApp.getState().patchArticle(article.id, {
    ...body,
    html: withMedia.html,
    markdown: withMedia.markdown,
    sections: current.sections,
    humanized: true,
    humanState: "done",
    humanizerScore: result.score,
    humanizerStripped: result.stripped,
    humanizerPasses: result.passes,
    humanizerNote: result.note,
    humanNote: `${result.note} · score ${result.score}`,
    bulletproof: true,
    // Rule 3d policy: a live publish held for humanization is released now.
    ghostPush: current.ghostPush === "held" ? ("pending" as const) : current.ghostPush,
  });
}

export function HumanizeBanner() {
  const siteId = useApp((s) => s.activeSiteId);
  const site = useApp((s) => s.sites.find((item) => item.id === siteId));
  const articleList = useApp((s) => s.articles);
  const articles = useMemo(() => articleList.filter((item) => item.siteId === siteId), [articleList, siteId]);
  const ready = articles.length
    ? articles.reduce((sum, article) => sum + bingScore(bingChecks(article, articles, site)), 0) / articles.length
    : 0;
  const pct = Math.floor(ready * 100);
  const scored = articles.filter((article) => typeof article.humanizerScore === "number");
  const avgScore = scored.length ? Math.round(scored.reduce((sum, article) => sum + (article.humanizerScore ?? 0), 0) / scored.length) : null;
  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-xs uppercase tracking-widest text-faint">Blader humanizer</div>
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-faint">native · {BLADER_SOURCE}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {articles.length ? `${avgScore === null ? "—" : `${avgScore}% prose purity`}` : "—"}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        {articles.length
          ? avgScore === null
            ? "No article has humanized yet. The next draft runs the deterministic pass, and a usable model key adds the surgical audit + rewrite."
            : `${scored.length} of ${articles.length} articles humanized. The Bing humanization check passes at ${pct}%.`
          : "Drafts run through the blader/humanizer ruleset: 26 AI-writing patterns detected and stripped, with the assigned author's voice."}
      </p>
    </Card>
  );
}
