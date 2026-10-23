/* eslint-disable react-refresh/only-export-components -- Rule 7 design system: tokens, badge helpers, and primitives intentionally live together. */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CheckCircle2, CircleDashed, CircleDot, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Editorial Ops primitives (see docs/design.md).
 * Sizes: sm 32 · md 40 · lg 48. One primary action per screen.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" && "min-h-8 px-3 text-[13px]",
        size === "md" && "min-h-10 px-4 text-sm",
        size === "lg" && "min-h-12 px-5 text-sm",
        variant === "primary" && "bg-accent text-on-accent shadow-xs hover:bg-accent-hover",
        variant === "secondary" &&
          "border border-line bg-elev text-fg shadow-xs hover:border-line-strong hover:bg-surface",
        variant === "ghost" && "border border-transparent text-muted hover:bg-surface hover:text-fg",
        variant === "danger" && "border border-danger/35 bg-transparent text-danger hover:bg-danger/10",
        variant === "quiet" && "bg-transparent text-muted hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} data-surface="card" className={cn("rounded-lg border border-line bg-elev p-5", className)}>
      {children}
    </section>
  );
}

/** Card header: title left, optional action right. Keeps every panel aligned. */
export function CardHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {hint ? <p className="mt-0.5 text-[13px] leading-5 text-faint">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "ok" | "danger" | "brass" | "warn" | "muted";
}) {
  return (
    <span
      data-surface="badge"
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-5",
        tone === "ok" && "border-ok/30 bg-ok/10 text-ok",
        tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
        tone === "warn" && "border-warn/30 bg-warn/10 text-warn",
        tone === "brass" && "border-accent/30 bg-accent/10 text-accent",
        tone === "muted" && "border-line bg-surface text-muted",
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

/**
 * Status glyph — a shape, not just a colour (Linear grammar): dashed = draft,
 * spinner = running, half-filled = held for review, check = done, cross = failed.
 * Always paired with a word so colour is never the only signal.
 */
export function StatusGlyph({ status, className }: { status: string; className?: string }) {
  const tone = statusTone(status);
  const color = tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : tone === "brass" ? "text-warn" : "text-faint";
  const Icon = tone === "ok" ? CheckCircle2 : tone === "danger" ? XCircle : tone === "brass" ? CircleDot : status === "running" || status === "queued" ? Loader2 : CircleDashed;
  return <Icon aria-hidden="true" strokeWidth={1.75} className={cn("size-3.5 shrink-0", color, className)} />;
}

export function statusTone(status: string): "ok" | "danger" | "brass" | "muted" {
  const ok = ["completed", "succeeded", "connected", "verified", "published", "PUBLISHED", "done", "STATIC_CONFIRMED", "GHOST_CONFIRMED", "draft-saved"];
  const bad = ["failed", "refused", "error", "disconnected", "BROKEN", "FAILED", "cancelled"];
  const mid = ["running", "queued", "partial", "SYNCING", "packaged", "draft", "review", "LOCAL", "GHOST_PENDING", "PLANNED", "review-held", "publish-held", "configured", "writing", "scheduled", "live", "cooldown"];
  if (ok.includes(status)) return "ok";
  if (bad.includes(status)) return "danger";
  if (mid.includes(status)) return "brass";
  return "muted";
}

export function jobBadge(status: string): string {
  const labels: Record<string, string> = {
    queued: "PENDING",
    running: "RUNNING",
    completed: "COMPLETED",
    failed: "FAILED",
    refused: "DUPLICATE REFUSED",
    cancelled: "CANCELLED",
    "review-held": "REVIEW HELD",
    "publish-held": "PUBLISH HELD",
  };
  return labels[status] ?? status.replaceAll("-", " ");
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-fg">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-faint">{hint}</span> : null}
    </label>
  );
}

/** Compact inline field for toolbars: no w-full, so it sits on one row. */
export const fieldCompact =
  "h-8 rounded-md border border-line bg-elev px-2 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20";

export const fieldClass =
  "min-h-11 w-full rounded-md border border-line bg-elev px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20";

export function PageIntro({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="display text-fg">{title}</h1>
        {lede ? <p className="mt-2 text-sm leading-6 text-muted">{lede}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Plate({ title, query }: { title: string; query: string }) {
  const initial = (title.trim()[0] || "N").toUpperCase();
  return (
    <div className="relative flex h-36 items-end overflow-hidden rounded-md border border-line bg-surface p-4">
      <span className="pointer-events-none absolute -right-1 -top-6 font-editorial text-8xl leading-none text-fg/10">
        {initial}
      </span>
      <div className="relative">
        <div className="num text-[11px] uppercase tracking-[0.08em] text-faint">{query}</div>
        <div className="mt-1 text-base font-semibold leading-6 tracking-[-0.01em] text-fg">{title}</div>
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong/60 px-6 py-12 text-center">
      <h2 className="display text-fg">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Rule 7: shimmer placeholder. Decorative only — never announced to screen readers. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("skeleton block h-4 w-full", className)} />;
}

/** A stack of skeleton lines sized like real content rows. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-md border border-line bg-elev p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Rule 7: one honest note for the four long-running view states —
 * loading, empty, partial, error. Copy is ours; no marketing filler.
 */
export function StateNote({
  tone,
  title,
  body,
  action,
}: {
  tone: "loading" | "empty" | "partial" | "error";
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const accent =
    tone === "error"
      ? "border-danger/35 bg-danger/5"
      : tone === "partial"
        ? "border-warn/35 bg-warn/5"
        : "border-line bg-surface";
  return (
    <div className={cn("rounded-md border px-4 py-3.5", accent)} role={tone === "error" ? "alert" : "status"}>
      <div className="flex items-center gap-2">
        <Badge tone={tone === "error" ? "danger" : tone === "partial" ? "warn" : "muted"}>{tone}</Badge>
        <span className="text-sm font-medium text-fg">{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
