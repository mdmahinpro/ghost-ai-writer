import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useApp, useHydrated } from "@/lib/store";
import { Button, Card, Field, PageIntro, fieldClass } from "@/components/ui";
import { relTime } from "@/lib/utils";
import { lockStudio } from "@/lib/vault";
import { sendVerificationEmail } from "@/lib/email.functions";
import type { EmailProviderConfig } from "@/lib/types";

export function AccountPage() {
  const account = useApp((s) => s.account);
  const activity = useApp((s) => s.activity);
  const patchAccount = useApp((s) => s.patchAccount);
  const revokeSession = useApp((s) => s.revokeSession);
  const confirmPassphrase = useApp((s) => s.confirmPassphrase);
  const resetStudio = useApp((s) => s.resetStudio);
  const hydrated = useHydrated();
  const [pass, setPass] = useState("");
  const [vendor, setVendor] = useState<EmailProviderConfig["vendor"]>(account.emailProvider?.vendor ?? "resend");
  const [from, setFrom] = useState(account.emailProvider?.from ?? "");
  const [secret, setSecret] = useState("");
  const [mailNote, setMailNote] = useState("");
  const [mailUrl, setMailUrl] = useState("");
  const [sending, setSending] = useState(false);
  const started = useRef(false);
  const savedKey = account.emailProvider?.secret ?? "";
  const previewKey = savedKey === "preview-resend" || savedKey === "preview-sendgrid";

  const sendMail = useCallback(async () => {
    const provider = useApp.getState().account.emailProvider;
    const email = useApp.getState().account.email.trim();
    if (!provider?.secret || !provider.from) {
      setMailNote("Add an email key to send a verification email.");
      return;
    }
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const verifyUrl = `${window.location.origin}/verify-email?token=${token}`;
    patchAccount({ emailVerifyToken: token, emailVerifyExpires: Date.now() + 30 * 60 * 1000 });
    setSending(true);
    setMailNote(previewKey ? "Writing the preview letter…" : "Sending the verification email…");
    const result = await sendVerificationEmail({
      data: { vendor: provider.vendor, secret: provider.secret, from: provider.from, to: email, verifyUrl },
    });
    setSending(false);
    if (!result.ok) {
      patchAccount({ emailVerifyToken: "", emailVerifyExpires: 0 });
      setMailUrl("");
      setMailNote(result.error);
      return;
    }
    setMailUrl(verifyUrl);
    setMailNote(result.preview ? "Preview letter ready. No email provider was called. Open the link to verify." : `Verification email sent to ${email}. Open the link in that message.`);
  }, [patchAccount, previewKey]);

  useEffect(() => {
    if (!hydrated || started.current || account.emailVerified || !previewKey || account.emailVerifyToken) return;
    started.current = true;
    void sendMail();
  }, [hydrated, account.emailVerified, account.emailVerifyToken, previewKey, sendMail]);
  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Account"
        title="Operator"
        lede="This studio is one operator on this browser. Spend stays in the usage ledger. Notifications stay here unless you email a digest."
      />
      <Card className="grid gap-3 p-5 md:grid-cols-2">
        <Field label="Name">
          <input className={fieldClass} value={account.name} onChange={(e) => patchAccount({ name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={fieldClass} value={account.email} onChange={(e) => patchAccount({ email: e.target.value, emailVerified: false })} />
        </Field>
        <p className="text-sm text-muted md:col-span-2">
          Email {account.emailVerified ? "verified" : "needs verification"} · Admin {account.adminApproved ? "approved" : "waiting"}
        </p>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <button
            type="button"
            role="switch"
            aria-checked={account.adminApproved}
            onClick={() => patchAccount({ adminApproved: !account.adminApproved })}
            className={`min-h-11 rounded-full px-4 text-sm ${account.adminApproved ? "bg-brass text-ink" : "border border-line text-muted"}`}
          >
            {account.adminApproved ? "Operator approved" : "Operator not approved"}
          </button>
          <p className="max-w-xl text-xs leading-5 text-faint">
            This switch starts off. Flip it only if you mean to mark this operator approved. It is not a multi-user approval gate.
          </p>
        </div>
      </Card>
      <Card className="grid gap-3 p-5">
        <h2 className="font-display text-2xl">Verification email</h2>
        <p className="text-sm text-muted">
          The key stays in this browser. Resend and SendGrid are called only when you send. A preview key writes the letter here and does not call them.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Provider">
            <select className={fieldClass} value={vendor} onChange={(e) => setVendor(e.target.value as EmailProviderConfig["vendor"])}>
              <option value="resend">Resend</option>
              <option value="sendgrid">SendGrid</option>
            </select>
          </Field>
          <Field label="From address">
            <input className={fieldClass} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="studio@yourdomain.com" />
          </Field>
          <Field label="API key" hint={savedKey ? (previewKey ? "Preview key saved. It does not call the provider." : "A key is saved. Paste a new one to replace it.") : "Add an email key to send a verification email."}>
            <input className={fieldClass} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={savedKey ? "Saved — paste to replace" : "re_… or SG.…"} autoComplete="off" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={!from.includes("@") || secret.trim().length < 8}
            onClick={() => {
              patchAccount({ emailProvider: { vendor, from: from.trim(), secret: secret.trim() } });
              setSecret("");
              setMailNote("Email key saved in this browser.");
            }}
          >
            Save email key
          </Button>
          {savedKey ? (
            <Button
              variant="ghost"
              onClick={() => {
                patchAccount({ emailProvider: { vendor, from: from.trim(), secret: "" }, emailVerifyToken: "", emailVerifyExpires: 0 });
                setMailUrl("");
                setMailNote("Add an email key to send a verification email.");
              }}
            >
              Remove email key
            </Button>
          ) : null}
          <Button disabled={!savedKey || account.emailVerified || sending} onClick={() => void sendMail()}>
            {account.emailVerified ? "Email verified" : sending ? "Sending…" : "Send verification email"}
          </Button>
        </div>
        {!savedKey ? <p className="text-sm text-muted">Add an email key to send a verification email.</p> : null}
        {mailNote ? <p className="text-sm text-muted">{mailNote}</p> : null}
        {mailUrl ? (
          <div className="rounded-lg border border-line bg-surface p-4 text-sm leading-6">
            <p className="font-medium">To {account.email}</p>
            <p className="text-muted">Subject: Verify your studio email</p>
            <p className="mt-2">Open this link to verify. It expires in 30 minutes.</p>
            <Link to="/verify-email" search={{ token: new URL(mailUrl).searchParams.get("token") ?? "" }} className="mt-2 block break-all text-brass-2">
              {mailUrl}
            </Link>
          </div>
        ) : null}
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-2xl">Passphrase</h2>
        <p className="mt-2 text-sm text-muted">
          Confirming encrypts the saved studio with this passphrase. Only a salt and a check are stored. The passphrase itself is not.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${fieldClass} max-w-sm`} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
          <Button
            disabled={pass.length < 8}
            onClick={() => {
              void confirmPassphrase(pass).then(() => setPass(""));
            }}
          >
            Confirm
          </Button>
          {account.passwordUpdatedAt ? (
            <Button
              variant="ghost"
              onClick={() => {
                lockStudio();
                window.location.reload();
              }}
            >
              Lock
            </Button>
          ) : null}
        </div>
        {account.passwordUpdatedAt ? <p className="mt-2 text-xs text-faint">Last confirmed {relTime(account.passwordUpdatedAt)}. A reload asks for the passphrase. IndexedDB then holds ciphertext, not the studio JSON.</p> : null}
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-2xl">Sessions</h2>
        <ul className="mt-3 divide-y divide-line">
          {account.sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>
                {session.label}
                {session.current ? " · current" : ""}
                <span className="block text-xs text-faint">{relTime(session.seenAt)}</span>
              </span>
              {session.current ? null : (
                <Button variant="ghost" onClick={() => revokeSession(session.id)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-2xl">Activity</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {activity.slice(0, 8).map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.message}</span>
              <span className="shrink-0 text-xs text-faint">{relTime(item.at)}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-4" variant="danger" onClick={resetStudio}>
          Reset studio sample
        </Button>
      </Card>
    </div>
  );
}
