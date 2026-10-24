/**
 * Image placement and media reads.
 *
 * These were Node server functions: search, download, sniff the dimensions, and
 * write the bytes into `public/media`. The API does that now
 * (`/api/v1/images/place`, `/api/v1/images/read`) and serves the result from
 * `/media/<hash>.<ext>`, so the page and the API no longer need to share a disk
 * or an origin.
 *
 * The exported call shapes are unchanged — callers still write
 * `placeImages({ data: … })` — so nothing downstream had to move.
 */
import { apiUrl, post } from "./api-client";

export type ImageSlot = {
  query: string;
  alt: string;
  role: "featured" | "section";
  width?: number;
  height?: number;
};

export type PlacedImage = {
  query: string;
  alt: string;
  role: "featured" | "section";
  http: number;
  selected: boolean;
  src?: string;
  remote?: string;
  width?: number;
  height?: number;
  bytes?: number;
  license: "unknown-bing" | "wikimedia" | "openverse";
  attempts: number;
  error?: string;
};

type PlaceInput = {
  provider?: string;
  slots?: ImageSlot[];
  avoid?: string[];
  salt?: number;
};

function cleanSlots(slots: ImageSlot[] | undefined): ImageSlot[] {
  return (Array.isArray(slots) ? slots : [])
    .slice(0, 4)
    .map((slot) => ({
      query: String(slot?.query ?? "").slice(0, 140),
      alt: String(slot?.alt ?? "").slice(0, 180),
      role: slot?.role === "section" ? ("section" as const) : ("featured" as const),
      width: Number(slot?.width) > 0 ? Math.min(1600, Math.round(Number(slot.width))) : undefined,
      height: Number(slot?.height) > 0 ? Math.min(1200, Math.round(Number(slot.height))) : undefined,
    }))
    .filter((slot) => slot.query.trim().length > 2);
}

export async function placeImages(input: {
  data: PlaceInput;
}): Promise<{ ok: boolean; images: PlacedImage[]; error?: string }> {
  const raw = input?.data ?? {};
  const slots = cleanSlots(raw.slots);
  if (!slots.length) return { ok: true, images: [] };

  const res = await post<{ images: PlacedImage[] }>("/api/v1/images/place", {
    provider: raw.provider === "wikimedia" ? "wikimedia" : "bing",
    slots,
    avoid: (Array.isArray(raw.avoid) ? raw.avoid : [])
      .map((item) => String(item).slice(0, 40))
      .slice(0, 400),
    salt: Number.isFinite(raw.salt) ? Math.max(0, Math.min(9999, Math.round(Number(raw.salt)))) : 0,
  });
  if (!res.ok) return { ok: false, images: [], error: res.error };
  // The API serves these paths; the page is a different origin.
  return {
    ok: true,
    images: (res.data.images ?? []).map((image) => ({
      ...image,
      src: image.src ? apiUrl(image.src) : image.src,
    })),
  };
}

export async function readMediaBatch(input: {
  data: { files?: { name?: string; remote?: string }[] };
}): Promise<{ ok: boolean; files: { name: string; base64: string }[]; error?: string }> {
  const files = (input?.data?.files ?? []).slice(0, 24).map((file) => ({
    name: String(file?.name ?? ""),
    remote: typeof file?.remote === "string" ? file.remote : undefined,
  }));
  const res = await post<{ files: { name: string; base64: string }[] }>("/api/v1/images/read", {
    files,
  });
  if (!res.ok) return { ok: false, files: [], error: res.error };
  return { ok: true, files: res.data.files ?? [] };
}
