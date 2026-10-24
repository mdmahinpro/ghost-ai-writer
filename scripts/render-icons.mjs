#!/usr/bin/env node
/**
 * Renders the installable-app icons from the studio mark (src/components/mark.tsx).
 *
 * The platform default ships a single 180px icon, which is below Chrome's
 * installability floor (192 + 512) and has no maskable variant, so "Add to Home
 * Screen" showed a generic shortcut. Regenerate with: node scripts/render-icons.mjs
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "__grok");
const BG = "#f2f4f1";
const ACCENT = "#14654a";
const GLYPH =
  "M24 44V20h11.2c3.7 0 6 2 6 5.1 0 2.2-1.3 4-3.5 4.6 2.5.5 4.1 2.4 4.1 5 0 3.4-2.5 5.3-6.6 5.3H24Zm4.2-11.6h6.2c1.6 0 2.6-.8 2.6-2.1s-1-2.1-2.6-2.1h-6.2v4.2Zm0 8.8h6.9c1.9 0 3-.8 3-2.2s-1.1-2.2-3-2.2h-6.9V41.2Z";

/** `scale` < 1 keeps the mark inside a maskable icon's 80% safe zone. */
function svg(scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${BG}"/>
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <circle cx="32" cy="32" r="30" fill="${ACCENT}"/>
    <path d="${GLYPH}" fill="#ffffff"/>
  </g>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.78 },
  { file: "icon-180.png", size: 180, scale: 1 },
];

for (const { file, size, scale } of targets) {
  const png = await sharp(Buffer.from(svg(scale))).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(OUT, file), png);
  console.log(`wrote public/__grok/${file} (${size}×${size}, ${png.length} bytes)`);
}
