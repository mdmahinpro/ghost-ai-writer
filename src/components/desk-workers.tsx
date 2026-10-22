import { useEffect, useRef } from "react";
import { publishGhostPost, updateGhostPostHtml } from "@/lib/ghost.functions";
import { placeImages } from "@/lib/images.functions";
import { submitIndexNow } from "@/lib/ops.functions";
import { alreadyLinked, insertAnchor } from "@/lib/link-graph";
import { withEdgeState } from "@/lib/reweave";
import { applyFetchedImages } from "@/lib/media-html";
import { stripVerify } from "@/lib/markdown";
import { planImages } from "@/lib/engine";
import { useApp } from "@/lib/store";
import type { Article, ArticleImage } from "@/lib/types";

function digestOf(src?: string): string {
  const name = src?.split("/").pop() ?? "";
  return name.replace(/\.(jpg|jpeg|png|webp)$/i, "");
}

function repairLinks(article: Article): Pick<Article, "html" | "markdown"> | null {
  let html = stripVerify(article.html);
  let markdown = stripVerify(article.markdown);
  let changed = html !== article.html || markdown !== article.markdown;
  for (const link of article.links) {
    const bare = `href="/${link.targetSlug}"`;
    const bareSlash = `href="/${link.targetSlug}/"`;
    if (html.includes(bare) || html.includes(bareSlash)) {
      html = html.split(bare).join(`href="/post/${link.targetSlug}/"`).split(bareSlash).join(`href="/post/${link.targetSlug}/"`);
      changed = true;
    }
    if (alreadyLinked(html, markdown, link.targetSlug)) continue;
    const inserted = insertAnchor(html, markdown, link.anchor, link.targetSlug);
    if (!inserted.inserted) continue;
    html = inserted.html;
    markdown = inserted.markdown;
    changed = true;
  }
  return changed ? { html, markdown } : null;
}

