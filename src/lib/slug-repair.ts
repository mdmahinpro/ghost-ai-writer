/**
 * The `-2` problem, and how a live page gets its clean address back.
 *
 * A slug is made unique by appending a number, and that number was counted
 * against **every** article the site owns — including drafts and held articles
 * that never went live. So when a draft landed on `…-rd` first, the article that
 * actually published was forced onto `…-rd-2`, and every URL on the site wore a
 * number it never should have had.
 *
 * This pass hands the clean address to the page that is live:
 *
 *   - base slug free                    → the live page takes it
 *   - base held by a draft              → swap: live page takes the base, the draft takes the number
 *   - base held by another live page    → left alone; two live pages cannot share one URL
 *
 * It is idempotent: once a base belongs to a published article there is nothing
 * left to move, so a second run is a no-op. Untouched articles keep their object
 * identity so the store sees no change where there is none.
 */
export type SlugCarrier = { id: string; siteId: string; slug: string; status: string };

export type SlugRename = { id: string; siteId: string; from: string; to: string };

/** `…-2`, `…-17`: the numeric tail that `uniqueSlug` adds on a collision. */
const NUMBERED_TAIL = /-(\d+)$/;

export function repairArticleSlugs<T extends SlugCarrier>(
  articles: T[],
): { articles: T[]; renamed: SlugRename[] } {
  const key = (siteId: string, slug: string) => `${siteId}\u0000${slug}`;
  const owner = new Map<string, T>();
  for (const article of articles) {
    if (article.slug) owner.set(key(article.siteId, article.slug), article);
  }

  const renamed: SlugRename[] = [];
  const nextSlug = new Map<string, string>();

  for (const article of articles) {
    if (article.status !== "published" || !article.slug) continue;
    const match = NUMBERED_TAIL.exec(article.slug);
    if (!match || match.index <= 0) continue;
    const base = article.slug.slice(0, match.index);
    const holder = owner.get(key(article.siteId, base));
    if (holder && holder.id !== article.id) {
      // Another live page owns the base: both are published, so the number has
      // to stay — renaming would give two pages the same address.
      if (holder.status === "published") continue;
      // The draft yields the address it was holding.
      nextSlug.set(holder.id, article.slug);
      renamed.push({ id: holder.id, siteId: holder.siteId, from: base, to: article.slug });
      owner.set(key(article.siteId, base), article);
    } else {
      owner.set(key(article.siteId, base), article);
    }
    nextSlug.set(article.id, base);
    renamed.push({ id: article.id, siteId: article.siteId, from: article.slug, to: base });
  }

  if (!nextSlug.size) return { articles, renamed: [] };
  const out = articles.map((article) => {
    const slug = nextSlug.get(article.id);
    return slug === undefined ? article : { ...article, slug };
  });
  return { articles: out, renamed };
}
