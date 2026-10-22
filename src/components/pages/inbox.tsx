import { useState } from "react";
import { useApp } from "@/lib/store";
import { Badge, Button, Card, Empty, PageIntro, statusTone } from "@/components/ui";
import { sendDigestEmail } from "@/lib/email.functions";
import { relTime } from "@/lib/utils";

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
    <div className="space-y-4">
      <PageIntro
        eyebrow="Account"
        title="Notifications"
        lede="Notes the studio writes for this website. Nothing arrives here by email. A saved email key can send a digest out."
      />
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "unread", "ok", "info", "warn", "danger"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTone(item)}
            className={`min-h-11 rounded-full px-4 text-sm ${tone === item ? "bg-brass text-ink" : "border border-line text-muted"}`}
          >
            {item}
            {item === "unread" ? ` ${unread.length}` : ""}
          </button>
        ))}
        <Button variant="ghost" onClick={() => markActivityReadAll(siteId)}>
          Mark all read
        </Button>
        <Button disabled={!hasKey || sending} onClick={() => void sendDigest()}>
          {sending ? "Sending…" : "Email digest"}
        </Button>
      </div>
      {!hasKey ? <p className="text-sm text-muted">Add an email key on Account to send a digest.</p> : null}
      {note ? <p className="text-sm text-muted">{note}</p> : null}
      {digest ? (
        <Card className="p-4 text-sm leading-6">
          <p className="font-medium">To {account.email}</p>
          <p className="text-muted">Subject: Studio notification digest</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans">{digest}</pre>
        </Card>
      ) : null}
      {!rows.length ? (
        <Empty title="No notifications" body="Runs, syncs, and link passes land here. They are not incoming mail." />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <span className="flex items-start gap-2">
                  <Badge tone={statusTone(item.tone === "ok" ? "completed" : item.tone === "danger" ? "failed" : item.tone === "warn" ? "queued" : "draft")}>
                    {item.tone}
                  </Badge>
                  <button type="button" className="text-left" onClick={() => markActivityRead(item.id)}>
                    <span className={item.read ? "text-muted" : "text-fg"}>{item.message}</span>
                    <span className="mt-1 block text-xs text-faint">{item.read ? "Read" : "Unread"} · click to mark read</span>
                  </button>
                </span>
                <span className="shrink-0 text-xs text-faint">{relTime(item.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
