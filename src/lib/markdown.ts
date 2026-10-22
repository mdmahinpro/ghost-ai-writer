import { esc } from "./utils.ts";

/**
 * Article markdown → HTML renderer.
 *
 * This is the single renderer behind the app preview, the Ghost HTML payload and
 * the exported Static Site, so it must cover the whole blog-writing feature set
 * the pipeline prompts the model to use:
 *
 *   block   headings (#…######), paragraphs, hard breaks, horizontal rules,
 *           bullet + numbered lists (nested), task lists, pipe tables with
 *           alignment (wrapped in `.table-scroll` / `table.article-table`),
 *           blockquotes, GitHub-style callouts (`> [!NOTE]`), fenced code
 *           blocks (with a `figure.code-block` caption), indented code blocks,
 *           images and footnotes.
 *   inline  bold, italic, bold+italic, strikethrough, inline code, links
 *           (with titles), autolinks, inline images and footnote references.
 *
 * Safety model: everything is HTML-escaped; raw HTML in the source is never
 * passed through. Only a small allowlist of link/image schemes survives, so
 * model text can never inject markup or a `javascript:` URL.
 */

/** Placeholder sentinel for already-rendered inline HTML fragments. */
const SENT = "\u0000";
/** Placeholder sentinel for a hard line break inside a paragraph. */
const BR = "\u0001";

// Built at runtime so the control characters never appear in a regex literal.
const UNSAFE_CHARS = new RegExp(`[${SENT}${BR}]`, "g");
const TOKEN = new RegExp(`${SENT}(\\d+)${SENT}`, "g");
const IMAGE_SRC = /^(?:https?:\/\/|\/\/|\/|\.{1,2}\/|data:image\/)/i;
const LINK_HREF = /^(?:https?:\/\/|\/\/|\/|\.{1,2}\/|mailto:|tel:|#)/i;

function sanitize(text: string): string {
  return String(text ?? "").replace(UNSAFE_CHARS, "");
}

// ---------------------------------------------------------------------------
// Inline rendering
// ---------------------------------------------------------------------------

function safeImage(src: string): boolean {
  return IMAGE_SRC.test(src.trim());
}

function safeHref(href: string): boolean {
  return LINK_HREF.test(href.trim());
}

function imageFigure(alt: string, src: string, title?: string): string {
  const clean = src.trim();
  if (!safeImage(clean)) return `<p>${esc(alt || clean)}</p>`;
  const titleAttr = title ? ` title="${esc(title)}"` : "";
  return `<figure class="kg-card kg-image-card"><img src="${esc(clean)}" alt="${esc(alt)}" loading="lazy" decoding="async"${titleAttr} /></figure>`;
}

/**
 * Renders inline spans. A single shared `parts` array holds every already-built
 * HTML fragment (code, links, emphasis) so recursive emphasis never loses an
 * outer token. Tokens are restored only after the surrounding text is escaped.
 */
function renderInline(text: string, parts: string[] = []): string {
  const tok = (html: string): string => {
    parts.push(html);
    return `${SENT}${parts.length - 1}${SENT}`;
  };
  let s = text;

  // Inline code (highest precedence so its contents are never reformatted).
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => tok(`<code>${esc(String(code).trim())}</code>`));

  // Inline images.
  s = s.replace(
    /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g,
    (_m, alt: string, src: string, title?: string) =>
      tok(safeImage(src) ? `<img class="kg-image" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${title ? ` title="${esc(title)}"` : ""} />` : esc(alt || src)),
  );

  // Links.
  s = s.replace(
    /\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g,
    (_m, label: string, href: string, title?: string) =>
      tok(
        safeHref(href)
          ? `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}>${renderInline(label, parts)}</a>`
          : renderInline(label, parts),
      ),
  );

  // Autolinks (`<https://…>`, `<mailto:…>`).
  s = s.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (_m, href: string) =>
    tok(`<a href="${esc(href)}">${esc(href.replace(/^mailto:/i, ""))}</a>`),
  );

  // Footnote references.
  s = s.replace(
    /\[\^([^\]\s]+)\]/g,
    (_m, id: string) =>
      tok(`<sup class="fn-ref" id="fnref-${esc(id)}"><a href="#fn-${esc(id)}">${esc(id)}</a></sup>`),
  );

  // Emphasis (bold+italic, bold, strikethrough, italic). Non-greedy so nested
  // markers such as `**bold and *italic* here**` resolve in the recursive call.
  s = s.replace(/\*\*\*([\s\S]+?)\*\*\*/g, (_m, x: string) => tok(`<strong><em>${renderInline(x, parts)}</em></strong>`));
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, (_m, x: string) => tok(`<strong>${renderInline(x, parts)}</strong>`));
  s = s.replace(/__([\s\S]+?)__/g, (_m, x: string) => tok(`<strong>${renderInline(x, parts)}</strong>`));
  s = s.replace(/~~([\s\S]+?)~~/g, (_m, x: string) => tok(`<del>${renderInline(x, parts)}</del>`));
  s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, (_m, pre: string, x: string) => `${pre}${tok(`<em>${renderInline(x, parts)}</em>`)}`);
  s = s.replace(/(^|[^\w_])_([^_\n]+)_(?!\w)/g, (_m, pre: string, x: string) => `${pre}${tok(`<em>${renderInline(x, parts)}</em>`)}`);

  const escaped = esc(s).split(BR).join("<br>");
  return escaped.replace(TOKEN, (_m, index: string) => parts[Number(index)] ?? "");
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function isTableRow(line: string): boolean {
  return line.includes("|") && line.trim().length > 0;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = splitRow(trimmed);
  return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}

