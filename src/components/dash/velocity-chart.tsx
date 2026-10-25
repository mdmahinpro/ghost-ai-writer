/**
 * Publishing velocity, in the two shapes the references use.
 *
 * Area (Posh): a smooth curve for how much actually shipped — the line follows
 * the points with a monotone cubic so it never overshoots below zero.
 * Bars (SoundCloud): discrete daily generation bursts, which is the honest shape
 * for "how many were produced that hour/day" — a smoothed curve would imply
 * output between buckets that never happened.
 *
 * The timeframe pills are real windows over the data, not decorative: an empty
 * window renders an empty axis rather than an invented trend.
 */
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type VelocityPoint = { label: string; published: number; generated: number };

export type Timeframe = "1D" | "1W" | "1M" | "ALL";
const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "ALL"];

const AREA_COLOR = "#ff1e56";
const BAR_COLOR = "#ff5500";
const SLOT_COLOR = "#262626";

type Mode = "velocity" | "bursts";

export function VelocityChart({
  points,
  timeframe,
  onTimeframe,
}: {
  points: VelocityPoint[];
  timeframe: Timeframe;
  onTimeframe: (next: Timeframe) => void;
}) {
  const [mode, setMode] = useState<Mode>("velocity");
  const total = points.reduce((sum, point) => sum + (mode === "velocity" ? point.published : point.generated), 0);

  return (
    <section data-surface="card" className="rounded-lg border border-line bg-elev p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Publishing velocity</h2>
          <p className="mt-0.5 text-[13px] leading-5 text-faint">
            {mode === "velocity" ? "Articles shipped per bucket" : "Articles generated per bucket"} ·{" "}
            <span className="tabular-nums">{total}</span> total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-line bg-surface-2 p-0.5" role="group" aria-label="Chart shape">
            <Pill active={mode === "velocity"} onClick={() => setMode("velocity")}>
              Velocity
            </Pill>
            <Pill active={mode === "bursts"} onClick={() => setMode("bursts")}>
              Bursts
            </Pill>
          </div>
          <div className="flex rounded-full border border-line bg-surface-2 p-0.5" role="group" aria-label="Timeframe">
            {TIMEFRAMES.map((item) => (
              <Pill key={item} active={item === timeframe} onClick={() => onTimeframe(item)}>
                {item}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {points.length ? (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {mode === "velocity" ? (
              <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="posh-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AREA_COLOR} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={AREA_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
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
                <CartesianGrid stroke={SLOT_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip content={<ChartTip />} cursor={{ fill: SLOT_COLOR, opacity: 0.4 }} />
                <Bar dataKey="generated" fill={BAR_COLOR} radius={[2, 2, 0, 0]} name="generated" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">
          Nothing in this window yet.
        </div>
      )}
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
          ? "rounded-full bg-brass px-2.5 py-1 text-xs font-medium text-ink"
          : "rounded-full px-2.5 py-1 text-xs text-muted hover:text-fg"
      }
    >
      {children}
    </button>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value?: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm">
      <div className="font-mono text-faint">{label}</div>
      <div className="mt-0.5 tabular-nums">
        {payload[0]?.value ?? 0} {payload[0]?.name ?? ""}
      </div>
    </div>
  );
}
