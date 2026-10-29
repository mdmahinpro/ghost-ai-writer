import { post } from "./api-client";

/**
 * Ghost reads now run on the Rust API.
 *
 * The Admin API key still travels with the request — it is a per-site setting,
 * not a model key, and it is not stored server-side. Signing the Admin JWT,
 * refusing private hosts and blocking redirects all happen in `ghost_api.rs`.
 */
type GhostCall = { data: { url: string; adminKey: string; siteRef?: string; trustCert?: boolean } };

export async function testGhostConnection(input: {
  data: { url?: string; adminKey?: string; siteRef?: string; trustCert?: boolean };
}): Promise<
  | { ok: true; version: string; origin: string; verified: boolean }
  | { ok: false; version: string; origin: string; error: string }
> {
  const res = await post<{
    ok: boolean;
    version?: string;
    origin?: string;
    verified?: boolean;
    error?: string;
  }>(
    "/api/v1/ghost/test",
    {
      url: input?.data?.url ?? "",
      admin_key: input?.data?.adminKey ?? "",
      // Which site this connection belongs to. The server wrote a verified key
      // to the first site in the account until this was sent, so connecting a
      // second site overwrote the first one's Ghost.
      site_ref: input?.data?.siteRef ?? "",
      // Accept an untrusted certificate for this origin, if the operator said so.
      trust_cert: input?.data?.trustCert ?? false,
    },
  );
  if (!res.ok) return { ok: false, version: "", origin: "", error: res.error };
  if (!res.data.ok) {
    return { ok: false, version: "", origin: "", error: res.data.error ?? "Live test failed." };
  }
  return {
    ok: true,
    version: res.data.version ?? "unknown",
    origin: res.data.origin ?? "",
    // False when the operator accepted an untrusted certificate: the connection
    // works, the host identity is unproven, and the UI has to say so.
    verified: res.data.verified !== false,
  };
}

export async function syncGhostPosts(input: GhostCall): Promise<
  | {
      ok: true;
      posts: { id: string; title: string; slug: string; status: string }[];
      pages: number;
      truncated: boolean;
    }
  | {
      ok: false;
      posts: { id: string; title: string; slug: string; status: string }[];
      pages: number;
      truncated: boolean;
      error: string;
    }
> {
  type Row = { id: string; title: string; slug: string; status: string };
  const res = await post<{
    ok: boolean;
    posts?: Row[];
    pages?: number;
    truncated?: boolean;
    error?: string;
  }>("/api/v1/ghost/sync", {
    url: input?.data?.url ?? "",
    admin_key: input?.data?.adminKey ?? "",
    site_ref: input?.data?.siteRef ?? "",
    trust_cert: input?.data?.trustCert ?? false,
  });
  if (!res.ok) {
    return { ok: false, posts: [], pages: 0, truncated: false, error: res.error };
  }
  const base = {
    posts: res.data.posts ?? [],
    pages: res.data.pages ?? 0,
    truncated: res.data.truncated ?? false,
  };
  if (!res.data.ok) {
    return { ok: false, ...base, error: res.data.error ?? "Ghost sync failed." };
  }
  return { ok: true, ...base };
}

export async function probePublicUrl(input: {
  data: { url?: string };
}): Promise<{ ok: true; detail: string } | { ok: false; detail: string; error: string }> {
  const res = await post<{ ok: boolean; detail?: string; error?: string }>("/api/v1/ghost/probe", {
    url: input?.data?.url ?? "",
  });
  if (!res.ok) return { ok: false, detail: "", error: res.error };
  if (!res.data.ok) {
    return { ok: false, detail: "", error: res.data.error ?? "Live probe failed." };
  }
  return { ok: true, detail: res.data.detail ?? "" };
}

type PublishImage = {
  src?: string;
  remote?: string;
  role: "featured" | "section";
  alt: string;
};

