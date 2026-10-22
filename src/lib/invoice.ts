import type { UsageEvent } from "./types";
import { esc, money, utcDay } from "./utils";

export type InvoiceLine = {
  date: string;
  site: string;
  stage: string;
  model: string;
  tokens: number;
  usd: number;
};

export type InvoiceDoc = {
  number: string;
  issued: string;
  rangeLabel: string;
  lines: InvoiceLine[];
  tokens: number;
  usd: number;
};

export function buildInvoice(
  events: UsageEvent[],
  siteName: (siteId: string) => string,
  from: string,
  to: string,
): InvoiceDoc {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const lines = events
    .filter((event) => event.state === "SETTLED" && utcDay(event.at) >= start && utcDay(event.at) <= end)
    .sort((a, b) => a.at - b.at)
    .map((event) => ({
      date: utcDay(event.at),
      site: siteName(event.siteId),
      stage: event.stage,
      model: event.model,
      tokens: event.tokens,
      usd: event.usd,
    }));
  const tokens = lines.reduce((sum, line) => sum + line.tokens, 0);
  const usd = lines.reduce((sum, line) => sum + line.usd, 0);
  return {
    number: `INV-${start.replaceAll("-", "")}-${end.replaceAll("-", "")}`,
    issued: utcDay(Date.now()),
    rangeLabel: `${start} to ${end}`,
    lines,
    tokens,
    usd,
  };
}

export function invoiceHtml(doc: InvoiceDoc): string {
  const rows = doc.lines
    .map(
      (line) =>
        `<tr><td>${esc(line.date)}</td><td>${esc(line.site)}</td><td>${esc(line.stage)}</td><td>${esc(line.model)}</td><td>${line.tokens}</td><td>${esc(money(line.usd))}</td></tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(doc.number)}</title>
<style>
  body { margin: 32px; color: #1c1915; font: 15px/1.5 Georgia, serif; }
  h1 { font-weight: 500; font-size: 28px; margin: 0; }
  p { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
  .total { margin-top: 16px; font-size: 18px; }
  .note { margin-top: 24px; color: #555; font-size: 13px; }
</style>
</head>
<body>
  <h1>Usage invoice</h1>
  <p>${esc(doc.number)} · issued ${esc(doc.issued)}</p>
  <p>Period ${esc(doc.rangeLabel)}</p>
  <table>
    <thead><tr><th>Date</th><th>Website</th><th>Stage</th><th>Model</th><th>Tokens</th><th>Amount</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">No settled usage in this range.</td></tr>`}</tbody>
  </table>
  <p class="total">${doc.lines.length} lines · ${doc.tokens} tokens · ${esc(money(doc.usd))}</p>
  <p class="note">This invoice is calculated from the usage ledger saved in this browser. It is not a card charge and it is not a Stripe receipt.</p>
</body>
</html>`;
}

function ascii(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, "?");
}

function pdfEscape(text: string): string {
  return ascii(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function invoicePdf(doc: InvoiceDoc): Uint8Array {
  const lines = [
    "Usage invoice",
    `${doc.number}  issued ${doc.issued}`,
    `Period ${doc.rangeLabel}`,
    "",
    "Date        Website              Stage      Model                 Tokens    Amount",
    ...doc.lines.map(
      (line) =>
        `${line.date}  ${line.site.slice(0, 18).padEnd(18)}  ${line.stage.slice(0, 8).padEnd(8)}  ${line.model.slice(0, 18).padEnd(18)}  ${String(line.tokens).padStart(6)}  ${money(line.usd)}`,
    ),
    ...(doc.lines.length ? [] : ["No settled usage in this range."]),
    "",
    `${doc.lines.length} lines   ${doc.tokens} tokens   ${money(doc.usd)}`,
    "Not a card charge. Not a Stripe receipt. Ledger saved in this browser.",
  ];
  return pdfFromLines(lines.map(pdfEscape));
}

function pdfFromLines(lines: string[]): Uint8Array {
  const perPage = 42;
  const streams: string[] = [];
  const source = lines.length ? lines : ["Empty"];
  for (let i = 0; i < source.length; i += perPage) {
    const slice = source.slice(i, i + perPage);
    let y = 750;
    const ops = ["BT", "/F1 10 Tf"];
    for (const line of slice) {
      ops.push(`1 0 0 1 48 ${y} Tm (${line}) Tj`);
      y -= 16;
    }
    ops.push("ET");
    streams.push(ops.join("\n"));
  }
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  let next = 4;
  for (let i = 0; i < streams.length; i += 1) {
    pageIds.push(next);
    next += 1;
    contentIds.push(next);
    next += 1;
  }
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  streams.forEach((stream, index) => {
    objects.set(
      pageIds[index]!,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[index]} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    objects.set(contentIds[index]!, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let body = "%PDF-1.4\n";
  const offsets = [0];
  const max = next - 1;
  for (let id = 1; id <= max; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${max + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let id = 1; id <= max; id += 1) body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${max + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}
