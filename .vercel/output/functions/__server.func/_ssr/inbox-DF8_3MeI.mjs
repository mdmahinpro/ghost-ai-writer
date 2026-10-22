import { i as __toESM } from "../_runtime.mjs";
import { bt as relTime } from "./engine-DWsB6FrJ.mjs";
import { C as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as useApp } from "./store-CO3BA3x3.mjs";
import { t as sendDigestEmail } from "./email.functions-DA6e4dx8.mjs";
import { F as Empty, H as statusTone, L as PageIntro, M as Badge, N as Button, P as Card } from "./router-DMHI1rJE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/inbox-DF8_3MeI.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function InboxPage() {
	const activity = useApp((s) => s.activity);
	const siteId = useApp((s) => s.activeSiteId);
	const account = useApp((s) => s.account);
	const markActivityRead = useApp((s) => s.markActivityRead);
	const markActivityReadAll = useApp((s) => s.markActivityReadAll);
	const [tone, setTone] = (0, import_react.useState)("all");
	const [note, setNote] = (0, import_react.useState)("");
	const [digest, setDigest] = (0, import_react.useState)("");
	const [sending, setSending] = (0, import_react.useState)(false);
	const rows = activity.filter((item) => {
		if (item.siteId !== siteId) return false;
		if (tone === "all") return true;
		if (tone === "unread") return !item.read;
		return item.tone === tone;
	});
	const unread = activity.filter((item) => item.siteId === siteId && !item.read);
	const key = account.emailProvider;
	const hasKey = Boolean(key?.secret && key.from);
	async function sendDigest() {
		if (!key?.secret || !key.from) {
			setNote("Add an email key on Account to send a digest.");
			return;
		}
		const source = unread.length ? unread : activity.filter((item) => item.siteId === siteId).slice(0, 12);
		if (!source.length) {
			setNote("There are no notifications to send.");
			return;
		}
		const body = [
			`Notification digest for ${account.email}`,
			"This is an outbound note. This studio does not receive email.",
			"",
			...source.map((item) => `${new Date(item.at).toISOString().slice(0, 16)}  ${item.tone}  ${item.message}`)
		].join("\n");
		setSending(true);
		setNote("Sending the digest…");
		const result = await sendDigestEmail({ data: {
			vendor: key.vendor,
			secret: key.secret,
			from: key.from,
			to: account.email,
			body
		} });
		setSending(false);
		if (!result.ok) {
			setDigest("");
			setNote(result.error);
			return;
		}
		setDigest(result.body);
		setNote(result.preview ? "Preview digest ready. No email provider was called." : `Digest sent to ${account.email}.`);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
				eyebrow: "Account",
				title: "Notifications",
				lede: "Notes the studio writes for this website. Nothing arrives here by email. A saved email key can send a digest out."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					[
						"all",
						"unread",
						"ok",
						"info",
						"warn",
						"danger"
					].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setTone(item),
						className: `min-h-11 rounded-full px-4 text-sm ${tone === item ? "bg-brass text-ink" : "border border-line text-muted"}`,
						children: [item, item === "unread" ? ` ${unread.length}` : ""]
					}, item)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => markActivityReadAll(siteId),
						children: "Mark all read"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						disabled: !hasKey || sending,
						onClick: () => void sendDigest(),
						children: sending ? "Sending…" : "Email digest"
					})
				]
			}),
			!hasKey ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Add an email key on Account to send a digest."
			}) : null,
			note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: note
			}) : null,
			digest ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-4 text-sm leading-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-medium",
						children: ["To ", account.email]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: "Subject: Studio notification digest"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-3 whitespace-pre-wrap font-sans",
						children: digest
					})
				]
			}) : null,
			!rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, {
				title: "No notifications",
				body: "Runs, syncs, and link passes land here. They are not incoming mail."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-line",
				children: rows.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-start justify-between gap-3 px-4 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-start gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: statusTone(item.tone === "ok" ? "completed" : item.tone === "danger" ? "failed" : item.tone === "warn" ? "queued" : "draft"),
							children: item.tone
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "text-left",
							onClick: () => markActivityRead(item.id),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: item.read ? "text-muted" : "text-fg",
								children: item.message
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mt-1 block text-xs text-faint",
								children: [item.read ? "Read" : "Unread", " · click to mark read"]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0 text-xs text-faint",
						children: relTime(item.at)
					})]
				}, item.id))
			}) })
		]
	});
}
var SplitComponent = InboxPage;
//#endregion
export { SplitComponent as component };