type PublishInput = {
  url: string;
  adminKey: string;
  title: string;
  slug: string;
  html: string;
  excerpt: string;
  /** Stage 4 SEO description (<=155). Falls back to the excerpt when absent. */
  metaDescription?: string;
  status: "draft" | "published";
  tags: string[];
  images: PublishImage[];
  /** Rule 2: attach the assigned author. Only a real Ghost id is used. */
  author?: {
    name: string;
    slug?: string;
    bio?: string;
    profileImage?: string;
    knownGhostAuthorId?: string | null;
  };
};

export type AuthorOutcome = { matched: boolean; ghostAuthorId?: string; note: string };

export type PublishResult =
  | {
      ok: true;
      reconciled: boolean;
      postId: string;
      url: string;
      html: string;
      imaged: boolean;
      author: AuthorOutcome | null;
      updatedAt: string;
    }
  | { ok: false; error: string };

/**
 * Publish one article. Ghost is asked to update when the slug already exists
 * (reconciled) and to create otherwise; a 422 is re-read by slug rather than
 * retried, so a duplicate slug never creates a second post.
 *
 * Images are uploaded into Ghost by the API (`images/upload/`), and each one is
 * swapped for the URL Ghost returns, so a published post never points at this
 * studio's `/media` path.
 */
export async function publishGhostPost(input: { data: PublishInput }): Promise<PublishResult> {
  const d = input?.data;
  if (!d) return { ok: false, error: "Nothing to publish." };
  const res = await post<PublishResult>("/api/v1/ghost/publish", {
    url: d.url ?? "",
    admin_key: d.adminKey ?? "",
    title: d.title ?? "",
    slug: d.slug ?? "",
    html: d.html ?? "",
    excerpt: d.excerpt ?? "",
    meta_description: d.metaDescription ?? null,
    status: d.status === "published" ? "published" : "draft",
    tags: (d.tags ?? []).map((tag) => String(tag).slice(0, 40)).slice(0, 5),
    images: (d.images ?? []).slice(0, 6).map((image) => ({
      src: image?.src,
      remote: image?.remote,
      role: image?.role === "section" ? "section" : "featured",
      alt: String(image?.alt ?? "").slice(0, 180),
    })),
    author:
      d.author && typeof d.author.name === "string"
        ? {
            name: d.author.name.slice(0, 120),
            slug: d.author.slug,
            bio: d.author.bio,
            profile_image: d.author.profileImage,
            known_ghost_author_id: d.author.knownGhostAuthorId,
          }
        : null,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

type ReWeaveInput = {
  url: string;
  adminKey: string;
  postId?: string;
  slug?: string;
  html: string;
  /** Optimistic lock: the updated_at we last confirmed. */
  expectedUpdatedAt?: string;
  /** Operator explicitly overrides the hand-edit guard. */
  acknowledgeHandEdited?: boolean;
};

export type ReweaveResult =
  | { ok: true; code: "OK"; postId: string; url: string; updatedAt: string }
  | { ok: false; code: string; error: string; postId?: string; remoteUpdatedAt?: string };

/**
 * Rule 6 — PUT-only re-weave. Never creates: the API reads Ghost's current
 * `updated_at`, refuses a post that changed since our last publish unless the
 * operator acknowledged the edit, then PUTs with the lock it just read.
 */
export async function updateGhostPostHtml(input: { data: ReWeaveInput }): Promise<ReweaveResult> {
  const d = input?.data;
  if (!d) return { ok: false, code: "ERROR", error: "Nothing to re-weave." };
  const res = await post<ReweaveResult>("/api/v1/ghost/reweave", {
    url: d.url ?? "",
    admin_key: d.adminKey ?? "",
    post_id: d.postId,
    slug: d.slug,
    html: d.html ?? "",
    expected_updated_at: d.expectedUpdatedAt,
    acknowledge_hand_edited: Boolean(d.acknowledgeHandEdited),
  });
  if (!res.ok) return { ok: false, code: "ERROR", error: res.error };
  return res.data;
}
