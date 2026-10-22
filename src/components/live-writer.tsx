import { useEffect, useRef } from "react";
import { articleFromMarkdown, ensureMarkdownLinks, humanizeMarkdown, researchDigest, writeWithModel } from "@/lib/rewrite";
import { authorVoiceBlock } from "@/lib/authors";
import { sectionsFromMarkdown, stripVerify } from "@/lib/markdown";
import { keyCallsModel, keyPool, planImages, uniquenessAgainst } from "@/lib/engine";
import { useApp } from "@/lib/store";
import type { AiKey, Article, Job, Run } from "@/lib/types";

type KeyForPool = AiKey;
type JobForPool = Job;
type RunForPool = Run;
type ArticleLive = Article;

export function LiveWriter() {
  const stateRef = useRef(useApp.getState());
  const busy = useRef(new Set<string>());
  const cooldown = useRef(new Map<string, number>());
  const active = useApp((s) => s.articles.some((item) => item.liveState === "pending" || item.liveState === "running"));

  useEffect(() => {
    if (!active) return;
    const pass = () => {
      stateRef.current = useApp.getState();
      const { articles, jobs, runs } = stateRef.current;
      const waiting = articles.filter((item) => item.liveState === "pending" || item.liveState === "running");
      // Rule 4: skip only when the whole pool is unusable, not when one key is missing a secret.
      const skipIds = waiting
        .filter((item) => {
          if (busy.current.has(item.id)) return false;
          const job = jobs.find((row) => row.id === item.jobId);
          const run = runs.find((row) => row.id === job?.runId);
          return keyPool(useApp.getState(), run?.modelKeyId, Date.now()).length === 0;
        })
        .map((item) => item.id);
      if (skipIds.length) {
        const skip = new Set(skipIds);
        useApp.setState((s) => ({
          articles: s.articles.map((article) => (skip.has(article.id) ? { ...article, liveState: "skipped" as const } : article)),
        }));
        return;
      }
      const article = waiting.find((item) => !busy.current.has(item.id));
      if (!article) return;
      const job = jobs.find((item) => item.id === article.jobId);
      const run = runs.find((item) => item.id === job?.runId);
      const pool = keyPool(useApp.getState(), run?.modelKeyId, Date.now()).filter((key) => keyCallsModel(key));
      if (!pool.length) return;
      if (Date.now() < (cooldown.current.get(article.id) ?? 0)) return;
      busy.current.add(article.id);
      useApp.getState().patchArticle(article.id, { liveState: "running", liveError: undefined });
      void (async () => {
        try {
          await writeArticleFromPool(article, job, run, pool);
        } catch (error) {
          useApp.getState().patchArticle(article.id, {
            liveState: "error",
            liveError: error instanceof Error ? error.message : "Live generation failed.",
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

async function writeArticleFromPool(
  article: ArticleLive,
  job: JobForPool | undefined,
  run: RunForPool | undefined,
  pool: KeyForPool[],
) {
  const research = await researchDigest(run?.researchUrls ?? [], article.title);
  const author =
    useApp.getState().authors.find((item) => item.id === article.authorId) ??
    useApp.getState().authors.find((item) => item.id === job?.authorId);
  const written = await writeWithModel({
    keys: pool,
    keyword: article.keyword,
    title: article.title,
    authorName: author?.name ?? article.authorName ?? "the desk",
    authorVoice: author ? authorVoiceBlock(author) : undefined,
    links: article.links.map((link) => ({ anchor: link.anchor, slug: link.targetSlug })),
    avoid: useApp
      .getState()
      .articles.filter((item) => item.siteId === article.siteId && item.id !== article.id)
      .map((item) => item.title),
    research,
  });
  if (job) {
    useApp.setState((s) => ({ jobs: s.jobs.map((row) => (row.id === job.id ? { ...row, keyId: written.keyId } : row)) }));
  }
  let markdown = written.markdown;
  let humanNote: string | undefined;
  let humanized = false;
  if (article.bulletproof || run?.bulletproof) {
    const human = await humanizeMarkdown(markdown, true);
    markdown = human.markdown;
    humanNote = human.note;
    humanized = true;
  }
  markdown = stripVerify(ensureMarkdownLinks(markdown, article.links.map((link) => ({ anchor: link.anchor, slug: link.targetSlug }))));
  const body = articleFromMarkdown(markdown);
  const sections = sectionsFromMarkdown(markdown);
  const site = useApp.getState().sites.find((item) => item.id === article.siteId);
  const images = planImages(
    article.keyword,
    article.title,
    site?.voice.sectionImages ?? 2,
    sections.map((section) => ({
      heading: section.heading,
      words: section.paragraphs.join(" ").split(/\s+/).filter(Boolean).length,
    })),
  ).map((image) => ({ ...image, src: undefined, selected: false }));
  const uniqueness = uniquenessAgainst(
    article.title,
    article.keyword,
    useApp
      .getState()
      .articles.filter((item) => item.siteId === article.siteId && item.id !== article.id)
      .map((item) => ({
        keyword: item.keyword,
        title: item.title,
        slug: item.slug,
        sample: `${item.title}. ${item.sections.map((section) => section.heading).join(". ")}`,
      })),
    sections,
  );
  useApp.getState().patchArticle(article.id, {
    ...body,
    sections,
    images,
    html: body.html,
    markdown: body.markdown,
    uniqueness,
    imageState: "pending",
    researchDigest: research.slice(0, 500),
    humanized,
    humanNote,
    engine: "llm",
    liveState: "done",
    liveError: undefined,
  });
}
