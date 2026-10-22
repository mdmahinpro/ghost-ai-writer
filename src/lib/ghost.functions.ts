import { createServerFn } from "@tanstack/react-start";
import { reweaveDecision, reweavePutBody } from "./reweave";
import { isPrivateHost, validateGhostUrl, validatePublicUrl } from "./engine";
import { collectGhostPages, ghostPostsQuery, mapGhostPost } from "./ghost-pages";
import { isFakeCmsImage, sanitizeCmsImage } from "./image-urls";

type GhostInput = { url: string; adminKey: string };

function readInput(input: unknown): GhostInput {
  const o = input as Partial<GhostInput> | null;
  const url = typeof o?.url === "string" ? o.url : "";
  const adminKey = typeof o?.adminKey === "string" ? o.adminKey : "";
  if (!url || !adminKey) throw new Error("Ghost URL and Admin API key are required.");
  if (!/^[a-f0-9]{8,64}:[a-f0-9]{16,128}$/i.test(adminKey.trim())) {
    throw new Error("Admin API key must look like id:secret, hex only. It is not stored.");
  }
  return { url, adminKey: adminKey.trim() };
}

function safeMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : "Ghost request failed.";
  if (/secret|adminKey|jwt|authorization/i.test(msg)) return "Ghost refused the Admin API key.";
  return msg.slice(0, 180);
}

async function assertPublicDns(hostname: string) {
  const dns = await import("node:dns/promises");
  let records: { address: string }[] = [];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Could not resolve that host.");
  }
  for (const record of records) {
    if (isBlockedAddress(record.address)) throw new Error("That host resolves to a private address. Blocked.");
  }
}

function isBlockedAddress(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) return isPrivateHost(lower.slice(7));
  return isPrivateHost(lower);
}

