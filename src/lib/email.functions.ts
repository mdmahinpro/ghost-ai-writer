import { post } from "./api-client";

/**
 * Verification and digest email, sent by the Rust API.
 *
 * These were server functions; with the static build there is no Node server, so
 * the vendor call happens in `email.rs`. The operator's provider key still
 * travels with the request and is never stored — the API uses it for that one
 * send and discards it. The two `preview-*` sentinels stay client-side: they
 * exist so the flow can be walked without a provider key.
 */
function emailOk(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

type EmailInput = {
  vendor?: string;
  secret?: string;
  from?: string;
  to?: string;
  verifyUrl?: string;
  body?: string;
};

function readVendor(raw: EmailInput | null): "resend" | "sendgrid" | "" {
  if (raw?.vendor === "sendgrid") return "sendgrid";
  if (raw?.vendor === "resend") return "resend";
  return "";
}

export async function sendVerificationEmail(input: { data: EmailInput }): Promise<
  | { ok: true; preview: boolean; verifyUrl: string }
  | { ok: false; error: string }
> {
  const raw = input?.data ?? {};
  const vendor = readVendor(raw);
  const secret = String(raw.secret ?? "").trim();
  const from = String(raw.from ?? "").trim();
  const to = String(raw.to ?? "").trim();
  const verifyUrl = String(raw.verifyUrl ?? "").trim();
  if (!vendor) return { ok: false, error: "Choose Resend or SendGrid." };
  if (secret.length < 8 || secret.length > 200) {
    return { ok: false, error: "Add an email key before sending." };
  }
  if (!emailOk(from) || !emailOk(to)) {
    return { ok: false, error: "From and to must be email addresses." };
  }
  let url: URL;
  try {
    url = new URL(verifyUrl);
  } catch {
    return { ok: false, error: "The verification link is not a URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "The verification link must be http or https." };
  }
  if (!url.pathname.endsWith("/verify-email") || !url.searchParams.get("token")) {
    return { ok: false, error: "The verification link is missing its token." };
  }
  if (secret === "preview-resend" || secret === "preview-sendgrid") {
    return { ok: true, preview: true, verifyUrl };
  }
  const res = await post<unknown>("/api/v1/email/verification", {
    vendor,
    secret,
    from,
    to,
    verify_url: verifyUrl,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, preview: false, verifyUrl };
}

export async function sendDigestEmail(input: { data: EmailInput }): Promise<
  { ok: true; preview: boolean; body: string } | { ok: false; error: string }
> {
  const raw = input?.data ?? {};
  const vendor = readVendor(raw);
  const secret = String(raw.secret ?? "").trim();
  const from = String(raw.from ?? "").trim();
  const to = String(raw.to ?? "").trim();
  const body = String(raw.body ?? "").trim().slice(0, 8000);
  if (!vendor) return { ok: false, error: "Choose Resend or SendGrid." };
  if (secret.length < 8 || secret.length > 200) {
    return { ok: false, error: "Add an email key before sending a digest." };
  }
  if (!emailOk(from) || !emailOk(to)) {
    return { ok: false, error: "From and to must be email addresses." };
  }
  if (!body.length) return { ok: false, error: "There is nothing to put in the digest." };
  if (secret === "preview-resend" || secret === "preview-sendgrid") {
    return { ok: true, preview: true, body };
  }
  const res = await post<unknown>("/api/v1/email/digest", { vendor, secret, from, to, body });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, preview: false, body };
}
