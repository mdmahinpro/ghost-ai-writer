/**
 * The post ledger: every generated article as one dense row.
 *
 * Fey pattern — borderless, no zebra striping, one mint pill for live and an
 * amber pill for held drafts. Numbers are right-aligned and tabular so columns
 * line up down the page; that is the whole point of a ledger.
 *
 * Columns are limited to what we actually store. `API cost` is the job's settled
 * cost, `Ghost sync` is confirmedAt − dispatchedAt, and both render as "—" when
 * the row has no measurement rather than a plausible-looking zero.
 */
import { Link } from "@tanstack/react-router";

export type LedgerRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  keyword: string;
  publishedAt: number;
  words: number;
  costUsd: number | null;
  syncMs: number | null;
};

export function PostLedger({ rows }: { rows: LedgerRow[] }) {
  return (
    <section data-surface="card" className="rounded-lg border border-line bg-elev p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Post ledger</h2>
          <p className="mt-0.5 text-[13px] leading-5 text-faint">
            {rows.length} article{rows.length === 1 ? "" : "s"} on this website
          </p>
        </div>
        <Link to="/articles" className="text-sm text-brass">
          View all
        </Link>
      </div>
      {rows.length ? (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-faint">
                <th className="px-2 py-2 font-medium">Post</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Keyword</th>
                <th className="px-2 py-2 font-medium">Published</th>
                <th className="px-2 py-2 text-right font-medium">Words</th>
                <th className="px-2 py-2 text-right font-medium">API cost</th>
                <th className="px-2 py-2 text-right font-medium">Ghost sync</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line/60 align-middle">
                  <td className="max-w-[22rem] px-2 py-3">
                    <Link to="/articles/$id" params={{ id: row.id }} className="block truncate font-medium hover:text-brass">
                      {row.title}
                    </Link>
                    <span className="block truncate font-mono text-[11px] text-faint">{row.slug}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="max-w-[14rem] truncate px-2 py-3 text-muted">{row.keyword || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-muted tabular-nums">
                    {row.publishedAt ? new Date(row.publishedAt).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{row.words || "—"}</td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {row.costUsd === null ? "—" : `$${row.costUsd.toFixed(4)}`}
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-xs tabular-nums text-muted">
                    {row.syncMs === null ? "—" : `${Math.round(row.syncMs)} ms`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          No articles yet. Queue a topic and the ledger fills as stages complete.
        </p>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const live = status === "published";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: live ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.14)",
        color: live ? "var(--color-ok)" : "var(--color-warn)",
      }}
    >
      {live ? "Published" : status === "draft" ? "Draft" : status}
    </span>
  );
}
