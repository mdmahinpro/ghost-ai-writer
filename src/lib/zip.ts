function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function u16(n: number): Uint8Array {
  return Uint8Array.of(n & 255, (n >>> 8) & 255);
}
function u32(n: number): Uint8Array {
  return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Raw DEFLATE (ZIP method 8) through the platform CompressionStream — no
 * dependency, and a static-site build deflates to roughly a fifth of its size.
 * Returns null when compression is unavailable or does not help, so the entry
 * falls back to STORE (method 0).
 */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream !== "function") return null;
  try {
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const stream = new Blob([buffer]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return bytes.length < data.length ? bytes : null;
  } catch {
    return null;
  }
}

/** Builds a ZIP archive, DEFLATE-compressing every entry that gets smaller. */
export async function zipStore(files: { name: string; data: Uint8Array }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const deflated = await deflateRaw(data);
    const method = deflated ? 8 : 0;
    const payload = deflated ?? data;
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      payload,
    ]);
    locals.push(local);
    central.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(method),
        u16(0),
        u16(0),
        u32(crc),
        u32(payload.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const centralBytes = concat(central);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBytes.length),
    u32(offset),
    u16(0),
  ]);
  const body = concat(locals);
  const packed = new Uint8Array(body.byteLength + centralBytes.byteLength + end.byteLength);
  packed.set(body, 0);
  packed.set(centralBytes, body.byteLength);
  packed.set(end, body.byteLength + centralBytes.byteLength);
  const copy = new ArrayBuffer(packed.byteLength);
  new Uint8Array(copy).set(packed);
  return new Blob([copy], { type: "application/zip" });
}
