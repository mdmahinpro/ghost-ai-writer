import { t as createServerFn } from "./ssr.mjs";
import { t as createSsrRpc } from "./ops.functions-CQ9mdiWn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/email.functions-DA6e4dx8.js
function emailOk(value) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}
var sendVerificationEmail = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input;
	const vendor = raw?.vendor === "sendgrid" ? "sendgrid" : raw?.vendor === "resend" ? "resend" : "";
	const secret = String(raw?.secret ?? "").trim();
	const from = String(raw?.from ?? "").trim();
	const to = String(raw?.to ?? "").trim();
	const verifyUrl = String(raw?.verifyUrl ?? "").trim();
	if (!vendor) throw new Error("Choose Resend or SendGrid.");
	if (secret.length < 8 || secret.length > 200) throw new Error("Add an email key before sending.");
	if (!emailOk(from) || !emailOk(to)) throw new Error("From and to must be email addresses.");
	let url;
	try {
		url = new URL(verifyUrl);
	} catch {
		throw new Error("The verification link is not a URL.");
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("The verification link must be http or https.");
	if (!url.pathname.endsWith("/verify-email") || !url.searchParams.get("token")) throw new Error("The verification link is missing its token.");
	return {
		vendor,
		secret,
		from,
		to,
		verifyUrl
	};
}).handler(createSsrRpc("f7c3deb7062fc5286d9991956c81bbc1600449cdd57d1c7a01ae2ecc1ad6f880"));
var sendDigestEmail = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input;
	const vendor = raw?.vendor === "sendgrid" ? "sendgrid" : raw?.vendor === "resend" ? "resend" : "";
	const secret = String(raw?.secret ?? "").trim();
	const from = String(raw?.from ?? "").trim();
	const to = String(raw?.to ?? "").trim();
	const body = String(raw?.body ?? "").trim().slice(0, 8e3);
	if (!vendor) throw new Error("Choose Resend or SendGrid.");
	if (secret.length < 8 || secret.length > 200) throw new Error("Add an email key before sending a digest.");
	if (!emailOk(from) || !emailOk(to)) throw new Error("From and to must be email addresses.");
	if (body.length < 1) throw new Error("There is nothing to put in the digest.");
	return {
		vendor,
		secret,
		from,
		to,
		body
	};
}).handler(createSsrRpc("ccf86c9e777182408b98537975a02c3c4eb4b137fdf073d38c3d96aba8553d08"));
//#endregion
export { sendVerificationEmail as n, sendDigestEmail as t };
