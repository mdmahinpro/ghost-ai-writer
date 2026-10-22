/* eslint-disable react-refresh/only-export-components -- Rule 7 design system: tokens, badge helpers, and primitives intentionally live together. */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" && "bg-brass text-ink shadow-sm hover:bg-brass-2",
        variant === "ghost" && "border border-line/60 bg-surface text-fg hover:border-line-strong hover:bg-surface-2",
        variant === "danger" && "border border-danger/40 bg-transparent text-danger hover:bg-danger/10",
        variant === "quiet" && "bg-transparent text-muted hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return <section id={id} data-surface="card" className={cn("rounded-xl border border-line/60 bg-elev p-5 shadow-sm", className)}>{children}</section>;
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "ok" | "danger" | "brass" | "muted" }) {
  return (
    <span
      data-surface="badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-5",
        tone === "ok" && "border-ok/25 bg-ok/10 text-ok",
        tone === "danger" && "border-danger/25 bg-danger/10 text-danger",
        tone === "brass" && "border-brass/25 bg-brass/10 text-brass-2",
        tone === "muted" && "border-line/60 bg-surface-2 text-muted",
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
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
      <span className="mb-2 block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-faint">{hint}</span> : null}
    </label>
  );
}

export const fieldClass =
  "min-h-11 w-full rounded-lg border border-line/60 bg-bg px-4 py-2.5 text-sm text-fg outline-none placeholder:text-faint focus:border-brass focus:ring-2 focus:ring-brass/15";

export function PageIntro({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  return (
    <header className="mb-8 max-w-prose">
      {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brass-2">{eyebrow}</p> : null}
      <h1 className="font-display text-3xl font-semibold tracking-tight text-fg md:text-4xl">{title}</h1>
      {lede ? <p className="mt-3 text-[15px] leading-7 text-muted">{lede}</p> : null}
    </header>
  );
}

export function Plate({ title, query }: { title: string; query: string }) {
  const initial = (title.trim()[0] || "N").toUpperCase();
  return (
    <div className="relative flex h-36 items-end overflow-hidden rounded-lg border border-line bg-elev p-4">
      <span className="pointer-events-none absolute -right-1 -top-5 font-display text-8xl leading-none text-brass/25">{initial}</span>
      <span className="absolute left-4 top-4 h-px w-16 bg-brass" />
      <div className="relative">
        <div className="font-mono text-xs uppercase tracking-widest text-faint">{query}</div>
        <div className="mt-1 font-display text-xl leading-6 text-fg">{title}</div>
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
      <h2 className="font-display text-2xl text-fg">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
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
    <div className={cn("space-y-3", className)} role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-xl border border-line bg-elev/60 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
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
    tone === "error" ? "border-danger/40 bg-danger/5" : tone === "partial" ? "border-brass/40 bg-brass/5" : "border-line bg-elev/60";
  return (
    <div className={cn("rounded-xl border px-4 py-4", accent)} role={tone === "error" ? "alert" : "status"}>
      <div className="flex items-center gap-2">
        <Badge tone={tone === "error" ? "danger" : tone === "partial" ? "brass" : "muted"}>{tone}</Badge>
        <span className="text-sm font-medium text-fg">{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