async function ghostToken(adminKey: string): Promise<string> {
  const jose = await import("jose");
  const [id, secret] = adminKey.split(":");
  if (!id || !secret) throw new Error("Admin API key must look like id:secret.");
  const bytes = new Uint8Array(secret.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(secret.slice(i * 2, i * 2 + 2), 16);
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256", kid: id })
    .setAudience("/admin/")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(bytes);
}

async function ghostFetch(origin: string, path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Ghost ${token}`, Accept: "application/json", ...(init.headers ?? {}) },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Redirects are blocked. Use the canonical https origin.");
  }
  return response;
}

export const testGhostConnection = createServerFn({ method: "POST" })
  .validator(readInput)
  .handler(async ({ data }) => {
    try {
      const checked = validateGhostUrl(data.url);
      if (!checked.ok) return { ok: false as const, error: checked.error };
      const origin = checked.url;
      await assertPublicDns(new URL(origin).hostname);
      const token = await ghostToken(data.adminKey);
      const response = await ghostFetch(origin, "/ghost/api/admin/site/", token);
      if (response.status === 401 || response.status === 403) return { ok: false as const, error: "Ghost refused the Admin API key." };
      if (!response.ok) return { ok: false as const, error: `Ghost returned HTTP ${response.status}.` };
      const body = (await response.json()) as { site?: { version?: string } };
      return { ok: true as const, version: body.site?.version || "unknown", origin };
    } catch (error) {
      return { ok: false as const, error: safeMessage(error) };
    }
  });

export const syncGhostPosts = createServerFn({ method: "POST" })
  .validator(readInput)
  .handler(async ({ data }) => {
    try {
      const checked = validateGhostUrl(data.url);
      if (!checked.ok) return { ok: false as const, error: checked.error };
      await assertPublicDns(new URL(checked.url).hostname);
      const token = await ghostToken(data.adminKey);
      const collected = await collectGhostPages(async (page) => {
        const response = await ghostFetch(checked.url, ghostPostsQuery(page), token);
        if (response.status === 401 || response.status === 403) throw new Error("Ghost refused the Admin API key.");
        if (!response.ok) throw new Error(`Ghost returned HTTP ${response.status}.`);
        const body = (await response.json()) as {
          posts?: { id?: string; title?: string; slug?: string; status?: string }[];
          meta?: { pagination?: { pages?: number } };
        };
        return {
          rows: (body.posts ?? []).map(mapGhostPost).filter((post) => post.id && post.slug),
          pages: typeof body.meta?.pagination?.pages === "number" ? body.meta.pagination.pages : 1,
        };
      });
      return { ok: true as const, posts: collected.rows, pages: collected.pages, truncated: collected.truncated };
    } catch (error) {
      return { ok: false as const, error: safeMessage(error) };
    }
  });

export const probePublicUrl = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const url = typeof (input as { url?: string } | null)?.url === "string" ? (input as { url: string }).url : "";
    if (!url) throw new Error("Public URL is required.");
    return { url };
  })
  .handler(async ({ data }) => {
    try {
      const checked = validatePublicUrl(data.url);
      if (!checked.ok) return { ok: false as const, error: checked.error };
      await assertPublicDns(new URL(checked.url).hostname);
      const response = await fetch(checked.url, { redirect: "manual", signal: AbortSignal.timeout(8000) });
      if (response.status >= 300 && response.status < 400) {
        return { ok: false as const, error: `Probe blocked a redirect (${response.status}).` };
      }
      if (response.status >= 200 && response.status < 300) {
        return { ok: true as const, detail: `Live probe ${response.status} · ${checked.url}` };
      }
      return { ok: false as const, error: `Live probe HTTP ${response.status} · ${checked.url}` };
    } catch (error) {
      return { ok: false as const, error: safeMessage(error) };
    }
  });

type PublishInput = {
  url: string;
  adminKey: string;
  title: string;
  slug: string;
  html: string;
  excerpt: string;
  /** Stage 4 SEO description (≤155). Falls back to the excerpt when absent. */
  metaDescription?: string;
  status: "draft" | "published";
  tags: string[];
  images: { src?: string; remote?: string; role: "featured" | "section"; alt: string }[];
  /** Rule 2: attach the assigned author. Only a real Ghost id is used — never invented. */
  author?: {
    name: string;
    slug?: string;
    bio?: string;
    profileImage?: string;
    knownGhostAuthorId?: string | null;
  };
};

function readPublish(input: unknown): PublishInput {
  const raw = input as Partial<PublishInput> | null;
  const base = readInput(raw);
  const slug = String(raw?.slug ?? "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
  if (!slug) throw new Error("A slug is required.");
  const images = Array.isArray(raw?.images) ? raw.images.slice(0, 6) : [];
  const rawAuthor = (raw as { author?: Partial<PublishInput["author"]> | null } | null)?.author;
  return {
    ...base,
    author: rawAuthor && typeof rawAuthor.name === "string"
      ? {
          name: String(rawAuthor.name).slice(0, 120),
          slug: typeof rawAuthor.slug === "string" ? rawAuthor.slug.slice(0, 120) : undefined,
          bio: typeof rawAuthor.bio === "string" ? rawAuthor.bio.slice(0, 400) : undefined,
          profileImage: typeof rawAuthor.profileImage === "string" && /^https:\/\//i.test(rawAuthor.profileImage) ? rawAuthor.profileImage : undefined,
          knownGhostAuthorId: typeof rawAuthor.knownGhostAuthorId === "string" ? rawAuthor.knownGhostAuthorId : undefined,
        }
      : undefined,
    ...base,
    title: String(raw?.title ?? "Untitled").slice(0, 200),
    slug,
    html: String(raw?.html ?? "").slice(0, 200_000),
    excerpt: String(raw?.excerpt ?? "").slice(0, 300),
    metaDescription: typeof raw?.metaDescription === "string" && raw.metaDescription.trim() ? raw.metaDescription.trim().slice(0, 155) : undefined,
    status: raw?.status === "published" ? "published" : "draft",
    tags: (Array.isArray(raw?.tags) ? raw.tags : []).map((tag) => String(tag).slice(0, 40)).slice(0, 5),
    images: images.map((image) => {
      // A placeholder CMS path must never reach Ghost (it would be served back
      // as /content/images/...): drop a fake local src and convert a fake remote
      // to a real Bing thumbnail from the alt text.
      const src = typeof image?.src === "string" && !isFakeCmsImage(image.src) ? image.src : undefined;
      const rawRemote = typeof image?.remote === "string" ? image.remote : undefined;
      const remote = rawRemote ? sanitizeCmsImage(rawRemote, String(image?.alt ?? "")) : undefined;
      return {
        src,
        remote,
        role: image?.role === "section" ? "section" as const : "featured" as const,
        alt: String(image?.alt ?? "").slice(0, 180),
      };
    }),
  };
}

export const publishGhostPost = createServerFn({ method: "POST" })
  .validator(readPublish)
  .handler(async ({ data }) => {
    try {
      const checked = validateGhostUrl(data.url);
      if (!checked.ok) return { ok: false as const, error: checked.error };
      await assertPublicDns(new URL(checked.url).hostname);
      const token = await ghostToken(data.adminKey);
      const existing = await ghostFetch(checked.url, `/ghost/api/admin/posts/slug/${encodeURIComponent(data.slug)}/`, token);
      let postId = "";
      let updatedAt = "";
      let existingUrl = "";
      if (existing.ok) {
        const body = (await existing.json()) as { posts?: { id?: string; url?: string; updated_at?: string }[] };
        const post = body.posts?.[0];
        postId = post?.id ? String(post.id) : "";
        updatedAt = post?.updated_at ?? "";
        existingUrl = post?.url ?? "";
      }
      let html = data.html;
      let feature = "";
      let featureAlt = "";
      const { readMediaFile } = await import("./image-fetch");
      for (const image of data.images) {
        const name = image.src?.split("/").pop() ?? "";
        const file = await readMediaFile(name, image.remote);
        if (!file) continue;
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), file.name);
        const uploaded = await fetch(`${checked.url}/ghost/api/admin/images/upload/`, {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.timeout(12000),
          headers: { Authorization: `Ghost ${token}` },
          body: form,
        });
        if (uploaded.status >= 300 && uploaded.status < 400) throw new Error("Redirects are blocked. Use the canonical https origin.");
        if (!uploaded.ok) continue;
        const payload = (await uploaded.json()) as { images?: { url?: string }[] };
        const remote = payload.images?.[0]?.url;
        if (!remote) continue;
        if (image.src && html.includes(image.src)) html = html.split(image.src).join(remote);
        else html = `<figure class="kg-card kg-image-card"><img src="${remote}" alt="${image.alt.replace(/"/g, "")}" /></figure>\n${html}`;
        if (image.role === "featured" && !feature) {
          feature = remote;
          featureAlt = image.alt;
        }
      }
      const postBody: Record<string, unknown> = {
        title: data.title,
        slug: data.slug,
        html,
        custom_excerpt: data.excerpt,
        meta_description: data.metaDescription || data.excerpt,
        status: data.status,
        feature_image: feature || undefined,
        feature_image_alt: featureAlt || undefined,
        tags: data.tags.filter(Boolean).map((name) => ({ name })),
      };
      // Rule 2: attach the assigned author. Only a verified real Ghost author id is
      // used; creation is never attempted, and a failed resolve keeps Ghost's
      // default byline while the article HTML keeps the byline + Person JSON-LD.
      let authorResult: { matched: boolean; ghostAuthorId?: string; note: string } | undefined;
      if (data.author) {
        const wanted = data.author;
        let resolved = "";
        let note = "";
        if (wanted.knownGhostAuthorId && /^[0-9a-fA-F]{24}$/.test(wanted.knownGhostAuthorId)) {
          const known = await ghostFetch(checked.url, `/ghost/api/admin/authors/${wanted.knownGhostAuthorId}/`, token);
          if (known.ok) {
            resolved = wanted.knownGhostAuthorId;
            note = "Existing Ghost author id verified and attached.";
          } else {
            note = `Stored Ghost author id did not resolve (HTTP ${known.status}). Ghost default byline kept; article byline + Person JSON-LD preserved.`;
          }
        } else {
          const query = wanted.slug
            ? `/ghost/api/admin/authors/slug/${encodeURIComponent(wanted.slug)}/`
            : `/ghost/api/admin/authors/?filter=${encodeURIComponent(`name:['${wanted.name.replace(/'/g, "\\'")}']`)}&limit=1`;
          const found = await ghostFetch(checked.url, query, token);
          if (found.ok) {
            const body = (await found.json()) as { authors?: { id?: string; slug?: string }[]; id?: string };
            const hit = body.authors?.[0] ?? (body.id ? { id: body.id } : undefined);
            if (hit?.id) {
              resolved = String(hit.id);
              note = "Matched an existing Ghost author by slug/name and attached it.";
            } else {
              note = "No matching Ghost author; Admin-key role does not permit author creation. Ghost default byline kept; article byline + Person JSON-LD preserved.";
            }
          } else {
            note = `Ghost author lookup failed (HTTP ${found.status}). Ghost default byline kept; article byline + Person JSON-LD preserved.`;
          }
        }
        if (resolved) postBody.authors = [{ id: resolved }];
        authorResult = { matched: Boolean(resolved), ghostAuthorId: resolved || undefined, note };
      }
      if (postId) {
        const updated = await fetch(`${checked.url}/ghost/api/admin/posts/${postId}/?source=html`, {
          method: "PUT",
          redirect: "manual",
          signal: AbortSignal.timeout(12000),
          headers: { Authorization: `Ghost ${token}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ posts: [{ ...postBody, updated_at: updatedAt }] }),
        });
        if (updated.ok) {
          const body = (await updated.json()) as { posts?: { id?: string; url?: string; updated_at?: string }[] };
          const post = body.posts?.[0];
          return { ok: true as const, reconciled: true, postId, url: post?.url ?? existingUrl, html, imaged: Boolean(feature), author: authorResult, updatedAt: post?.updated_at ?? "" };
        }
      }
      const created = await fetch(`${checked.url}/ghost/api/admin/posts/?source=html`, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Ghost ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ posts: [postBody] }),
      });
      if (created.status >= 300 && created.status < 400) throw new Error("Redirects are blocked. Use the canonical https origin.");
      if (created.status === 422) {
        const again = await ghostFetch(checked.url, `/ghost/api/admin/posts/slug/${encodeURIComponent(data.slug)}/`, token);
        if (again.ok) {
          const body = (await again.json()) as { posts?: { id?: string; url?: string; updated_at?: string }[] };
          const post = body.posts?.[0];
            if (post?.id) return { ok: true as const, reconciled: true, postId: String(post.id), url: post.url ?? "", html, imaged: Boolean(feature), author: authorResult, updatedAt: post.updated_at ?? "" };
        }
        return { ok: false as const, error: "Ghost rejected the post. The slug may already exist, and it was not created again." };
      }
      if (created.status === 401 || created.status === 403) return { ok: false as const, error: "Ghost refused the Admin API key." };
      if (!created.ok) return { ok: false as const, error: `Ghost returned HTTP ${created.status}.` };
      const body = (await created.json()) as { posts?: { id?: string; url?: string; updated_at?: string }[] };
      const post = body.posts?.[0];
      if (!post?.id) return { ok: false as const, error: "Ghost did not return a post id." };
      return { ok: true as const, reconciled: false, postId: String(post.id), url: post.url ?? "", html, imaged: Boolean(feature), author: authorResult, updatedAt: post.updated_at ?? "" };
    } catch (error) {
      return { ok: false as const, error: safeMessage(error) };
    }
  });

type ReWeaveInput = {
  url: string;
  adminKey: string;
  postId?: string;
  slug?: string;
  html: string;
  /** Optimistic lock: the updated_at we last confirmed. A mismatch means the post was hand-edited since. */
  expectedUpdatedAt?: string;
  /** Operator explicitly overrides the hand-edit guard. */
  acknowledgeHandEdited?: boolean;
};

function readReWeave(input: unknown): ReWeaveInput {
  const raw = input as Partial<ReWeaveInput> | null;
  const base = readInput(raw);
  const html = typeof raw?.html === "string" ? raw.html.slice(0, 400_000) : "";
  if (!html.trim()) throw new Error("Post HTML is required for a re-weave.");
  const postId = typeof raw?.postId === "string" && raw.postId.trim() ? raw.postId.trim().slice(0, 64) : undefined;
  const slug = typeof raw?.slug === "string" && raw.slug.trim() ? raw.slug.trim().replace(/[^a-z0-9-]/gi, "").slice(0, 80) : undefined;
  if (!postId && !slug) throw new Error("A post id or slug is required.");
  return {
    ...base,
    postId,
    slug,
    html,
    expectedUpdatedAt: typeof raw?.expectedUpdatedAt === "string" ? raw.expectedUpdatedAt : undefined,
    acknowledgeHandEdited: Boolean(raw?.acknowledgeHandEdited),
  };
}

/**
 * Rule 6 — PUT-only re-weave. Reads Ghost's current updated_at, refuses to touch
 * a post that changed since our last publish (unless acknowledged), then PUTs the
 * new HTML with the lock it just read. Ghost is never asked to create anything.
 */
export const updateGhostPostHtml = createServerFn({ method: "POST" })
  .validator(readReWeave)
  .handler(async ({ data }) => {
    try {
      const checked = validateGhostUrl(data.url);
      if (!checked.ok) return { ok: false as const, code: "BAD_URL" as const, error: checked.error };
      await assertPublicDns(new URL(checked.url).hostname);
      const token = await ghostToken(data.adminKey);
      const query = data.postId
        ? `/ghost/api/admin/posts/${encodeURIComponent(data.postId)}/?formats=html`
        : `/ghost/api/admin/posts/slug/${encodeURIComponent(data.slug!)}/?formats=html`;
      const current = await ghostFetch(checked.url, query, token);
      if (current.status === 401 || current.status === 403) return { ok: false as const, code: "FORBIDDEN" as const, error: "Ghost refused the Admin API key." };
      if (current.status === 404) return { ok: false as const, code: "NOT_FOUND" as const, error: "That post is not on Ghost. Re-weave skipped." };
      if (!current.ok) return { ok: false as const, code: "HTTP" as const, error: `Ghost returned HTTP ${current.status}.` };
      const body = (await current.json()) as { posts?: { id?: string; url?: string; html?: string; updated_at?: string }[] };
      const post = body.posts?.[0];
      if (!post?.id) return { ok: false as const, code: "NO_POST" as const, error: "Ghost did not return the post." };
      const remoteUpdatedAt = post.updated_at ?? "";
      // Hand-edit guard: our local copy is stale, so the write is skipped (never clobbered).
      const decision = reweaveDecision({ remoteUpdatedAt, expectedUpdatedAt: data.expectedUpdatedAt, acknowledgeHandEdited: data.acknowledgeHandEdited });
      if (decision === "skip-stale") {
        return {
          ok: false as const,
          code: "STALE_LOCAL_COPY" as const,
          error: "The post changed on Ghost since we published it (hand-edited). Re-weave skipped to protect the edit.",
          postId: String(post.id),
          remoteUpdatedAt,
        };
      }
      const updated = await ghostFetch(checked.url, `/ghost/api/admin/posts/${encodeURIComponent(post.id)}/?source=html`, token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reweavePutBody(data.html, remoteUpdatedAt)),
      });
      if (updated.status === 401 || updated.status === 403) return { ok: false as const, code: "FORBIDDEN" as const, error: "Ghost refused the Admin API key." };
      if (updated.status === 422) {
        return { ok: false as const, code: "LOCK_CONFLICT" as const, error: "Ghost rejected the update (optimistic-lock conflict or invalid HTML). Nothing was written." };
      }
      if (!updated.ok) return { ok: false as const, code: "HTTP" as const, error: `Ghost returned HTTP ${updated.status}.` };
      const written = (await updated.json()) as { posts?: { id?: string; url?: string; updated_at?: string }[] };
      const saved = written.posts?.[0];
      return {
        ok: true as const,
        code: "OK" as const,
        postId: String(saved?.id ?? post.id),
        url: saved?.url ?? post.url ?? "",
        updatedAt: saved?.updated_at ?? remoteUpdatedAt,
      };
    } catch (error) {
      return { ok: false as const, code: "ERROR" as const, error: safeMessage(error) };
    }
  });