export function DeskWorkers() {
  const stateRef = useRef(useApp.getState());
  const imageBusy = useRef(new Set<string>());
  const imageCooldown = useRef(new Map<string, number>());
  const ghostBusy = useRef(new Set<string>());
  const ghostCooldown = useRef(new Map<string, number>());
  const reweaveBusy = useRef(new Set<string>());
  const reweaveCooldown = useRef(new Map<string, number>());
  const repaired = useRef(new Set<string>());
  const active = useApp((s) =>
    s.articles.some(
      (item) =>
        item.liveState === "pending" ||
        item.liveState === "running" ||
        item.imageState === "pending" ||
        item.ghostPush === "pending" ||
        item.ghostPush === "held" ||
        (item.ghostPush === "done" && item.links.some((link) => link.state === "LOCAL")),
    ),
  );

  useEffect(() => {
    if (!active) return;
    /** Fix bare internal links and verify every edge points at a real target. */
    function repairPass() {
      const articles = stateRef.current.articles;
      const patches: { id: string; patch: Pick<Article, "html" | "markdown"> }[] = [];
      for (const article of articles) {
        if (repaired.current.has(article.id)) continue;
        repaired.current.add(article.id);
        const patch = repairLinks(article);
        if (patch) patches.push({ id: article.id, patch });
      }
      if (!patches.length) return;
      useApp.setState((s) => ({
        articles: s.articles.map((article) => {
          const hit = patches.find((item) => item.id === article.id);
          return hit ? { ...article, ...hit.patch } : article;
        }),
      }));
    }

    /** Fetch and place photos for drafts that finished writing. */
    function imagePass() {
      const { articles, sites } = stateRef.current;
      const article = articles.find(
        (item) =>
          item.imageState !== "ready" &&
          item.imageState !== "empty" &&
          item.liveState !== "pending" &&
          item.liveState !== "running" &&
          !imageBusy.current.has(item.id) &&
          Date.now() >= (imageCooldown.current.get(item.id) ?? 0),
      );
      if (!article) return;
      const site = sites.find((item) => item.id === article.siteId);
      imageBusy.current.add(article.id);
      const sectionCount = Math.max(
        1,
        article.images.filter((image) => image.role === "section").length || site?.voice.sectionImages || 1,
      );
      const planned = planImages(
        article.keyword,
        article.title,
        sectionCount,
        (article.sections ?? []).map((section) => ({
          heading: section.heading,
          words: section.paragraphs.join(" ").split(/\s+/).filter(Boolean).length,
        })),
      );
      const slots = planned.slice(0, 4);
      const avoid = articles.flatMap((item) => item.images.map((image) => digestOf(image.src))).filter(Boolean);
      void (async () => {
        try {
          const result = await placeImages({
            data: {
              provider: site?.voice.imageProvider ?? "bing",
              salt: article.imageSalt ?? 0,
              avoid,
              slots: slots.map((slot) => ({ query: slot.query, alt: slot.alt, role: slot.role, width: slot.width, height: slot.height })),
            },
          });
          const images: ArticleImage[] = result.images.map((image) => ({
            role: image.role,
            query: image.query,
            alt: image.alt,
            http: image.http,
            selected: image.selected,
            src: image.src,
            remote: image.remote,
            width: image.width,
            height: image.height,
            bytes: image.bytes,
            license: image.license,
            attempts: image.attempts,
          }));
          const seen = new Set<string>();
          const unique = images.map((image) => {
            const digest = digestOf(image.src);
            if (!image.selected || !digest || seen.has(digest)) return { ...image, selected: false, src: undefined };
            seen.add(digest);
            return image;
          });
          const current = useApp.getState().articles.find((item) => item.id === article.id) ?? article;
          const body = applyFetchedImages(stripVerify(current.html), stripVerify(current.markdown), unique, current.keyword);
          const placed = unique.some((image) => image.selected && image.src);
          const salt = article.imageSalt ?? 0;
          useApp.getState().patchArticle(article.id, {
            images: unique,
            html: body.html,
            markdown: body.markdown,
            imageState: placed ? "ready" : salt < 2 ? "pending" : "empty",
            imageSalt: placed ? salt : salt + 1,
            ghostPush: placed && article.ghostPush === "done" ? "pending" : article.ghostPush,
          });
        } catch {
          useApp.getState().patchArticle(article.id, { imageState: "empty" });
        } finally {
          imageCooldown.current.set(article.id, Date.now() + 500);
          window.setTimeout(() => imageBusy.current.delete(article.id), 500);
        }
      })();
    }

    /** Publish humanized drafts that target a LIVE Ghost site. */
    function ghostPass() {
      const { articles, sites } = stateRef.current;
      const waiting = articles.filter((item) => item.ghostPush === "pending" || item.ghostPush === "held");
      const skipIds = waiting
        .filter((item) => {
          const site = sites.find((row) => row.id === item.siteId);
          return site?.ghost.mode !== "live" || !site.ghost.adminKey;
        })
        .filter((item) => item.ghostPush === "pending")
        .map((item) => item.id);
      if (skipIds.length) {
        const skip = new Set(skipIds);
        useApp.setState((s) => ({
          articles: s.articles.map((article) => (skip.has(article.id) && article.ghostPush === "pending" ? { ...article, ghostPush: "skipped" as const } : article)),
        }));
        return;
      }
      const article = waiting.find(
        (item) =>
          !ghostBusy.current.has(item.id) &&
          Date.now() >= (ghostCooldown.current.get(item.id) ?? 0) &&
          (item.imageState === "ready" || item.imageState === "empty"),
      );
      if (!article) return;
      // Rule 3d policy: a live publish waits for bulletproof humanization. Held — not
      // lost — with an honest label; the humanize pipeline releases it when done.
      if (article.status === "published" && article.humanState !== "done") {
        const note = "Held at publish policy: blader humanization is still running on this article. This note frees the publish when the pass finishes.";
        if (article.ghostPush !== "held") {
          useApp.getState().patchArticle(article.id, { ghostPush: "held", liveState: "skipped" });
          useApp.setState((s) => ({ articles: s.articles.map((row) => (row.id === article.id && !row.humanNote ? { ...row, humanNote: note } : row)) }));
        }
        return;
      }
      const site = sites.find((item) => item.id === article.siteId);
      if (!site?.ghost.adminKey) return;
      ghostBusy.current.add(article.id);
      useApp.getState().patchArticle(article.id, { ghostPush: "running" });
      // Rule 2: attach the assigned author to the Ghost post. The avatar travels as
      // an external URL string — never downloaded, never written to local disk.
      const author = useApp.getState().authors.find((item) => item.id === article.authorId);
      void (async () => {
        const result = await publishGhostPost({
          data: {
            url: site.ghost.url,
            adminKey: site.ghost.adminKey ?? "",
            title: article.title,
            slug: article.slug,
            html: article.html,
            excerpt: article.excerpt,
            metaDescription: article.metaDescription,
            status: article.status === "published" ? "published" : "draft",
            tags: article.tags,
            images: article.images
              .filter((image) => image.selected && image.src)
              .map((image) => ({ src: image.src, remote: image.remote, role: image.role, alt: image.alt })),
            author: author
              ? {
                  name: author.name,
                  slug: author.slug,
                  bio: author.shortBio,
                  profileImage: author.avatarUrl,
                  knownGhostAuthorId: author.ghostAuthorId ?? undefined,
                }
              : undefined,
          },
        });
        if (!result.ok) {
          useApp.getState().patchArticle(article.id, { ghostPush: "error", liveError: result.error });
        } else {
          // Record the real Ghost mapping only. On a graceful fallback the byline
          // stays on the article (HTML + Person JSON-LD) and the status stays local.
          if (author && result.author) {
            useApp.getState().patchAuthor(author.id, {
              ghostAuthorId: result.author.ghostAuthorId ?? author.ghostAuthorId ?? null,
            });
          }
          useApp.getState().patchArticle(article.id, {
            ghostPush: "done",
            ghostMedia: result.imaged ? true : article.ghostMedia,
            html: result.html || article.html,
            liveError: undefined,
            links: article.links.map((link) => (link.state === "BROKEN" || link.state === "FAILED" ? link : { ...link, state: "GHOST_CONFIRMED" as const })),
            ledger: { ...article.ledger, postId: result.postId, confirmed: true, shots: 1 },
          });
          // Rule 3c: auto IndexNow ping after a successful LIVE publish (logged honestly; skipped when unverifiable).
          if (article.status === "published" && site.indexNowKey && site.publicUrl.startsWith("https://")) {
            const ftp = site.providers.find((provider) => provider.id === "cpanel" && provider.status === "verified")?.ftp;
            const url = `${site.publicUrl.replace(/\/$/, "")}/post/${article.slug}/`;
            void submitIndexNow({
              data: {
                publicUrl: site.publicUrl,
                key: site.indexNowKey,
                urls: [url],
                verified: Boolean(ftp),
                ftp: ftp ?? { host: "", user: "", password: "", port: 21, path: "/", via: "ftps" },
              },
            }).then((ping) => {
              useApp.getState().logEvent(
                site.id,
                ping.ok ? "ok" : "warn",
                ping.ok ? `IndexNow ping submitted · ${url}` : `IndexNow skipped after live publish: ${ping.error}`,
              );
            });
          } else if (article.status === "published") {
            useApp.getState().logEvent(site.id, "info", "IndexNow skipped: this site has no verified key-file configuration yet.");
          }
        }
        ghostCooldown.current.set(article.id, Date.now() + 500);
        window.setTimeout(() => ghostBusy.current.delete(article.id), 500);
      })();
    }

    /**
     * Rule 6 autoReweave: a published post with LOCAL link edges (proposed by the
     * calendar re-weave) is updated on Ghost through the PUT-only path. The
     * optimistic lock protects hand-edited posts — a mismatch skips the write and
     * says so instead of clobbering the edit.
     */
    function reweavePass() {
      const { articles, sites, calendars } = stateRef.current;
      const candidate = articles.find((article) => {
        if (article.ghostPush !== "done" || !article.links.some((link) => link.state === "LOCAL")) return false;
        if (reweaveBusy.current.has(article.id)) return false;
        if (Date.now() < (reweaveCooldown.current.get(article.id) ?? 0)) return false;
        const site = sites.find((item) => item.id === article.siteId);
        if (!site || site.ghost.mode !== "live" || !site.ghost.adminKey) return false;
        const calendar = calendars.find((item) => item.siteId === article.siteId && item.autoReweave && item.items.some((entry) => entry.articleId === article.id && entry.status === "PUBLISHED"));
        return Boolean(calendar);
      });
      if (!candidate) return;
      const site = sites.find((item) => item.id === candidate.siteId)!;
      const edge = candidate.links.find((link) => link.state === "LOCAL");
      if (!edge) return;
      reweaveBusy.current.add(candidate.id);
      void (async () => {
        try {
          const inserted = insertAnchor(candidate.html, candidate.markdown, edge.anchor, edge.targetSlug);
          if (!inserted.inserted) {
            // The anchor is already present locally — just confirm the edge, no PUT needed.
            useApp.getState().patchArticle(candidate.id, { links: withEdgeState(candidate.links, edge.targetSlug, "GHOST_CONFIRMED") });
            return;
          }
          const result = await updateGhostPostHtml({
            data: {
              url: site.ghost.url,
              adminKey: site.ghost.adminKey ?? "",
              postId: candidate.ledger.postId ?? undefined,
              slug: candidate.slug,
              html: inserted.html,
              expectedUpdatedAt: candidate.ghostUpdatedAt,
            },
          });
          if (!result.ok) {
            if (result.code === "STALE_LOCAL_COPY") {
              useApp.getState().logEvent(site.id, "warn", `Re-weave skipped for “${candidate.title}”: the post was hand-edited on Ghost after publish. The edit was protected.`);
              useApp.getState().patchArticle(candidate.id, { links: withEdgeState(candidate.links, edge.targetSlug, "FAILED") });
              return;
            }
            useApp.getState().logEvent(site.id, "warn", `Re-weave failed for “${candidate.title}”: ${result.error}`);
            useApp.getState().patchArticle(candidate.id, { links: withEdgeState(candidate.links, edge.targetSlug, "FAILED") });
            return;
          }
          useApp.getState().patchArticle(candidate.id, {
            html: inserted.html,
            markdown: inserted.markdown,
            ghostUpdatedAt: result.updatedAt,
            links: withEdgeState(candidate.links, edge.targetSlug, "GHOST_CONFIRMED"),
          });
          useApp.getState().logEvent(site.id, "ok", `Re-weave applied on Ghost · “${candidate.title}” → /post/${edge.targetSlug}/ · lock ${result.updatedAt.slice(0, 19)}`);
        } finally {
          reweaveCooldown.current.set(candidate.id, Date.now() + 500);
          window.setTimeout(() => reweaveBusy.current.delete(candidate.id), 500);
        }
      })();
    }


    const timer = window.setInterval(() => {
      stateRef.current = useApp.getState();
      repairPass();
      imagePass();
      ghostPass();
      reweavePass();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active]);

  return null;
}
