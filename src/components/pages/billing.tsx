import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { Button, Card, Field, PageIntro, fieldClass } from "@/components/ui";
import { buildInvoice, invoiceHtml, invoicePdf } from "@/lib/invoice";
import { money, utcDay } from "@/lib/utils";

function download(name: string, blob: Blob) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  URL.revokeObjectURL(href);
}

export function BillingPage() {
  const events = useApp((s) => s.events);
  const sites = useApp((s) => s.sites);
  const settled = events.filter((event) => event.state === "SETTLED");
  const earliest = settled.reduce((min, event) => Math.min(min, event.at), Date.now());
  const [from, setFrom] = useState(utcDay(earliest));
  const [to, setTo] = useState(utcDay(Date.now()));
  const [saved, setSaved] = useState("");
  const invoice = useMemo(
    () =>
      buildInvoice(
        events,
        (siteId) => sites.find((site) => site.id === siteId)?.name ?? "Website",
        from,
        to,
      ),
    [events, sites, from, to],
  );
  const today = utcDay(Date.now());
  const spentToday = settled.filter((event) => utcDay(event.at) === today).reduce((sum, event) => sum + event.usd, 0);

  function save(kind: "html" | "pdf") {
    const base = `${invoice.number}.`;
    if (kind === "html") {
      download(`${base}html`, new Blob([invoiceHtml(invoice)], { type: "text/html" }));
      setSaved(`Downloaded ${invoice.number}.html`);
      return;
    }
    const bytes = invoicePdf(invoice);
    download(`${base}pdf`, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
    setSaved(`Downloaded ${invoice.number}.pdf`);
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Account"
        title="Billing"
        lede="This invoice is the usage ledger saved with the studio. It stays after a reload. No card is charged. Stripe checkout is a separate task."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="eyebrow">Plan</div>
          <div className="mt-1.5 text-[15px] font-semibold text-fg">Owner</div>
          <p className="mt-1 text-sm text-muted">{sites.length} websites, no cap</p>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Today</div>
          <div className="num mt-1.5 text-[22px] leading-none text-fg">{money(spentToday)}</div>
          <p className="mt-1 text-sm text-muted">Settled usage, not a charge</p>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">This invoice</div>
          <div className="num mt-1.5 text-[22px] leading-none text-fg">{money(invoice.usd)}</div>
          <p className="mt-1 text-sm text-muted">{invoice.lines.length} settled lines</p>
        </Card>
      </div>
      <Card className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="From">
          <input className={fieldClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To">
          <input className={fieldClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save("pdf")}>Download PDF</Button>
          <Button variant="ghost" onClick={() => save("html")}>
            Download HTML
          </Button>
        </div>
      </Card>
      {saved ? <p className="text-sm text-muted">{saved}</p> : null}
      <Card className="p-5">
        <h2 className="text-[13px] font-semibold text-fg">Usage invoice</h2>
        <p className="mt-1 text-[12px] text-faint">
          {invoice.number} · issued {invoice.issued} · {invoice.rangeLabel}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.06em] text-faint">
              <tr>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Website</th>
                <th className="py-2 font-medium">Stage</th>
                <th className="py-2 font-medium">Model</th>
                <th className="py-2 text-right font-medium">Tokens</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, index) => (
                <tr key={`${line.date}-${index}`} className="border-t border-line/70 hover:bg-surface/60">
                  <td className="py-2.5 text-muted">{line.date}</td>
                  <td>{line.site}</td>
                  <td>{line.stage}</td>
                  <td>{line.model}</td>
                  <td className="num py-2.5 text-right text-muted">{line.tokens}</td>
                  <td className="num py-2.5 text-right text-fg">{money(line.usd)}</td>
                </tr>
              ))}
              {!invoice.lines.length ? (
                <tr>
                  <td className="py-6 text-center text-[12px] text-faint" colSpan={6}>
                    No settled usage in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-line pt-3 text-[12px] text-muted">
          <span className="num">{invoice.lines.length} lines</span>
          <span className="num">{invoice.tokens} tokens</span>
          <span className="num text-[13px] font-semibold text-fg">{money(invoice.usd)}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-faint">
          The ledger is the settled usage saved in this browser. It is not written to a shared database, because that table would be readable without an account. Downloading does not pay anyone.
        </p>
      </Card>
    </div>
  );
}
