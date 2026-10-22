import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/images.functions-DEfem_pV.js
function readSlots(input) {
	const raw = input;
	const provider = raw?.provider === "wikimedia" ? "wikimedia" : "bing";
	const clean = (Array.isArray(raw?.slots) ? raw.slots : []).slice(0, 4).map((slot) => ({
		query: String(slot?.query ?? "").slice(0, 140),
		alt: String(slot?.alt ?? "").slice(0, 180),
		role: slot?.role === "section" ? "section" : "featured",
		width: Number(slot?.width) > 0 ? Math.min(1600, Math.round(Number(slot.width))) : void 0,
		height: Number(slot?.height) > 0 ? Math.min(1200, Math.round(Number(slot.height))) : void 0
	}));
	const avoid = Array.isArray(raw?.avoid) ? raw.avoid.map((item) => String(item).slice(0, 40)).slice(0, 400) : [];
	const salt = Number.isFinite(raw?.salt) ? Math.max(0, Math.min(9999, Math.round(Number(raw?.salt)))) : 0;
	return {
		provider,
		slots: clean.filter((slot) => slot.query.trim().length > 2),
		avoid,
		salt
	};
}
var placeImages_createServerFn_handler = createServerRpc({
	id: "72411befe807a697430999c9a0e7fe15c0c283d27fdcbe33022a361f880225d2",
	name: "placeImages",
	filename: "src/lib/images.functions.ts"
}, (opts) => placeImages.__executeServer(opts));
var placeImages = createServerFn({ method: "POST" }).validator(readSlots).handler(placeImages_createServerFn_handler, async ({ data }) => {
	if (!data.slots.length) return {
		ok: true,
		images: []
	};
	const { placeImageSlots } = await import("./image-fetch-Ckae3m-H.mjs");
	return {
		ok: true,
		images: await placeImageSlots(data.slots, data.provider, data.avoid, data.salt)
	};
});
var readMediaBatch_createServerFn_handler = createServerRpc({
	id: "aa779ce342c918b49010f0d8081196c3a91885cd6f69519f9eff6fb2e06dfa75",
	name: "readMediaBatch",
	filename: "src/lib/images.functions.ts"
}, (opts) => readMediaBatch.__executeServer(opts));
var readMediaBatch = createServerFn({ method: "POST" }).validator((input) => {
	return { files: (input?.files ?? []).slice(0, 24).map((file) => ({
		name: String(file.name ?? ""),
		remote: typeof file.remote === "string" ? file.remote : void 0
	})) };
}).handler(readMediaBatch_createServerFn_handler, async ({ data }) => {
	const out = [];
	const { readMediaFile } = await import("./image-fetch-Ckae3m-H.mjs");
	for (const file of data.files) {
		const hit = await readMediaFile(file.name, file.remote);
		if (!hit) continue;
		out.push({
			name: hit.name,
			base64: hit.bytes.toString("base64")
		});
	}
	return {
		ok: true,
		files: out
	};
});
//#endregion
export { placeImages_createServerFn_handler, readMediaBatch_createServerFn_handler };
