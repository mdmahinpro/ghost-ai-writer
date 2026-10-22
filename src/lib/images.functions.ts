import { createServerFn } from "@tanstack/react-start";

type ImageSlot = { query: string; alt: string; role: "featured" | "section"; width?: number; height?: number };

function readSlots(input: unknown): { provider: string; slots: ImageSlot[]; avoid: string[]; salt: number } {
  const raw = input as { provider?: string; slots?: ImageSlot[]; avoid?: string[]; salt?: number } | null;
  const provider = raw?.provider === "wikimedia" ? "wikimedia" : "bing";
  const slots = Array.isArray(raw?.slots) ? raw.slots : [];
  const clean = slots.slice(0, 4).map((slot) => ({
    query: String(slot?.query ?? "").slice(0, 140),
    alt: String(slot?.alt ?? "").slice(0, 180),
    role: slot?.role === "section" ? "section" as const : "featured" as const,
    width: Number(slot?.width) > 0 ? Math.min(1600, Math.round(Number(slot.width))) : undefined,
    height: Number(slot?.height) > 0 ? Math.min(1200, Math.round(Number(slot.height))) : undefined,
  }));
  const avoid = Array.isArray(raw?.avoid) ? raw.avoid.map((item) => String(item).slice(0, 40)).slice(0, 400) : [];
  const salt = Number.isFinite(raw?.salt) ? Math.max(0, Math.min(9999, Math.round(Number(raw?.salt)))) : 0;
  return { provider, slots: clean.filter((slot) => slot.query.trim().length > 2), avoid, salt };
}

export const placeImages = createServerFn({ method: "POST" })
  .validator(readSlots)
  .handler(async ({ data }) => {
    if (!data.slots.length) return { ok: true as const, images: [] };
    const { placeImageSlots } = await import("./image-fetch");
    const images = await placeImageSlots(data.slots, data.provider, data.avoid, data.salt);
    return { ok: true as const, images };
  });

export const readMediaBatch = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const files = (input as { files?: { name?: string; remote?: string }[] } | null)?.files ?? [];
    return {
      files: files.slice(0, 24).map((file) => ({
        name: String(file.name ?? ""),
        remote: typeof file.remote === "string" ? file.remote : undefined,
      })),
    };
  })
  .handler(async ({ data }) => {
    const out: { name: string; base64: string }[] = [];
    const { readMediaFile } = await import("./image-fetch");
    for (const file of data.files) {
      const hit = await readMediaFile(file.name, file.remote);
      if (!hit) continue;
      out.push({ name: hit.name, base64: hit.bytes.toString("base64") });
    }
    return { ok: true as const, files: out };
  });
