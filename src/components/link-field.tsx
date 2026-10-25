import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  DEFAULT_VIEW,
  buildField,
  orbit,
  projectPoint,
  zoomBy,
  type FieldArticle,
  type View,
} from "@/lib/link-field";

/**
 * The internal-link field: every article on the sphere, every internal link an
 * arrow across it, drawn with perspective so the shape can be read from an
 * angle instead of guessed from a flat ring.
 *
 * The canvas is painted from `@/lib/link-field`, which holds the geometry and
 * is unit-tested; this file is the renderer, the input handling and the
 * explanation beside it.
 */

type Tokens = {
  brass: string;
  brass2: string;
  faint: string;
  line: string;
  fg: string;
  muted: string;
  danger: string;
  ink: string;
  elev: string;
  font: string;
};

const FALLBACK: Omit<Tokens, "font"> = {
  brass: "#78c0ab",
  brass2: "#8fd3bf",
  faint: "#8b938c",
  line: "#2c332f",
  fg: "#e6f0ea",
  muted: "#a7aea7",
  danger: "#e9948c",
  ink: "#08110d",
  elev: "#1b1f1d",
};

/** Colours come from the same CSS tokens as the rest of the page, so the field
 * follows both themes instead of hard-coding one palette. */
function readTokens(el: HTMLElement): Tokens {
  const style = getComputedStyle(el);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    brass: get("--color-brass", FALLBACK.brass),
    brass2: get("--color-brass-2", FALLBACK.brass2),
    faint: get("--color-faint", FALLBACK.faint),
    line: get("--color-line", FALLBACK.line),
    fg: get("--color-fg", FALLBACK.fg),
    muted: get("--color-muted", FALLBACK.muted),
    danger: get("--color-danger", FALLBACK.danger),
    ink: get("--color-ink", FALLBACK.ink),
    elev: get("--color-elev", FALLBACK.elev),
    font: style.fontFamily || "system-ui, sans-serif",
  };
}

type Hit = { index: number; x: number; y: number; r: number };

