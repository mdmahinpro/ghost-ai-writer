import { readMediaBatch } from "./images.functions";
import { loadFtpCredentials, WORKSPACE_ID } from "./ftp-credentials";
import { uploadFtps } from "./ops.functions";
import { staticMedia } from "./static-site";
import type { Article, Site, StaticBuild } from "./types";

const FILE_CAP = 80;
const BASE64_CAP = 2_000_000;

function textBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function uploadAutoBuild(
  site: Site,
  build: StaticBuild,
  articles: Article[],
): Promise<{ ok: true; files: number; host: string; note?: string } | { ok: false; reason: string }> {
  // The connection is whatever the server holds for this workspace: the browser
  // no longer has the password, and its provider card still reads "not_connected"
  // after a verified test. Asking the API is the only check that means anything.
  const saved = await loadFtpCredentials(site.id);
  if (!saved?.has_password) {
    return { ok: false, reason: "Upload skipped. No cPanel connection is saved for this workspace, so the auto-rebuild was recorded and not sent." };
  }
  const textFiles = build.artifact.map((file) => ({
    name: file.name,
    base64: textBase64(file.text),
  }));
  const media = staticMedia(articles);
  let images: { name: string; base64: string }[] = [];
  if (media.length) {
    const packed = await readMediaBatch({ data: { files: media } });
    if (packed.ok) images = packed.files.map((file) => ({ name: `assets/img/${file.name}`, base64: file.base64 }));
  }
  const oversized = [...textFiles, ...images].filter((file) => file.base64.length > BASE64_CAP).map((file) => file.name);
  let files = [...textFiles, ...images].filter((file) => file.base64.length <= BASE64_CAP);
  let note = "";
  if (files.length > FILE_CAP) {
    note = `Kept the first ${FILE_CAP} files.`;
    files = files.slice(0, FILE_CAP);
  }
  if (oversized.length) note = `${note} Left out ${oversized.length} file${oversized.length === 1 ? "" : "s"} over 2MB.`.trim();
  if (!files.length) {
    return { ok: false, reason: "Upload skipped. Every generated file was over the 2MB limit, so nothing was sent." };
  }
  const result = await uploadFtps({
    data: {
      host: saved.host,
      user: saved.username,
      // Blank on purpose: the API opens the password sealed for this workspace.
      password: "",
      port: saved.port || 21,
      path: saved.remote_dir || "/public_html",
      via: "ftps",
      workspace_id: WORKSPACE_ID,
      site_uid: site.id,
      files,
    },
  });
  if (!result.ok) return { ok: false, reason: `Upload failed. ${result.error}` };
  return { ok: true, files: result.files, host: result.host, note: note || undefined };
}
