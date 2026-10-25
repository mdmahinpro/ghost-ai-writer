/**
 * Right-hand telemetry drawer.
 *
 * Two kinds of number, deliberately separated:
 *
 *  - **Measured** (`GET /v1/metrics`): process RSS, OS threads, CPU seconds, uptime,
 *    database size, and real queue depth from the jobs table. These come from the
 *    running Rust service, so they are facts. A null rendered as "unavailable" means
 *    this host does not expose the value — never a stand-in curve.
 *  - **Derived per bucket**: completions, words and tokens settled, which is what
 *    the overview has always charted.
 *
 * The log stream underneath is the real activity feed: timestamped, monospace,
 * newest first, exactly what the server and the browser actually recorded.
 */
import { useEffect, useState } from "react";
import { Sparkline } from "./sparkline";
import { fetchProcessMetrics, formatBytes, formatDuration, type ProcessMetrics } from "../../lib/process-metrics.ts";

export type TelemetrySeries = { label: string; hint: string; values: number[]; color: string };
export type LogLine = { id: string; at: number; tone: string; message: string };

const POLL_MS = 15000;

export function TelemetryDrawer({ series, logs }: { series: TelemetrySeries[]; logs: LogLine[] }) {
  const [process, setProcess] = useState<ProcessMetrics | null>(null);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let live = true;
    async function tick() {
      const next = await fetchProcessMetrics();
      if (!live) return;
      setAsked(true);
      if (next) setProcess(next);
    }
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section data-surface="card" className="flex h-full flex-col rounded-lg border border-line bg-elev p-5">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Telemetry</h2>
        <p className="mt-0.5 text-[13px] leading-5 text-faint">
          Measured process and queue figures, refreshed every {POLL_MS / 1000}s, plus throughput per bucket.
        </p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Cell label="Memory" value={formatBytes(process?.rss_bytes)} />
        <Cell label="Threads" value={process?.threads == null ? "unavailable" : String(process.threads)} />
        <Cell label="Uptime" value={process ? formatDuration(process.uptime_secs) : asked ? "unavailable" : "…"} />
        <Cell label="Database" value={formatBytes(process?.db_bytes)} />
        <Cell label="Queued" value={process ? String(process.jobs_queued) : "…"} />
        <Cell label="Running" value={process ? String(process.jobs_running) : "…"} />
        <Cell label="Failed" value={process ? String(process.jobs_failed) : "…"} />
        <Cell label="Shipped 1h" value={process ? String(process.completed_last_hour) : "…"} />
      </div>

      <div className="space-y-3">
        {series.map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-surface-2/40 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">{item.label}</span>
              <span className="font-mono text-xs tabular-nums text-fg">
                {item.values.length ? item.values[item.values.length - 1] : 0}
              </span>
            </div>
            <Sparkline values={item.values} color={item.color} />
            <div className="mt-0.5 text-[11px] text-faint">{item.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Event stream</span>
          <span className="font-mono text-[11px] text-faint tabular-nums">{logs.length} events</span>
        </div>
        <div className="max-h-64 min-h-24 flex-1 overflow-y-auto rounded-lg border border-line bg-[color-mix(in_oklab,var(--color-bg)_70%,black)] px-3 py-2">
          {logs.length ? (
            <ul className="space-y-1">
              {logs.map((line) => (
                <li key={line.id} className="font-mono text-[12px] leading-[1.6]">
                  <span className="text-faint tabular-nums">{stamp(line.at)}</span>{" "}
                  <span style={{ color: toneColor(line.tone) }}>{line.tone}</span>{" "}
                  <span className="text-muted">{line.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-[12px] text-faint">No events yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-2.5 py-1.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="font-mono text-[13px] tabular-nums text-fg">{value}</div>
    </div>
  );
}

function stamp(at: number): string {
  const date = new Date(at);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function toneColor(tone: string): string {
  if (tone === "ok" || tone === "success") return "var(--color-ok)";
  if (tone === "danger" || tone === "error") return "var(--color-danger)";
  if (tone === "warn") return "var(--color-warn)";
  return "var(--color-brass)";
}