function truncate(text: string, limit: number) {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export function LinkField({ articles }: { articles: FieldArticle[] }) {
  const field = useMemo(() => buildField(articles), [articles]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [theme, setTheme] = useState(0);

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const view = useRef<View>({ ...DEFAULT_VIEW });
  const tokens = useRef<Tokens | null>(null);
  const hits = useRef<Hit[]>([]);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const phase = useRef(0);
  const intro = useRef(0);
  const focus = useRef<string | null>(null);
  const pointer = useRef<string | null>(null);

  focus.current = selected ?? hover;

  // Respect a reduced-motion preference: the field stays readable, it just
  // stops moving on its own.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // A theme switch repaints the canvas with the new tokens.
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme((n) => n + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  const nodeAt = useCallback((x: number, y: number) => {
    let best: Hit | null = null;
    for (const hit of hits.current) {
      const distance = Math.hypot(hit.x - x, hit.y - y);
      if (distance <= hit.r + 10 && (!best || distance < Math.hypot(best.x - x, best.y - y))) best = hit;
    }
    return best;
  }, []);

  const draw = useCallback(
    (width: number, height: number) => {
      const el = canvas.current;
      const context = el?.getContext("2d");
      if (!el || !context) return;
      const host = wrap.current ?? el;
      if (!tokens.current) tokens.current = readTokens(host);
      const paint = tokens.current;

      context.clearRect(0, 0, width, height);

      const scaleFactor = window.devicePixelRatio || 1;
      context.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);

      const projected = field.nodes.map((node, index) => ({
        index,
        ...projectPoint(node.pos, width, height, view.current),
      }));
      hits.current = projected.map((p, index) => {
        const radius = (3 + Math.min(field.nodes[index].inbound, 5) * 1.3) * p.scale;
        return { index, x: p.x, y: p.y, r: radius + 3 };
      });

      const active = focus.current;
      const connected = new Set<number>();
      if (active) {
        field.nodes.forEach((node, index) => {
          if (node.slug === active) connected.add(index);
        });
        for (const edge of field.edges) {
          if (field.nodes[edge.from].slug === active) connected.add(edge.to);
          if (field.nodes[edge.to].slug === active) connected.add(edge.from);
        }
      }
      const fade = (index: number) => (active && !connected.has(index) ? 0.14 : 1);

      // --- edges, drawn back to front so depth reads correctly ---
      const ordered = [...projected].sort((a, b) => a.depth - b.depth);
      const depthOf = new Map(projected.map((p) => [p.index, p]));
      const edgeOrder = [...field.edges].sort((a, b) => {
        const da = (depthOf.get(a.from)?.depth ?? 0) + (depthOf.get(a.to)?.depth ?? 0);
        const db = (depthOf.get(b.from)?.depth ?? 0) + (depthOf.get(b.to)?.depth ?? 0);
        return da - db;
      });

      context.lineCap = "round";
      for (const edge of edgeOrder) {
        const from = depthOf.get(edge.from);
        const to = depthOf.get(edge.to);
        if (!from || !to) continue;
        const touched =
          active !== null &&
          (field.nodes[edge.from].slug === active || field.nodes[edge.to].slug === active);
        const depth = (from.depth + to.depth) / 2;
        // The floor keeps far links legible on the light theme without losing
        // the depth cue: near edges are still clearly brighter.
        const alpha = (0.2 + depth * 0.42) * (active && !touched ? 0.25 : 1) * intro.current;

        context.strokeStyle = touched ? paint.brass2 : paint.brass;
        context.globalAlpha = touched ? Math.min(1, alpha + 0.35) : alpha;
        context.lineWidth = (touched ? 1.5 : 0.9) * ((from.scale + to.scale) / 2) * 0.9;

        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();

        // Arrowhead, so direction is visible without hovering.
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const size = (touched ? 7 : 5.5) * ((from.scale + to.scale) / 2);
        const tipX = from.x + (to.x - from.x) * 0.82;
        const tipY = from.y + (to.y - from.y) * 0.82;
        context.globalAlpha = context.globalAlpha * 1.15;
        context.fillStyle = touched ? paint.brass2 : paint.brass;
        context.beginPath();
        context.moveTo(tipX, tipY);
        context.lineTo(
          tipX - Math.cos(angle - 0.4) * size,
          tipY - Math.sin(angle - 0.4) * size,
        );
        context.lineTo(
          tipX - Math.cos(angle + 0.4) * size,
          tipY - Math.sin(angle + 0.4) * size,
        );
        context.closePath();
        context.fill();

        // A pulse travelling from source to target: the animation that shows
        // which way the link points.
        if (!reduced && (field.edges.length <= 90 || touched)) {
          const t = (phase.current + edge.from * 0.11 + edge.to * 0.07) % 1;
          const px = from.x + (to.x - from.x) * t;
          const py = from.y + (to.y - from.y) * t;
          context.globalAlpha = (touched ? 0.95 : 0.5) * (0.35 + depth * 0.65) * intro.current;
          context.fillStyle = touched ? paint.brass2 : paint.brass;
          context.beginPath();
          context.arc(px, py, (touched ? 2.4 : 1.7) * ((from.scale + to.scale) / 2), 0, Math.PI * 2);
          context.fill();
        }
      }

      // --- nodes, back to front ---
      for (const point of ordered) {
        const node = field.nodes[point.index];
        const radius = (3 + Math.min(node.inbound, 5) * 1.3) * point.scale;
        const dim = fade(point.index);
        const isFocus = active === node.slug;

        context.globalAlpha = (0.3 + point.depth * 0.7) * dim * intro.current;

        if (node.hub && !node.orphan) {
          context.globalAlpha *= 0.5;
          context.fillStyle = paint.brass;
          context.beginPath();
          context.arc(point.x, point.y, radius * 2.4, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = (0.3 + point.depth * 0.7) * dim * intro.current;
        }

        context.fillStyle = node.orphan ? paint.faint : isFocus ? paint.brass2 : paint.brass;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();

        if (node.orphan) {
          // Hollow, so "nothing links here" is visible without the legend.
          context.strokeStyle = paint.danger;
          context.lineWidth = 1;
          context.globalAlpha = (0.45 + point.depth * 0.5) * dim;
          context.stroke();
        }

        if (isFocus || (selected && selected === node.slug)) {
          context.globalAlpha = dim;
          context.strokeStyle = paint.fg;
          context.lineWidth = 1.4;
          context.beginPath();
          context.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
          context.stroke();
        }

        // Labels: what is being looked at, plus the hubs facing the camera.
        const labelled = isFocus || (!active && node.hub && point.depth > 0.62);
        if (labelled && intro.current > 0.6) {
          const text = truncate(node.title, 34);
          context.font = `500 12px ${paint.font}`;
          const textWidth = context.measureText(text).width;
          const labelY = point.y - radius - 12;
          context.globalAlpha = (isFocus ? 0.96 : 0.72) * dim;
          context.fillStyle = paint.ink;
          context.beginPath();
          if (typeof context.roundRect === "function") {
            context.roundRect(point.x - textWidth / 2 - 5, labelY - 11, textWidth + 10, 16, 4);
          } else {
            // Older Safari has no roundRect; a plain label beats a blank canvas.
            context.rect(point.x - textWidth / 2 - 5, labelY - 11, textWidth + 10, 16);
          }
          context.fill();
          context.globalAlpha = 1 * dim;
          context.fillStyle = isFocus ? paint.brass2 : paint.fg;
          context.textAlign = "center";
          context.fillText(text, point.x, labelY + 0.5);
        }
      }

      context.globalAlpha = 1;
    },
    [field, reduced, selected],
  );

  // --- the animation loop ---
  useEffect(() => {
    const el = canvas.current;
    const host = wrap.current;
    if (!el || !host) return;
    let frame = 0;
    let last = performance.now();
    let painted = "";

    const size = () => {
      const rect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (`${width}x${height}x${dpr}` === painted) return { width, height };
      painted = `${width}x${height}x${dpr}`;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      return { width, height };
    };

    const step = (now: number) => {
      const elapsed = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (intro.current < 1) intro.current = Math.min(1, intro.current + elapsed * 1.8);
      if (!reduced) {
        if (!drag.current) view.current = { ...view.current, yaw: view.current.yaw + elapsed * 0.16 };
        phase.current = (phase.current + elapsed * 0.34) % 1;
      }
      const { width, height } = size();
      draw(width, height);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    const observer = new ResizeObserver(() => {
      const { width, height } = size();
      draw(width, height);
    });
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [draw, reduced]);

  // A theme switch must re-read the tokens, not reuse the old ones.
  useEffect(() => {
    tokens.current = null;
    if (wrap.current) tokens.current = readTokens(wrap.current);
    const host = wrap.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    draw(rect.width, rect.height);
  }, [theme, draw]);

  // Wheel needs a non-passive listener to be able to stop the page scrolling.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      view.current = zoomBy(view.current, event.deltaY < 0 ? 1.06 : 0.94);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      canvas.current?.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety: a browser that refuses it must not lose the drag.
    }
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (drag.current) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
      drag.current.x = event.clientX;
      drag.current.y = event.clientY;
      view.current = orbit(view.current, dx, dy);
      return;
    }
    const hit = nodeAt(x, y);
    const slug = hit ? field.nodes[hit.index].slug : null;
    if (slug !== pointer.current) {
      pointer.current = slug;
      setHover(slug);
    }
  };

  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const wasDrag = drag.current?.moved ?? false;
    drag.current = null;
    if (wasDrag) return;
    const hit = nodeAt(event.clientX - rect.left, event.clientY - rect.top);
    setSelected(hit ? field.nodes[hit.index].slug : null);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => (view.current = orbit(view.current, -24, 0)),
      ArrowRight: () => (view.current = orbit(view.current, 24, 0)),
      ArrowUp: () => (view.current = orbit(view.current, 0, -18)),
      ArrowDown: () => (view.current = orbit(view.current, 0, 18)),
      "+": () => (view.current = zoomBy(view.current, 1.12)),
      "=": () => (view.current = zoomBy(view.current, 1.12)),
      "-": () => (view.current = zoomBy(view.current, 0.9)),
      Escape: () => setSelected(null),
      r: () => (view.current = { ...DEFAULT_VIEW }),
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    run();
  };

  const reset = () => {
    view.current = { ...DEFAULT_VIEW };
    setSelected(null);
  };

  if (!field.nodes.length) {
    return <p className="text-sm text-muted">Publish a few articles and the link field fills in.</p>;
  }

  const active = selected ?? hover;
  const node = active ? field.nodes.find((item) => item.slug === active) : undefined;
  const inboundNames = node
    ? field.nodes.filter((item) => item.slug !== node.slug && field.edges.some((edge) =>
        field.nodes[edge.to].slug === node.slug && field.nodes[edge.from].slug === item.slug)).map((item) => item.title)
    : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_296px]">
      <div
        ref={wrap}
        className="relative h-[min(78vh,760px)] min-h-[520px] overflow-hidden rounded-lg border border-line bg-surface"
      >
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label={`Internal link field: ${field.shown} articles, ${field.edges.length} links, ${field.orphans.length} orphan pages. Drag to turn the sphere, scroll to zoom, click a node to inspect it, arrow keys to orbit.`}
          className="h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-brass"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={() => {
            pointer.current = null;
            setHover(null);
          }}
          onKeyDown={onKeyDown}
        />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 font-mono text-[11px] text-muted">
          <span className="rounded border border-line bg-elev/85 px-2 py-1">
            {field.shown} articles
          </span>
          <span className="rounded border border-line bg-elev/85 px-2 py-1">
            {field.edges.length} internal links
          </span>
          <span className="rounded border border-line bg-elev/85 px-2 py-1">
            {field.orphans.length} orphan{field.orphans.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-faint">
          Drag to turn · scroll to zoom · click a node · arrow keys orbit
        </p>
      </div>

      <aside className="flex min-w-0 flex-col gap-3">
        <div className="rounded-lg border border-line bg-surface p-3">
          <h3 className="eyebrow">How to read it</h3>
          <p className="mt-2 text-[13px] leading-5 text-muted">
            Each dot is one article, placed on a sphere so the links can be viewed from any angle.
            Arrows point from the linking page to the page it links to, and the travelling dot marks
            that direction. Bigger, brighter dots are nearer the viewer and have more inbound links.
            A page nothing links to is drawn hollow in red — it is an orphan, and Bing reads it as
            less important than its neighbours.
          </p>
          <dl className="mt-3 space-y-2 text-[13px]">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brass" />
              <div>
                <dt className="text-fg">Linked page</dt>
                <dd className="text-faint">At least one article points here.</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brass-2 ring-2 ring-brass/40" />
              <div>
                <dt className="text-fg">Hub</dt>
                <dd className="text-faint">Two or more inbound links: the graph already treats it as important.</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-danger" />
              <div>
                <dt className="text-fg">Orphan</dt>
                <dd className="text-faint">Hollow and red: no other article links here.</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-6 shrink-0 border-t border-dashed border-brass" />
              <div>
                <dt className="text-fg">Internal link</dt>
                <dd className="text-faint">The arrowhead is where the link lands.</dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3">
          <h3 className="eyebrow">{node ? (selected ? "Selected page" : "Hovered page") : "Pick a node"}</h3>
          {node ? (
            <div className="mt-2 space-y-1 text-[13px]">
              <p className="font-medium text-fg">{node.title}</p>
              <p className="truncate font-mono text-[11px] text-faint">/post/{node.slug}/</p>
              <div className="flex gap-3 text-muted">
                <span>{node.out} out</span>
                <span>{node.inbound} in</span>
                {node.orphan ? <span className="text-danger">orphan</span> : null}
              </div>
              {inboundNames.length ? (
                <p className="text-faint">Linked from {inboundNames.slice(0, 3).join(", ")}{inboundNames.length > 3 ? ` +${inboundNames.length - 3}` : ""}.</p>
              ) : (
                <p className="text-danger">Nothing links here yet. Weave a link from a related article.</p>
              )}
              <Link
                to="/articles/$id"
                params={{ id: node.id }}
                className="mt-1 inline-block text-brass hover:text-brass-2"
              >
                Open the article →
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-muted">
              Hover to preview a page and click to pin it. The panel then shows its links in both
              directions.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-[12px] text-faint">
          <span>
            {field.shown < field.total
              ? `Showing the ${field.shown} most linked of ${field.total} articles.`
              : `All ${field.total} articles shown.`}
          </span>
          <button type="button" onClick={reset} className="shrink-0 text-brass hover:text-brass-2">
            Reset view
          </button>
        </div>
      </aside>
    </div>
  );
}
