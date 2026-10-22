export function embed(s: string): Float64Array {
  const n = 48;
  const v = new Float64Array(n);
  const t = ` ${normalize(s)} `;
  for (let i = 0; i < Math.max(0, t.length - 2); i++) {
    const tri = t.slice(i, i + 3);
    let h = 2166136261;
    for (let c = 0; c < tri.length; c++) h = Math.imul(h ^ tri.charCodeAt(c), 16777619);
    const idx = Math.abs(h) % n;
    v[idx] += h & 1 ? 1 : -1;
  }
  return normalizeVector(v);
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVector(v: Float64Array): Float64Array {
  let mag = 0;
  for (let i = 0; i < v.length; i++) mag += v[i]! * v[i]!;
  mag = Math.sqrt(mag) || 1;
  for (let i = 0; i < v.length; i++) v[i] = v[i]! / mag;
  return v;
}

export function cosine(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length || a.length === 0) {
    throw new Error(`L3 dimension mismatch (${a.length} vs ${b.length})`);
  }
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

export type L3EmbedSource = "provider" | "hash-fallback";

/** Provider vectors when they succeed. RATE_LIMIT or a bad shape falls back to the local hash embed. */
export async function embedForL3(
  text: string,
  provider?: (text: string) => Promise<number[]>,
): Promise<{ vector: Float64Array; source: L3EmbedSource; note?: string }> {
  if (!provider) {
    return { vector: embed(text), source: "hash-fallback", note: "No provider embedder; local hash vector." };
  }
  try {
    const raw = await provider(text);
    if (!Array.isArray(raw) || raw.length < 2 || raw.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
      throw new Error("provider embed returned an unusable vector");
    }
    return { vector: normalizeVector(Float64Array.from(raw)), source: "provider" };
  } catch (error) {
    const note = error instanceof Error ? error.message : "provider embed failed";
    return { vector: embed(text), source: "hash-fallback", note };
  }
}

/** Embed every text with one source. A provider failure or a length mismatch re-embeds the whole set with the local hash. */
export async function embedAllForL3(
  texts: string[],
  provider?: (text: string) => Promise<number[]>,
): Promise<{ vectors: Float64Array[]; source: L3EmbedSource; note?: string }> {
  if (!texts.length) {
    return { vectors: [], source: "hash-fallback", note: "No provider embedder; local hash vector." };
  }
  const rows = await Promise.all(texts.map((text) => embedForL3(text, provider)));
  const length = rows[0]!.vector.length;
  const same = rows.every((row) => row.source === rows[0]!.source && row.vector.length === length);
  if (!provider || rows[0]!.source === "hash-fallback" || !same) {
    const hashed = rows[0]!.source === "hash-fallback" && same ? rows : await Promise.all(texts.map((text) => embedForL3(text)));
    const note = rows.find((row) => row.note)?.note ?? hashed[0]?.note;
    return { vectors: hashed.map((row) => row.vector), source: "hash-fallback", note };
  }
  return { vectors: rows.map((row) => row.vector), source: "provider" };
}
