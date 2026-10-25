/**
 * Pipeline breakdown — the reference's "income / expenses" side card, applied to
 * publishing: each stage of the desk with its count and a proportion bar.
 *
 * Every number here is counted from real state; the bar is `value / largest`, and a
 * stage with zero draws nothing rather than a minimum sliver that would read as
 * activity.
 */
export type BreakdownRow = { label: string; value: number; tone: "queued" | "drafting" | "review" | "shipped" | "muted" };

const TONE_COLOR: Record<BreakdownRow["tone"], string> = {
  queued: "var(--color-brass)",
  drafting: "var(--color-warn)",
  review: "var(--color-brass-2)",
  shipped: "var(--color-ok)",
  muted: "var(--color-faint)",
};

export function BreakdownCard({ rows, hint }: { rows: BreakdownRow[]; hint?: string }) {
  const largest = rows.reduce((max, row) => Math.max(max, row.value), 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <section data-surface="card" className="rounded-lg border border-line bg-elev p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Pipeline</h2>
        <span className="font-mono text-xs tabular-nums text-faint">{total} total</span>
      </div>
      {hint ? <p className="mt-0.5 text-[13px] leading-5 text-faint">{hint}</p> : null}

      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-muted">{row.label}</span>
              <span className="font-mono text-[13px] tabular-nums text-fg">{row.value}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: largest > 0 && row.value > 0 ? `${Math.max(4, Math.round((row.value / largest) * 100))}%` : "0%",
                  background: TONE_COLOR[row.tone],
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
