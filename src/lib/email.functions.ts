import { createServerFn } from "@tanstack/react-start";

function safe(error: unknown): string {
  const msg = error instanceof Error ? error.message : "The email was not sent.";
  return msg.replace(/bearer\s+\S+/gi, "bearer").slice(0, 240);
}

function emailOk(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

export const sendVerificationEmail = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input as { vendor?: string; secret?: string; from?: string; to?: string; verifyUrl?: string } | null;
    const vendor = raw?.vendor === "sendgrid" ? "sendgrid" : raw?.vendor === "resend" ? "resend" : "";
    const secret = String(raw?.secret ?? "").trim();
    const from = String(raw?.from ?? "").trim();
    const to = String(raw?.to ?? "").trim();
    const verifyUrl = String(raw?.verifyUrl ?? "").trim();
    if (!vendor) throw new Error("Choose Resend or SendGrid.");
    if (secret.length < 8 || secret.length > 200) throw new Error("Add an email key before sending.");
    if (!emailOk(from) || !emailOk(to)) throw new Error("From and to must be email addresses.");
    let url: URL;
    try {
      url = new URL(verifyUrl);
    } catch {
      throw new Error("The verification link is not a URL.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("The verification link must be http or https.");
    if (!url.pathname.endsWith("/verify-email") || !url.searchParams.get("token")) {
      throw new Error("The verification link is missing its token.");
    }
    return { vendor, secret, from, to, verifyUrl };
  })
  .handler(async ({ data }) => {
    const text = `Verify ${data.to} for this studio.\n\nOpen this link:\n${data.verifyUrl}\n\nIt expires in 30 minutes. If you did not ask for this, ignore it.`;
    if (data.secret === "preview-resend" || data.secret === "preview-sendgrid") {
      return { ok: true as const, preview: true as const, verifyUrl: data.verifyUrl };
    }
    try {
      if (data.vendor === "resend") {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${data.secret}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: data.from,
            to: [data.to],
            subject: "Verify your studio email",
            text,
          }),
        });
        if (response.status >= 300 && response.status < 400) return { ok: false as const, error: "Resend redirected. Blocked." };
        if (!response.ok) return { ok: false as const, error: `Resend returned HTTP ${response.status}. The email was not sent.` };
        return { ok: true as const, preview: false as const, verifyUrl: data.verifyUrl };
      }
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${data.secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: data.to }] }],
          from: { email: data.from },
          subject: "Verify your studio email",
          content: [{ type: "text/plain", value: text }],
        }),
      });
      if (response.status >= 300 && response.status < 400) return { ok: false as const, error: "SendGrid redirected. Blocked." };
      if (response.status !== 202 && !response.ok) return { ok: false as const, error: `SendGrid returned HTTP ${response.status}. The email was not sent.` };
      return { ok: true as const, preview: false as const, verifyUrl: data.verifyUrl };
    } catch (error) {
      return { ok: false as const, error: safe(error) };
    }
  });

export const sendDigestEmail = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input as { vendor?: string; secret?: string; from?: string; to?: string; body?: string } | null;
    const vendor = raw?.vendor === "sendgrid" ? "sendgrid" : raw?.vendor === "resend" ? "resend" : "";
    const secret = String(raw?.secret ?? "").trim();
    const from = String(raw?.from ?? "").trim();
    const to = String(raw?.to ?? "").trim();
    const body = String(raw?.body ?? "").trim().slice(0, 8000);
    if (!vendor) throw new Error("Choose Resend or SendGrid.");
    if (secret.length < 8 || secret.length > 200) throw new Error("Add an email key before sending a digest.");
    if (!emailOk(from) || !emailOk(to)) throw new Error("From and to must be email addresses.");
    if (body.length < 1) throw new Error("There is nothing to put in the digest.");
    return { vendor, secret, from, to, body };
  })
  .handler(async ({ data }) => {
    if (data.secret === "preview-resend" || data.secret === "preview-sendgrid") {
      return { ok: true as const, preview: true as const, body: data.body };
    }
    const subject = "Studio notification digest";
    try {
      if (data.vendor === "resend") {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${data.secret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: data.from, to: [data.to], subject, text: data.body }),
        });
        if (response.status >= 300 && response.status < 400) return { ok: false as const, error: "Resend redirected. Blocked." };
        if (!response.ok) return { ok: false as const, error: `Resend returned HTTP ${response.status}. The digest was not sent.` };
        return { ok: true as const, preview: false as const, body: data.body };
      }
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${data.secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: data.to }] }],
          from: { email: data.from },
          subject,
          content: [{ type: "text/plain", value: data.body }],
        }),
      });
      if (response.status >= 300 && response.status < 400) return { ok: false as const, error: "SendGrid redirected. Blocked." };
      if (response.status !== 202 && !response.ok) return { ok: false as const, error: `SendGrid returned HTTP ${response.status}. The digest was not sent.` };
      return { ok: true as const, preview: false as const, body: data.body };
    } catch (error) {
      return { ok: false as const, error: safe(error) };
    }
  });
