/**
 * Right-hand telemetry drawer.
 *
 * IMPORTANT — what this shows and why it is not CPU/Memory/Network:
 * the brief asks for host CPU, memory and network egress. This API does not
 * collect them: there is no metrics endpoint, and the worker heartbeat carries
 * only liveness and an active-job count. Drawing a CPU curve from nothing would
 * be a fabricated chart, so the three sparklines show series we genuinely have
 * per bucket — jobs completed, words written, tokens settled — and the panel
 * says so. Adding real CPU/memory means adding a metrics endpoint to the Rust
 * service; that is a separate job, not a styling one.
 *
 * The log stream underneath is the real activity feed: timestamped, monospace,
 * newest first, exactly what the server and the browser actually recorded.
 */
import { Sparkline } from "./sparkline";

export type TelemetrySeries = { label: string; hint: string; values: number[]; color: string };
export type LogLine = { id: string; at: number; tone: string; message: string };

export function TelemetryDrawer({ series, logs }: { series: TelemetrySeries[]; logs: LogLine[] }) {
  return (
    <section data-surface="card" className="flex h-full flex-col rounded-lg border border-line bg-elev p-5">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Telemetry</h2>
        <p className="mt-0.5 text-[13px] leading-5 text-faint">
          Throughput per bucket. Host CPU, memory and network are not collected by this API yet.
        </p>
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
