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
    <section data-surface="card" className="overflow-hidden rounded-xl border border-line bg-elev">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Post ledger</h2>
          <p className="mt-0.5 text-[13px] leading-5 text-faint">
            {rows.length} article{rows.length === 1 ? "" : "s"} on this website
          </p>
        </div>
        <Link
          to="/articles"
          className="inline-flex h-8 shrink-0 items-center rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
        >
          View all
        </Link>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto px-2 py-2">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-faint">
                <th className="px-3 py-2 font-medium">Post</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Keyword</th>
                <th className="px-3 py-2 font-medium">Published</th>
                <th className="px-3 py-2 text-right font-medium">Words</th>
                <th className="px-3 py-2 text-right font-medium">API cost</th>
                <th className="px-3 py-2 text-right font-medium">Ghost sync</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line align-middle transition-colors duration-150 last:border-0 hover:bg-surface-2/60"
                >
                  <td className="max-w-[22rem] px-3 py-3">
                    <Link
                      to="/articles/$id"
                      params={{ id: row.id }}
                      className="block truncate text-[13px] font-medium text-fg underline-offset-4 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span className="num mt-0.5 block truncate text-[11px] text-faint">{row.slug}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-3 text-muted">{row.keyword || "—"}</td>
                  <td className="num whitespace-nowrap px-3 py-3 text-[11px] text-muted">
                    {row.publishedAt ? new Date(row.publishedAt).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="num px-3 py-3 text-right text-fg">{row.words || "—"}</td>
                  <td className="num px-3 py-3 text-right text-fg">
                    {row.costUsd === null ? "—" : `$${row.costUsd.toFixed(4)}`}
                  </td>
                  <td className="num px-3 py-3 text-right text-[11px] text-muted">
                    {row.syncMs === null ? "—" : `${Math.round(row.syncMs)} ms`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 pb-5">
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong/60 px-6 py-10">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-md bg-surface-2 text-faint"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
                <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
              </svg>
            </span>
            <p className="max-w-sm text-center text-[13px] leading-6 text-muted">
              No articles yet. Queue a topic and the ledger fills as stages complete.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const live = status === "published";
  return (
    <span
      className={
        live
          ? "inline-flex items-center rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok"
          : "inline-flex items-center rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn"
      }
    >
      {live ? "Published" : status === "draft" ? "Draft" : status}
    </span>
  );
}