/** Splits a pipe row, honouring `\|` escapes and pipes inside inline code. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  let inCode = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === "\\" && s[i + 1] === "|") {
      current += "|";
      i++;
      continue;
    }
    if (ch === "`") {
      inCode = !inCode;
      current += ch;
      continue;
    }
    if (ch === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function alignments(separator: string[]): (string | null)[] {
  return separator.map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

function alignAttr(align: string | null): string {
  return align ? ` style="text-align:${align}"` : "";
}

function renderTable(lines: string[], start: number): { html: string; next: number } {
  const header = splitRow(lines[start]!);
  const align = alignments(splitRow(lines[start + 1]!));
  const body: string[] = [];
  let i = start + 2;
  while (i < lines.length && lines[i]!.trim() && isTableRow(lines[i]!) && !isTableSeparator(lines[i]!)) {
    const cells = splitRow(lines[i]!);
    while (cells.length < header.length) cells.push("");
    const tds = cells
      .slice(0, header.length)
      .map((cell, index) => `<td${alignAttr(align[index] ?? null)}>${renderInline(cell)}</td>`)
      .join("");
    body.push(`<tr>${tds}</tr>`);
    i++;
  }
  const head = header.map((cell, index) => `<th scope="col"${alignAttr(align[index] ?? null)}>${renderInline(cell)}</th>`).join("");
  const tbody = body.length ? `<tbody>${body.join("")}</tbody>` : "";
  return {
    html: `<div class="table-scroll"><table class="article-table"><thead><tr>${head}</tr></thead>${tbody}</table></div>`,
    next: i,
  };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const UL_ITEM = /^(\s*)[-*+]\s+(.*)$/;
const OL_ITEM = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;

function indentOf(line: string): number {
  const match = /^(\s*)/.exec(line);
  return (match?.[1] ?? "").replace(/\t/g, "    ").length;
}

function listMatch(line: string, ordered: boolean): { indent: number; num: number; text: string; task: boolean | undefined } | null {
  if (ordered) {
    const match = OL_ITEM.exec(line);
    if (!match) return null;
    return { indent: indentOf(line), num: Number(match[2]), text: match[3]!, task: undefined };
  }
  const match = UL_ITEM.exec(line);
  if (!match) return null;
  let text = match[2]!;
  let task: boolean | undefined;
  const checkbox = /^\[([ xX])\]\s+(.*)$/.exec(text);
  if (checkbox) {
    task = checkbox[1]!.toLowerCase() === "x";
    text = checkbox[2]!;
  }
  return { indent: indentOf(line), num: 0, text, task };
}

function renderList(lines: string[], start: number, ordered: boolean): { html: string; next: number } {
  const first = listMatch(lines[start]!, ordered)!;
  const base = first.indent;
  const tag = ordered ? "ol" : "ul";
  const items: string[] = [];
  let i = start;
  let text: string | null = null;
  let task: boolean | undefined;
  let nested = "";
  let extra: string[] = [];

  const flushItem = () => {
    if (text === null) return;
    const parts: string[] = [];
    const body = extra.length ? `${renderInline(text, parts)} ${renderInline(extra.join(" "), parts)}` : renderInline(text, parts);
    const checkbox = task === undefined ? "" : `<input type="checkbox" disabled${task ? " checked" : ""} /> `;
    const cls = task === undefined ? "" : ' class="task-item"';
    items.push(`<li${cls}>${checkbox}${body}${nested}</li>`);
    text = null;
    task = undefined;
    nested = "";
    extra = [];
  };

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j]!.trim()) j++;
      const next = j < lines.length ? listMatch(lines[j]!, ordered) ?? listMatch(lines[j]!, !ordered) : null;
      if (next && next.indent >= base) {
        i = j;
        continue;
      }
      break;
    }
    const same = listMatch(line, ordered);
    const any = same ?? listMatch(line, !ordered);
    if (any) {
      if (any.indent < base) break;
      if (any.indent > base) {
        const sub = renderList(lines, i, same ? ordered : !ordered);
        nested += sub.html;
        i = sub.next;
        continue;
      }
      if (!same) break;
      flushItem();
      text = any.text;
      task = any.task;
      i++;
      continue;
    }
    if (text !== null && indentOf(line) > base) {
      extra.push(line.trim());
      i++;
      continue;
    }
    break;
  }
  flushItem();
  const startAttr = ordered && first.num > 1 ? ` start="${first.num}"` : "";
  return { html: `<${tag}${startAttr}>${items.join("")}</${tag}>`, next: i };
}

// ---------------------------------------------------------------------------
// Blockquotes & callouts
// ---------------------------------------------------------------------------

const CALLOUT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]\s*(.*)$/i;
const CALLOUT_CLASS: Record<string, string> = {
  note: "callout-note",
  tip: "callout-tip",
  important: "callout-important",
  warning: "callout-warning",
  caution: "callout-caution",
  info: "callout-note",
};

function renderBlockquote(quote: string[]): string {
  const first = quote[0] ?? "";
  const marker = CALLOUT.exec(first.trim());
  if (marker) {
    const kind = marker[1]!.toLowerCase();
    const title = marker[2]!.trim();
    const body = quote.slice(1).join("\n");
    const titleHtml = title ? `<p class="callout-title">${renderInline(title)}</p>` : "";
    const bodyHtml = body.trim() ? markdownToHtml(body) : "";
    return `<aside class="callout ${CALLOUT_CLASS[kind] ?? "callout-note"}">${titleHtml}${bodyHtml}</aside>`;
  }
  return `<blockquote>${markdownToHtml(quote.join("\n"))}</blockquote>`;
}

// ---------------------------------------------------------------------------
// Code
// ---------------------------------------------------------------------------

function codeBlock(code: string, language: string): string {
  const lang = language.trim();
  const cls = lang ? ` class="language-${esc(lang)}"` : "";
  const caption = lang ? `<figcaption>${esc(lang)}</figcaption>` : "";
  return `<figure class="code-block">${caption}<pre><code${cls}>${esc(code)}</code></pre></figure>`;
}

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------

const FENCE = /^(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^(?:\*\s*){3,}$|^(?:-\s*){3,}$|^(?:_\s*){3,}$/;
const BLOCK_IMAGE = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)$/;
const BLOCKQUOTE = /^\s{0,3}>\s?/;
const FOOTNOTE_DEF = /^\[\^([^\]\s]+)\]:\s*(.*)$/;

function isFenceClose(line: string, marker: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith(marker) && !/[^\s`~]/.test(trimmed.slice(marker.length));
}

export function markdownToHtml(markdown: string): string {
  const defs = new Map<string, string>();
  const source = sanitize(markdown)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const def = FOOTNOTE_DEF.exec(line.trim());
      if (def) {
        defs.set(def[1]!, def[2]!);
        return "";
      }
      return line;
    });

  const out: string[] = [];
  let para: string[] = [];
  let i = 0;

  const flushPara = () => {
    if (!para.length) return;
    let buffer = "";
    para.forEach((line, index) => {
      const hard = /\\$/.test(line.replace(/\s+$/, "")) || / {2,}$/.test(line);
      let text = line.trim();
      if (hard && text.endsWith("\\")) text = text.slice(0, -1).trimEnd();
      buffer += text;
      if (index < para.length - 1) buffer += hard ? BR : " ";
    });
    out.push(`<p>${renderInline(buffer)}</p>`);
    para = [];
  };

  while (i < source.length) {
    const line = source[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      i++;
      continue;
    }

    const fence = FENCE.exec(trimmed);
    if (fence) {
      flushPara();
      const marker = fence[1]!;
      const language = fence[2] ?? "";
      const code: string[] = [];
      i++;
      while (i < source.length && !isFenceClose(source[i]!, marker)) {
        code.push(source[i]!);
        i++;
      }
      i++;
      out.push(codeBlock(code.join("\n"), language));
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      flushPara();
      const level = Math.min(4, Math.max(2, heading[1]!.length));
      out.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      i++;
      continue;
    }

    if (HR.test(trimmed)) {
      flushPara();
      out.push("<hr>");
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < source.length && isTableSeparator(source[i + 1]!)) {
      flushPara();
      const table = renderTable(source, i);
      out.push(table.html);
      i = table.next;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      flushPara();
      const quote: string[] = [];
      while (i < source.length && BLOCKQUOTE.test(source[i]!)) {
        quote.push(source[i]!.replace(BLOCKQUOTE, ""));
        i++;
      }
      out.push(renderBlockquote(quote));
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      flushPara();
      const list = renderList(source, i, false);
      out.push(list.html);
      i = list.next;
      continue;
    }

    if (/^\d{1,9}[.)]\s+/.test(trimmed)) {
      flushPara();
      const list = renderList(source, i, true);
      out.push(list.html);
      i = list.next;
      continue;
    }

    const image = BLOCK_IMAGE.exec(trimmed);
    if (image) {
      flushPara();
      out.push(imageFigure(image[1]!, image[2]!, image[3]));
      i++;
      continue;
    }

    para.push(line);
    i++;
  }
  flushPara();

  if (defs.size) {
    const items = [...defs.entries()]
      .map(([id, text]) => `<li id="fn-${esc(id)}">${renderInline(text)} <a class="fn-back" href="#fnref-${esc(id)}" aria-label="Back to content">↩</a></li>`)
      .join("");
    out.push(`<section class="footnotes"><ol>${items}</ol></section>`);
  }

  return out.join("\n").replace(UNSAFE_CHARS, "");
}

// ---------------------------------------------------------------------------
// Derivations used by the pipeline / UI
// ---------------------------------------------------------------------------

export function excerptOf(markdown: string): string {
  const plain = sanitize(markdown)
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/^\s*[-*+>]\s+/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, 180);
}

const SKIP_SECTION_LINE =
  /^(?:!|```|~~~|\||>|[-*+]\s|\d{1,9}[.)]\s|\[\^)/;

export function sectionsFromMarkdown(markdown: string): { heading: string; paragraphs: string[] }[] {
  const sections: { heading: string; paragraphs: string[] }[] = [];
  let current: { heading: string; paragraphs: string[] } | null = null;
  let inCode = false;
  for (const line of sanitize(markdown).replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (/^(?:```|~~~)/.test(trimmed)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);
    if (heading) {
      if (current?.paragraphs.length) sections.push(current);
      current = { heading: heading[1]!.replace(/[*_`#]/g, "").trim(), paragraphs: [] };
      continue;
    }
    if (!trimmed || SKIP_SECTION_LINE.test(trimmed)) continue;
    if (!current) current = { heading: "Opening", paragraphs: [] };
    current.paragraphs.push(trimmed);
  }
  if (current?.paragraphs.length) sections.push(current);
  return sections.slice(0, 8);
}

export function wordCount(markdown: string): number {
  return markdown.split(/\s+/).filter(Boolean).length;
}

/** Operator notes must never appear in a published page. */
export function stripVerify(text: string): string {
  return text
    .replace(/\[verify:[^\]]*\]/gi, "")
    .replace(/<p><em>Tone:[^<]*<\/em><\/p>/gi, "")
    .replace(/\*Tone:[^*]*\*/gi, "")
    .replace(UNSAFE_CHARS, "")
    .replace(/[ \t]{2,}/g, " ")    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
