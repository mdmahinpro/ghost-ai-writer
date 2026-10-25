/**
 * Layout and 3D projection for the internal-link field on the analytics page.
 *
 * Pure maths: no DOM, no dependencies, no React. The canvas component is a
 * renderer over these functions, which is what makes the geometry testable.
 *
 * The field is a sphere: every article sits on its surface, so the graph can be
 * turned and read from any angle instead of collapsing into a flat ring where
 * edges overlap. Positions come from a Fibonacci lattice, so the arrangement is
 * even and — with a seed derived from the slugs — stable between renders.
 */

export type FieldLink = { targetSlug: string; state?: string };

export type FieldArticle = {
  id: string;
  title: string;
  slug: string;
  links: FieldLink[];
};

export type Vec3 = { x: number; y: number; z: number };

export type FieldNode = {
  id: string;
  title: string;
  slug: string;
  pos: Vec3;
  /** Distinct articles this one links out to, inside the field. */
  out: number;
  /** Distinct articles that link here, counted the way the page counts. */
  inbound: number;
  /** No other article links here, so nothing feeds it authority. */
  orphan: boolean;
  /** Two or more inbound links — a page the graph already treats as a hub. */
  hub: boolean;
};

export type FieldEdge = { from: number; to: number };

export type Field = {
  nodes: FieldNode[];
  edges: FieldEdge[];
  orphans: FieldNode[];
  /** Articles that exist on the site. */
  total: number;
  /** Articles drawn, which is `total` unless the cap was hit. */
  shown: number;
};

export type View = { yaw: number; pitch: number; zoom: number; camDist?: number };

export type Projected = { x: number; y: number; depth: number; scale: number };

/** Enough to read the shape of a site without turning into hairball soup. */
export const FIELD_CAP = 30;

/** A gentle three-quarter view, which is the angle a flat graph never gets. */
export const DEFAULT_VIEW: View = { yaw: 0.42, pitch: -0.3, zoom: 1 };

/** Where the camera sits on the z axis, in sphere radii. */
const CAM_DIST = 3.4;

/** Sphere radius as a fraction of the smaller canvas side. */
const RADIUS_FRACTION = 0.34;

/** Stable number for a slug, so a node keeps its place between renders. */
export function hashSlug(slug: string): number {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/** Evenly spaced points on the unit sphere (Fibonacci lattice), seed-offset. */
export function spherePoint(index: number, count: number, seed: number): Vec3 {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = Math.max(count, 1);
  // Shift the whole lattice by the seed so two sites do not look identical.
  const i = index + 0.5 + (seed - 0.5) * 0.9;
  const y = 1 - (2 * i) / n;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return { x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring };
}

/**
 * Build the field: which articles are on screen, where they sit, and which
 * links are real edges between them.
 *
 * Links are de-duplicated per article, self-links and links to articles that do
 * not exist are dropped, and the busiest pages are kept when the cap is hit so
 * a large site still shows its shape.
 */
export function buildField(articles: FieldArticle[], cap: number = FIELD_CAP): Field {
  const known = new Set(articles.map((article) => article.slug));
  const inboundOf = new Map<string, number>();
  for (const article of articles) {
    for (const slug of new Set(article.links.map((link) => link.targetSlug))) {
      if (slug === article.slug || !known.has(slug)) continue;
      inboundOf.set(slug, (inboundOf.get(slug) ?? 0) + 1);
    }
  }

  const ranked = [...articles].sort((a, b) => {
    const byInbound = (inboundOf.get(b.slug) ?? 0) - (inboundOf.get(a.slug) ?? 0);
    if (byInbound !== 0) return byInbound;
    const byOutbound = b.links.length - a.links.length;
    if (byOutbound !== 0) return byOutbound;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  const kept = ranked.slice(0, Math.max(1, cap));
  const index = new Map(kept.map((article, i) => [article.slug, i]));
  const seed = hashSlug(kept.map((article) => article.slug).join("|"));

  const nodes: FieldNode[] = kept.map((article, i) => {
    const targets = [...new Set(article.links.map((link) => link.targetSlug))].filter(
      (slug) => slug !== article.slug && index.has(slug),
    );
    const inbound = inboundOf.get(article.slug) ?? 0;
    return {
      id: article.id,
      title: article.title || article.slug,
      slug: article.slug,
      pos: spherePoint(i, kept.length, seed),
      out: targets.length,
      inbound,
      // Same rule the orphan callout on the page uses.
      orphan: inbound === 0 && kept.length > 1,
      hub: inbound >= 2,
    };
  });

  const edges: FieldEdge[] = [];
  const seen = new Set<string>();
  kept.forEach((article, i) => {
    for (const slug of new Set(article.links.map((link) => link.targetSlug))) {
      const to = index.get(slug);
      if (to === undefined || to === i) continue;
      const key = `${i}>${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: i, to });
    }
  });

  return {
    nodes,
    edges,
    orphans: nodes.filter((node) => node.orphan),
    total: articles.length,
    shown: nodes.length,
  };
}

/** Rotate a point: yaw around y, then pitch around x. */
export function rotate(point: Vec3, yaw: number, pitch: number): Vec3 {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const x = point.x * cosYaw - point.z * sinYaw;
  const z = point.x * sinYaw + point.z * cosYaw;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  return {
    x,
    y: point.y * cosPitch - z * sinPitch,
    z: point.y * sinPitch + z * cosPitch,
  };
}

/**
 * Project a sphere point onto the canvas with perspective.
 *
 * `depth` is 0 at the far side and 1 at the near side, and `scale` grows with
 * depth — that is the whole trick: nodes further from the camera read smaller
 * and dimmer, which is what gives the angle away.
 */
export function projectPoint(point: Vec3, width: number, height: number, view: View): Projected {
  const turned = rotate(point, view.yaw, view.pitch);
  const camDist = view.camDist ?? CAM_DIST;
  const scale = camDist / Math.max(0.25, camDist - turned.z);
  const radius = Math.min(width, height) * RADIUS_FRACTION * view.zoom;
  return {
    x: width / 2 + turned.x * radius * scale,
    y: height / 2 + turned.y * radius * scale,
    depth: (turned.z + 1) / 2,
    scale,
  };
}

/** Keep a dragged view inside sensible limits. */
export function clampView(view: View): View {
  return {
    yaw: view.yaw,
    pitch: Math.max(-1.25, Math.min(1.25, view.pitch)),
    zoom: Math.max(0.55, Math.min(2.4, view.zoom)),
  };
}

/** Turn a drag, in pixels, into a rotation. */
export function orbit(view: View, dx: number, dy: number): View {
  return clampView({
    ...view,
    yaw: view.yaw + dx * 0.0075,
    pitch: view.pitch + dy * 0.005,
  });
}

/** Zoom by a wheel or pinch delta. */
export function zoomBy(view: View, factor: number): View {
  return clampView({ ...view, zoom: view.zoom * factor });
}
