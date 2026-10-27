import { useState, type ReactNode } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button, Card, PageIntro } from "@/components/ui";
import { sendDigestEmail } from "@/lib/email.functions";
import { relTime } from "@/lib/utils";

function Pill({ tone = "muted", children }: { tone?: "ok" | "danger" | "warn" | "muted"; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${
        tone === "ok"
          ? "border-ok/30 bg-ok/10 text-ok"
          : tone === "danger"
            ? "border-danger/30 bg-danger/10 text-danger"
            : tone === "warn"
              ? "border-warn/30 bg-warn/10 text-warn"
              : "border-line bg-surface text-muted"
      }`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function InboxPage() {
  const activity = useApp((s) => s.activity);
  const siteId = useApp((s) => s.activeSiteId);
  const account = useApp((s) => s.account);
  const markActivityRead = useApp((s) => s.markActivityRead);
  const markActivityReadAll = useApp((s) => s.markActivityReadAll);
  const [tone, setTone] = useState<"all" | "ok" | "warn" | "danger" | "info" | "unread">("all");
  const [note, setNote] = useState("");
  const [digest, setDigest] = useState("");
  const [sending, setSending] = useState(false);
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
      ...source.map((item) => `${new Date(item.at).toISOString().slice(0, 16)}  ${item.tone}  ${item.message}`),
    ].join("\n");
    setSending(true);
    setNote("Sending the digest…");
    const result = await sendDigestEmail({
      data: { vendor: key.vendor, secret: key.secret, from: key.from, to: account.email, body },
    });
    setSending(false);
    if (!result.ok) {
      setDigest("");
      setNote(result.error);
      return;
    }
    setDigest(result.body);
    setNote(result.preview ? "Preview digest ready. No email provider was called." : `Digest sent to ${account.email}.`);
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Account"
        title="Notifications"
        lede="Notes the studio writes for this website. Nothing arrives here by email. A saved email key can send a digest out."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => markActivityReadAll(siteId)}>
              Mark all read
            </Button>
            <Button disabled={!hasKey || sending} onClick={() => void sendDigest()}>
              {sending ? "Sending…" : "Email digest"}
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1">
        {(["all", "unread", "ok", "info", "warn", "danger"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTone(item)}
            className={`h-7 rounded-full border px-3 text-[12px] font-medium transition-colors duration-150 ${
              tone === item
                ? "border-brass/30 bg-brass/10 text-fg"
                : "border-transparent text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {item}
            {item === "unread" ? ` ${unread.length}` : ""}
          </button>
        ))}
      </div>
      {!hasKey ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px] text-muted">Add an email key on Account to send a digest.</p>
      ) : null}
      {note ? <p className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px] text-muted">{note}</p> : null}
      {digest ? (
        <Card className="rounded-xl p-0">
          <div className="border-b border-line px-5 py-3.5">
            <div className="text-[13px] font-medium text-fg">To {account.email}</div>
            <div className="mt-0.5 text-[12px] text-faint">Subject: Studio notification digest</div>
          </div>
          <pre className="whitespace-pre-wrap px-5 py-4 font-mono text-[11px] leading-6 text-muted">{digest}</pre>
        </Card>
      ) : null}
      {!rows.length ? (
        <div className="rounded-xl border border-line bg-elev px-6 py-16 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-lg bg-surface-2 text-faint">
            <InboxIcon aria-hidden="true" strokeWidth={1.6} className="size-5" />
          </span>
          <h2 className="mt-4 font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">No notifications</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-muted">
            Runs, syncs, and link passes land here. They are not incoming mail.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-xl p-0">
          <ul className="divide-y divide-line">
            {rows.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-3 px-5 py-3.5 text-[13px] transition-colors duration-150 hover:bg-surface-2/60 ${
                  item.read ? "" : "bg-surface-2/40"
                }`}
              >
                <Pill
                  tone={item.tone === "ok" ? "ok" : item.tone === "danger" ? "danger" : item.tone === "warn" ? "warn" : "muted"}
                >
                  {item.tone}
                </Pill>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => markActivityRead(item.id)}>
                  <span className={item.read ? "text-muted" : "text-fg"}>{item.message}</span>
                  <span className="mt-0.5 block text-[11px] text-faint">{item.read ? "Read" : "Unread"} · click to mark read</span>
                </button>
                <span className="num shrink-0 text-[11px] text-faint">{relTime(item.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
