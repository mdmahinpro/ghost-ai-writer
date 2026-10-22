import { i as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { h as useHydrated, m as useApp } from "./store-CO3BA3x3.mjs";
import { N as Button, P as Card, c as Route$15 } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/verify-email-lytm8R43.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function VerifyEmailPage() {
	const { token } = Route$15.useSearch();
	const hydrated = useHydrated();
	const patchAccount = useApp((s) => s.patchAccount);
	const [result, setResult] = (0, import_react.useState)("wait");
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		const account = useApp.getState().account;
		if (!token || token !== account.emailVerifyToken) {
			setResult("bad");
			return;
		}
		if (!account.emailVerifyExpires || account.emailVerifyExpires < Date.now()) {
			setResult("expired");
			return;
		}
		patchAccount({
			emailVerified: true,
			emailVerifyToken: "",
			emailVerifyExpires: 0
		});
		setResult("ok");
	}, [
		hydrated,
		token,
		patchAccount
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mx-auto max-w-lg p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl",
					children: "Email verification"
				}),
				result === "wait" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted",
					children: "Checking the link…"
				}) : null,
				result === "ok" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-ok",
					children: "This email is verified. The link matched the token that was sent."
				}) : null,
				result === "bad" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-danger",
					children: "This link does not match a verification token on this browser. The email was not marked verified."
				}) : null,
				result === "expired" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-danger",
					children: "This link has expired. Send a new one from Account. The email was not marked verified."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/account",
					className: "mt-4 inline-flex",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						children: "Back to account"
					})
				})
			]
		})
	});
}
//#endregion
export { VerifyEmailPage as component };
