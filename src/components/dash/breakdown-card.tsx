export type BreakdownRow = { label: string; value: number; tone: "queued" | "drafting" | "review" | "shipped" | "muted" };

const TONE_COLOR: Record<BreakdownRow["tone"], string> = {
  queued: "var(--color-line-strong)",
  drafting: "var(--color-warn)",
  review: "var(--color-muted)",
  shipped: "var(--color-ok)",
  muted: "var(--color-faint)",
};

export function BreakdownCard({ rows, hint }: { rows: BreakdownRow[]; hint?: string }) {
  const largest = rows.reduce((max, row) => Math.max(max, row.value), 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <section data-surface="card" className="overflow-hidden rounded-xl border border-line bg-elev">
      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Pipeline</h2>
          {hint ? <p className="mt-0.5 text-[13px] leading-5 text-faint">{hint}</p> : null}
        </div>
        <span className="num shrink-0 pt-0.5 text-[12px] text-faint">{total} total</span>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {rows.map((row) => (
          <li key={row.label} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-muted">{row.label}</span>
              <span className="num text-[13px] text-fg">{row.value}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-150"
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
