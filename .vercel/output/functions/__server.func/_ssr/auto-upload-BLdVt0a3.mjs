import { At as staticMedia } from "./engine-DWsB6FrJ.mjs";
import { l as uploadFtps, o as readMediaBatch } from "./ops.functions-CQ9mdiWn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auto-upload-BLdVt0a3.js
var FILE_CAP = 80;
var BASE64_CAP = 2e6;
function textBase64(text) {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}
async function uploadAutoBuild(site, build, articles) {
	const ftp = site.providers.find((provider) => provider.id === "cpanel" && provider.status === "verified")?.ftp;
	if (!ftp?.host || !ftp.user || !ftp.password) return {
		ok: false,
		reason: "Upload skipped. cPanel hosting is not verified, so the auto-rebuild was recorded and not sent."
	};
	const textFiles = build.artifact.map((file) => ({
		name: file.name,
		base64: textBase64(file.text)
	}));
	const media = staticMedia(articles);
	let images = [];
	if (media.length) {
		const packed = await readMediaBatch({ data: { files: media } });
		if (packed.ok) images = packed.files.map((file) => ({
			name: `assets/img/${file.name}`,
			base64: file.base64
		}));
	}
	const oversized = [...textFiles, ...images].filter((file) => file.base64.length > BASE64_CAP).map((file) => file.name);
	let files = [...textFiles, ...images].filter((file) => file.base64.length <= BASE64_CAP);
	let note = "";
	if (files.length > FILE_CAP) {
		note = `Kept the first ${FILE_CAP} files.`;
		files = files.slice(0, FILE_CAP);
	}
	if (oversized.length) note = `${note} Left out ${oversized.length} file${oversized.length === 1 ? "" : "s"} over 2MB.`.trim();
	if (!files.length) return {
		ok: false,
		reason: "Upload skipped. Every generated file was over the 2MB limit, so nothing was sent."
	};
	const result = await uploadFtps({ data: {
		host: ftp.host,
		user: ftp.user,
		password: ftp.password,
		port: ftp.port || 21,
		path: ftp.path || "/",
		via: ftp.via || "ftps",
		files
	} });
	if (!result.ok) return {
		ok: false,
		reason: `Upload failed. ${result.error}`
	};
	return {
		ok: true,
		files: result.files,
		host: ftp.host,
		note: note || void 0
	};
}
//#endregion
export { uploadAutoBuild };
