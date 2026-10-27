import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type VelocityPoint = { label: string; published: number; generated: number };

export type Timeframe = "1D" | "1W" | "1M" | "ALL";
const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "ALL"];

const AREA_COLOR = "var(--color-brass)";
const BAR_COLOR = "var(--color-muted)";
const SLOT_COLOR = "var(--color-surface-2)";

type Mode = "velocity" | "bursts";

const WINDOW_LABEL: Record<Timeframe, string> = {
  "1D": "today",
  "1W": "this week",
  "1M": "this month",
  ALL: "all time",
};

export function VelocityChart({
  points,
  timeframe,
  onTimeframe,
  deltaPct,
}: {
  points: VelocityPoint[];
  timeframe: Timeframe;
  onTimeframe: (next: Timeframe) => void;
  deltaPct?: number | null;
}) {
  const [mode, setMode] = useState<Mode>("velocity");
  const total = points.reduce((sum, point) => sum + (mode === "velocity" ? point.published : point.generated), 0);

  return (
    <section data-surface="card" className="overflow-hidden rounded-xl border border-line bg-elev">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-4">
        <div className="min-w-0">
          <p className="eyebrow">Publishing velocity</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-fg sm:text-[36px]">
              {total}
            </span>
            <span className="pb-0.5 text-[13px] text-muted">
              {mode === "velocity" ? "articles shipped" : "articles generated"} · {WINDOW_LABEL[timeframe]}
            </span>
            {deltaPct == null ? null : (
              <span
                className={
                  deltaPct >= 0
                    ? "num mb-0.5 rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[11px] text-ok"
                    : "num mb-0.5 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] text-danger"
                }
              >
                {deltaPct > 0 ? "+" : ""}
                {deltaPct}% wk/wk
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Chart shape">
            <Pill active={mode === "velocity"} onClick={() => setMode("velocity")}>
              Velocity
            </Pill>
            <Pill active={mode === "bursts"} onClick={() => setMode("bursts")}>
              Bursts
            </Pill>
          </div>
          <div className="flex rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Timeframe">
            {TIMEFRAMES.map((item) => (
              <Pill key={item} active={item === timeframe} onClick={() => onTimeframe(item)}>
                {item}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-line px-5 pb-5 pt-4">
        {points.length ? (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {mode === "velocity" ? (
                <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="posh-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AREA_COLOR} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={AREA_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={40}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    type="monotone"
                    dataKey="published"
                    stroke={AREA_COLOR}
                    strokeWidth={2}
                    fill="url(#posh-fill)"
                    name="shipped"
                  />
                </AreaChart>
              ) : (
                <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={40}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ fill: SLOT_COLOR, opacity: 0.4 }} />
                  <Bar dataKey="generated" fill={BAR_COLOR} radius={[2, 2, 0, 0]} name="generated" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong/60">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-md bg-surface-2 text-faint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
                <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" strokeLinecap="round" />
              </svg>
            </span>
            <p className="text-[13px] text-muted">Nothing in this window yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "inline-flex h-7 items-center rounded-sm bg-brass px-2.5 text-[11px] font-semibold text-ink shadow-xs transition-colors duration-150"
          : "inline-flex h-7 items-center rounded-sm px-2.5 text-[11px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      }
    >
      {children}
    </button>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value?: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-elev px-2.5 py-1.5 text-[11px] shadow-sm">
      <div className="num text-faint">{label}</div>
      <div className="mt-0.5 num text-fg">
        {payload[0]?.value ?? 0} {payload[0]?.name ?? ""}
      </div>
    </div>
  );
}
