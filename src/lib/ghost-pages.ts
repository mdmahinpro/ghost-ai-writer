export const GHOST_PAGE_LIMIT = 100;
export const GHOST_MAX_PAGES = 30;

export type GhostListPost = {
  id: string;
  title: string;
  slug: string;
  status: "PUBLISHED" | "DRAFT";
};

export function ghostPostsQuery(page: number): string {
  return `/ghost/api/admin/posts/?limit=${GHOST_PAGE_LIMIT}&page=${page}&formats=plaintext&fields=id,title,slug,status`;
}

export function mapGhostPost(post: { id?: string; title?: string; slug?: string; status?: string }): GhostListPost {
  return {
    id: String(post.id ?? ""),
    title: String(post.title ?? "Untitled").slice(0, 300),
    slug: String(post.slug ?? ""),
    status: post.status === "published" ? "PUBLISHED" : "DRAFT",
  };
}

export function ghostPageCount(pages: number | undefined, max = GHOST_MAX_PAGES): number {
  const n = typeof pages === "number" && Number.isFinite(pages) ? Math.floor(pages) : 1;
  return Math.max(1, Math.min(n, max));
}

/** Walks meta.pagination.pages. Stops at max so a bad page count cannot loop forever. */
export async function collectGhostPages<T>(
  load: (page: number) => Promise<{ rows: T[]; pages: number }>,
  maxPages = GHOST_MAX_PAGES,
): Promise<{ rows: T[]; pages: number; truncated: boolean }> {
  const rows: T[] = [];
  let reported = 1;
  let page = 1;
  do {
    const batch = await load(page);
    reported = Math.max(1, Math.floor(batch.pages) || 1);
    rows.push(...batch.rows);
    page += 1;
  } while (page <= reported && page <= maxPages);
  return { rows, pages: reported, truncated: reported > maxPages };
}
