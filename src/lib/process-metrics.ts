/**
 * Real process/queue telemetry from the Rust service.
 *
 * `GET /v1/metrics` reads the running process (RSS, threads, CPU) and the database
 * (queue depth, completions, ledger rows). Unlike the bucket series those numbers
 * are measured, so a null field means "this host does not expose it" and the panel
 * says "unavailable" rather than drawing a plausible curve.
 */
import { get } from "./api-client.ts";

export type ProcessMetrics = {
  uptime_secs: number;
  rss_bytes: number | null;
  threads: number | null;
  cpu_secs: number | null;
  db_bytes: number | null;
  jobs_queued: number;
  jobs_running: number;
  jobs_failed: number;
  completed_last_hour: number;
  ledger_rows: number;
};

export async function fetchProcessMetrics(): Promise<ProcessMetrics | null> {
  const result = await get<ProcessMetrics>("/api/v1/metrics");
  if (!result.ok) return null;
  return result.data;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "unavailable";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function formatDuration(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
