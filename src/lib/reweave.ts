/**
 * Rule 6 — PUT-only re-weave decision core.
 * Kept pure so the optimistic-lock behaviour and LinkEdge transitions are
 * verifiable without a live Ghost instance.
 */
import type { ArticleLink } from "./types.ts";

export type ReweaveDecision = "proceed" | "skip-stale";

/**
 * Ghost requires the `updated_at` it currently holds. When our local copy was
 * confirmed at a different revision, the post was edited outside the studio —
 * skip unless the operator acknowledges, so a hand edit is never clobbered.
 */
export function reweaveDecision(input: { remoteUpdatedAt: string; expectedUpdatedAt?: string; acknowledgeHandEdited?: boolean }): ReweaveDecision {
  if (!input.expectedUpdatedAt || !input.remoteUpdatedAt) return "proceed";
  if (input.expectedUpdatedAt === input.remoteUpdatedAt) return "proceed";
  return input.acknowledgeHandEdited ? "proceed" : "skip-stale";
}

/** The exact PUT body Ghost expects (source=html): html + the lock it just returned. */
export function reweavePutBody(html: string, remoteUpdatedAt: string): { posts: { html: string; updated_at?: string }[] } {
  return { posts: [{ html, ...(remoteUpdatedAt ? { updated_at: remoteUpdatedAt } : {}) }] };
}

export type LinkState = ArticleLink["state"];

/** Transition one edge to a new state without touching the others. */
export function withEdgeState(links: ArticleLink[], targetSlug: string, state: LinkState): ArticleLink[] {
  return links.map((link) => (link.targetSlug === targetSlug ? { ...link, state } : link));
}
