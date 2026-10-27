import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useApp, useHydrated } from "@/lib/store";
import { Button, PageIntro, fieldClass } from "@/components/ui";
import { relTime } from "@/lib/utils";
import { lockStudio } from "@/lib/vault";
import { sendVerificationEmail } from "@/lib/email.functions";
import type { EmailProviderConfig } from "@/lib/types";

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        {hint ? <p className="mt-0.5 max-w-xl text-[12px] leading-5 text-muted">{hint}</p> : null}
      </div>
      <div className="w-full shrink-0 sm:w-64">{children}</div>
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-b border-line px-5 py-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
      {hint ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

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
    <div className="space-y-5">
      <PageIntro
        eyebrow="Account"
        title="Operator"
        lede="This studio is one operator on this browser. Spend stays in the usage ledger. Notifications stay here unless you email a digest."
      />
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="divide-y divide-line">
          <SettingRow label="Name">
            <input className={fieldClass} value={account.name} onChange={(e) => patchAccount({ name: e.target.value })} />
          </SettingRow>
          <SettingRow label="Email">
            <input className={fieldClass} value={account.email} onChange={(e) => patchAccount({ email: e.target.value, emailVerified: false })} />
          </SettingRow>
        </div>
        <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] text-fg">
              Email {account.emailVerified ? "verified" : "needs verification"} · Admin {account.adminApproved ? "approved" : "waiting"}
            </p>
            <p className="mt-1 max-w-xl text-[12px] leading-5 text-muted">
              This switch starts off. Flip it only if you mean to mark this operator approved. It is not a multi-user approval gate.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={account.adminApproved}
            onClick={() => patchAccount({ adminApproved: !account.adminApproved })}
            className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12px] font-medium transition-colors duration-150 ${
              account.adminApproved ? "border-accent bg-accent text-ink" : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg"
            }`}
          >
            <span aria-hidden="true" className={`size-1.5 rounded-full ${account.adminApproved ? "bg-ink" : "bg-faint"}`} />
            {account.adminApproved ? "Operator approved" : "Operator not approved"}
          </button>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <SectionHead title="Verification email" hint="The key stays in this browser. Resend and SendGrid are called only when you send. A preview key writes the letter here and does not call them." />
        <div className="divide-y divide-line">
          <SettingRow label="Provider">
            <select className={fieldClass} value={vendor} onChange={(e) => setVendor(e.target.value as EmailProviderConfig["vendor"])}>
              <option value="resend">Resend</option>
              <option value="sendgrid">SendGrid</option>
            </select>
          </SettingRow>
          <SettingRow label="From address">
            <input className={fieldClass} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="studio@yourdomain.com" />
          </SettingRow>
          <SettingRow label="API key" hint={savedKey ? (previewKey ? "Preview key saved. It does not call the provider." : "A key is saved. Paste a new one to replace it.") : "Add an email key to send a verification email."}>
            <input className={fieldClass} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={savedKey ? "Saved — paste to replace" : "re_… or SG.…"} autoComplete="off" />
          </SettingRow>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
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
              size="sm"
              onClick={() => {
                patchAccount({ emailProvider: { vendor, from: from.trim(), secret: "" }, emailVerifyToken: "", emailVerifyExpires: 0 });
                setMailUrl("");
                setMailNote("Add an email key to send a verification email.");
              }}
            >
              Remove email key
            </Button>
          ) : null}
          <Button size="sm" disabled={!savedKey || account.emailVerified || sending} onClick={() => void sendMail()}>
            {account.emailVerified ? "Email verified" : sending ? "Sending…" : "Send verification email"}
          </Button>
        </div>
        {!savedKey ? <p className="border-t border-line px-5 py-3 text-[13px] text-muted">Add an email key to send a verification email.</p> : null}
        {mailNote ? <p className="border-t border-line px-5 py-3 text-[13px] text-muted">{mailNote}</p> : null}
        {mailUrl ? (
          <div className="border-t border-line px-5 py-4">
            <div className="rounded-lg border border-line bg-surface p-4 text-[13px] leading-6">
              <p className="font-medium text-fg">To {account.email}</p>
              <p className="text-muted">Subject: Verify your studio email</p>
              <p className="mt-2 text-fg">Open this link to verify. It expires in 30 minutes.</p>
              <Link to="/verify-email" search={{ token: new URL(mailUrl).searchParams.get("token") ?? "" }} className="mt-2 block break-all font-mono text-[12px] text-brass-2 underline-offset-4 hover:underline">
                {mailUrl}
              </Link>
            </div>
          </div>
        ) : null}
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <SectionHead title="Passphrase" hint="Confirming encrypts the saved studio with this passphrase. Only a salt and a check are stored. The passphrase itself is not." />
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
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
        {account.passwordUpdatedAt ? <p className="border-t border-line px-5 py-3 text-[11px] leading-5 text-faint">Last confirmed {relTime(account.passwordUpdatedAt)}. A reload asks for the passphrase. IndexedDB then holds ciphertext, not the studio JSON.</p> : null}
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <SectionHead title="Sessions" />
        <ul className="divide-y divide-line">
          {account.sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-surface-2/60">
              <span className="min-w-0 text-[13px] text-fg">
                {session.label}
                {session.current ? " · current" : ""}
                <span className="num mt-0.5 block text-[10px] text-faint">{relTime(session.seenAt)}</span>
              </span>
              {session.current ? null : (
                <Button variant="ghost" size="sm" onClick={() => revokeSession(session.id)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <SectionHead title="Activity" />
        <ul className="divide-y divide-line">
          {activity.slice(0, 8).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
              <span className="min-w-0 text-muted">{item.message}</span>
              <span className="num shrink-0 text-[10px] text-faint">{relTime(item.at)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-5 py-3">
          <Button variant="danger" size="sm" onClick={resetStudio}>
            Reset studio sample
          </Button>
        </div>
      </section>
    </div>
  );
}
