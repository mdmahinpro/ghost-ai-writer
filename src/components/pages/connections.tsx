import { useMemo, useRef, useState } from "react";
import { maskKey, validateGhostUrl } from "@/lib/engine";
import { syncGhostPosts, testGhostConnection } from "@/lib/ghost.functions";
import { testFtpLogin, type FtpStep } from "@/lib/ops.functions";
import { useApp } from "@/lib/store";
import { Badge, Button, Card, Field, PageIntro, fieldClass, statusTone } from "@/components/ui";
import { relTime } from "@/lib/utils";

export function ConnectionsPage() {
  const siteId = useApp((s) => s.activeSiteId);
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]!);
  const auditsAll = useApp((s) => s.audits);
  const audits = useMemo(() => auditsAll.filter((audit) => audit.siteId === siteId), [auditsAll, siteId]);
  const connectStudio = useApp((s) => s.connectStudio);
  const disconnectGhost = useApp((s) => s.disconnectGhost);
  const markLive = useApp((s) => s.markLive);
  const failGhost = useApp((s) => s.failGhost);
  const beginStudioSync = useApp((s) => s.beginStudioSync);
  const applyLiveInventory = useApp((s) => s.applyLiveInventory);
  const auditNow = useApp((s) => s.auditNow);
  const toggleProposal = useApp((s) => s.toggleProposal);
  const applyProposals = useApp((s) => s.applyProposals);
  const verifyProvider = useApp((s) => s.verifyProvider);
  const saveFtp = useApp((s) => s.saveFtp);
  const disconnectProvider = useApp((s) => s.disconnectProvider);
  const [ftpHost, setFtpHost] = useState("");
  const [ftpUser, setFtpUser] = useState("");
  const [ftpPass, setFtpPass] = useState("");
  const [ftpPort, setFtpPort] = useState("21");
  const [ftpPath, setFtpPath] = useState("/");
  const [ftpPublic, setFtpPublic] = useState("");
  const [ftpNote, setFtpNote] = useState("");
  const [ftpTone, setFtpTone] = useState<"ok" | "danger">("danger");
  const [ftpBusy, setFtpBusy] = useState(false);
  const [ftpSteps, setFtpSteps] = useState<FtpStep[]>([]);
  const [ftpBanner, setFtpBanner] = useState("");
  const [editingFtp, setEditingFtp] = useState(false);
  const [showFtpSteps, setShowFtpSteps] = useState(true);
  const [url, setUrl] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [keepKey, setKeepKey] = useState(true);
  const [applyWord, setApplyWord] = useState("");
  const ghost = site.ghost;
  const latest = audits[0];

  async function testLive() {
    const checked = validateGhostUrl(url);
    if (!checked.ok) {
      failGhost(checked.error);
      return;
    }
    setBusy(true);
    try {
      const result = await testGhostConnection({ data: { url: checked.url, adminKey } });
      if (result.ok) markLive(result.origin, result.version, maskKey(adminKey), keepKey ? adminKey.trim() : undefined);
      else failGhost(result.error);
    } catch (error) {
      failGhost(error instanceof Error ? error.message : "Live test failed.");
    } finally {
      setAdminKey("");
      setBusy(false);
    }
  }

  async function syncLive() {
    const key = adminKey.trim() || ghost.adminKey || "";
    const origin = (url.trim() || ghost.url).startsWith("https://") ? (url.trim() || ghost.url) : ghost.url.startsWith("https://") ? ghost.url : "";
    if (key && origin.startsWith("https://")) {
      setBusy(true);
      try {
        const result = await syncGhostPosts({ data: { url: origin, adminKey: key } });
        if (!result.ok) failGhost(result.error);
        else {
          applyLiveInventory(
            result.posts.map((post) => ({ ...post, status: post.status === "PUBLISHED" ? ("PUBLISHED" as const) : ("DRAFT" as const) })),
            result.truncated ? `Ghost import stopped at the page cap · ${result.posts.length} posts. There are more pages on the site.` : undefined,
          );
        }
      } catch (error) {
        failGhost(error instanceof Error ? error.message : "Sync failed.");
      } finally {
        setAdminKey("");
        setBusy(false);
      }
      return;
    }
    beginStudioSync();
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Website"
        title="Connections"
        lede="Live Ghost can keep the Admin API key in this browser so image upload and single-shot publish work. Disconnect deletes it. Private addresses and unsafe redirects are blocked. Apply proposals with PUT — never a second POST."
      />
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl">Ghost</h2>
          <Badge tone={statusTone(ghost.status)}>{ghost.status}</Badge>
          {ghost.version ? <Badge tone="brass">{ghost.version}</Badge> : null}
          <Badge tone={statusTone(ghost.corpus)}>{ghost.corpus}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted">
          {ghost.inventorySource === "local-demo" || (ghost.mode === "studio" && !ghost.adminKey)
            ? "Local demo. No Ghost Admin key is saved, so Sync inventory lists this studio's own articles and does not call Ghost."
            : ghost.adminKey && ghost.url.startsWith("https://")
              ? `Sync reads every page from ${ghost.url}. ${ghost.inventory.length} posts in inventory.`
              : ghost.mode === "live"
                ? `Live origin ${ghost.url}. Key hint ${ghost.keyHint}. Paste the Admin API key to sync if it was not kept.`
                : "Not connected."}
        </p>
        {ghost.lastError ? <p className="mt-2 text-sm text-danger">{ghost.lastError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={connectStudio}>Use studio ledger</Button>
          <Button variant="ghost" onClick={() => void syncLive()} disabled={busy}>
            {ghost.corpus === "SYNCING" ? "Syncing…" : "Sync inventory"}
          </Button>
          <Button variant="danger" onClick={disconnectGhost}>
            Disconnect
          </Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Field label="Ghost URL" hint="https only. Localhost and private IPs are refused.">
            <input className={fieldClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-ghost.example" />
          </Field>
          <Field label="Admin API key" hint="id:secret. Saved in this browser only if the box below is checked. Sent only to your Ghost origin.">
            <input className={fieldClass} value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="id:hexsecret" autoComplete="off" />
          </Field>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={keepKey} onChange={(e) => setKeepKey(e.target.checked)} />
          <span>Keep the Admin API key in this browser so new posts upload their photos and publish once. Disconnect wipes it.</span>
        </label>
        <div className="mt-3">
          <Button variant="ghost" disabled={busy} onClick={() => void testLive()}>
            {busy ? "Testing…" : "Connect & verify live"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Internal-link audit</h2>
            <p className="mt-1 text-sm text-muted">Read-only, at most 5 posts. Applying inserts is a separate PUT step.</p>
          </div>
          <Button variant="ghost" onClick={auditNow} disabled={ghost.mode === "off"}>
            Run audit
          </Button>
        </div>
        {ghost.mode !== "live" ? (
          <p className="mt-3 text-sm text-muted">Audit apply edits a live Ghost site. In the studio ledger this pass is a rehearsal: read the proposals, then type APPLY to update local articles only.</p>
        ) : null}
        {latest ? (
          <div className="mt-4">
            <div className="flex flex-wrap gap-3 text-sm text-muted">
              <span>Scanned {latest.scanned}</span>
              <span>Healthy {latest.healthy}</span>
              <span>Missing links {latest.missingLinks}</span>
              <span>Broken {latest.broken}</span>
              <span>Orphans {latest.orphans ?? 0}</span>
              <span>Insert {latest.wouldInsert}</span>
              <span>Rewrite {latest.wouldRewrite}</span>
              <span>Remove {latest.wouldRemove}</span>
              <span>{relTime(latest.at)}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {latest.proposals.map((proposal) => (
                <li key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={proposal.selected} disabled={latest.applied} onChange={() => toggleProposal(latest.id, proposal.id)} />
                    <span>
                      <span className="block">{proposal.kind}: {proposal.anchor}</span>
                      <span className="text-xs text-faint">{proposal.detail}</span>
                    </span>
                  </label>
                </li>
              ))}
              {!latest.proposals.length ? <li className="text-sm text-muted">No proposals. The sample already meets the link band, or there is no sibling page.</li> : null}
            </ul>
            {!latest.applied && latest.proposals.length ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Field label="Type APPLY to confirm">
                  <input className={fieldClass} value={applyWord} onChange={(e) => setApplyWord(e.target.value)} placeholder="APPLY" autoComplete="off" />
                </Field>
                <Button
                  disabled={applyWord !== "APPLY"}
                  onClick={() => {
                    applyProposals(latest.id);
                    setApplyWord("");
                  }}
                >
                  Edit Ghost posts now
                </Button>
              </div>
            ) : null}
            {latest.applied ? <p className="mt-3 text-sm text-ok">Applied. Post ids were not recreated.</p> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No audit yet.</p>
        )}
      </Card>

      <Card className="overflow-x-auto p-5">
        <h2 className="font-display text-2xl">Ghost inventory</h2>
        <table className="mt-3 w-full min-w-md text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-faint">
            <tr>
              <th className="py-2 font-medium">Title</th>
              <th className="py-2 font-medium">Id</th>
              <th className="py-2 font-medium">Synced</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ghost.inventory.map((post) => (
              <tr key={post.id} className="border-t border-line">
                <td className="py-2">{post.title}</td>
                <td className="font-mono text-xs text-faint">{post.id}</td>
                <td>{relTime(post.syncedAt)}</td>
                <td>
                  <Badge tone={statusTone(post.status)}>{post.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ghost.inventory.length ? <p className="mt-3 text-sm text-muted">Inventory is empty. Sync after connecting.</p> : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {site.providers.map((provider) => {
          const roadmap = provider.id !== "cpanel";
          return (
          <Card key={provider.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{provider.name}</h3>
              <Badge tone={roadmap ? "muted" : statusTone(provider.status === "verified" ? "verified" : provider.status === "configured" ? "configured" : "disconnected")}>
                {roadmap ? "Not yet wired — roadmap" : provider.status === "verified" ? "VERIFIED" : provider.status === "configured" ? "CONFIGURED" : "NOT CONNECTED"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">{roadmap ? "Not yet wired — roadmap. This does not deploy." : provider.capability}</p>
            {!roadmap && provider.hint ? <p className="mt-1 font-mono text-xs text-faint">{provider.hint}</p> : null}
            {provider.id === "cpanel" ? (
              <CpanelCard
                provider={provider}
                host={ftpHost}
                user={ftpUser}
                password={ftpPass}
                port={ftpPort}
                path={ftpPath}
                publicUrl={ftpPublic || site.publicUrl}
                note={ftpNote}
                tone={ftpTone}
                steps={ftpSteps}
                banner={ftpBanner}
                editing={editingFtp || provider.status !== "verified"}
                showSteps={showFtpSteps}
                busy={ftpBusy}
                onHost={setFtpHost}
                onUser={setFtpUser}
                onPassword={setFtpPass}
                onPort={setFtpPort}
                onPath={setFtpPath}
                onPublic={setFtpPublic}
                onToggleEdit={() => setEditingFtp((open) => !open)}
                onToggleSteps={() => setShowFtpSteps((open) => !open)}
                onSave={(fields) => {
                  const ok = saveFtp("cpanel", fields);
                  if (!ok) {
                    setFtpTone("danger");
                    setFtpNote("Nothing was saved. Hostname, username, and password are all required.");
                    return;
                  }
                  setFtpPass("");
                  setFtpTone("ok");
                  setFtpNote("Saved in this browser. Status is CONFIGURED, not verified, until Test connection succeeds.");
                }}
                onTest={(fields) => {
                  if (!fields.host || !fields.user || !fields.password) {
                    setFtpTone("danger");
                    setFtpNote("Nothing was tested. Enter the hostname, username, and password first. A blank password is only allowed after a successful save.");
                    return;
                  }
                  setFtpBusy(true);
                  setFtpTone("ok");
                  setFtpNote("Testing explicit TLS. This finishes or fails within 25 seconds.");
                  setFtpSteps([]);
                  setFtpBanner("");
                  let settled = false;
                  const watchdog = window.setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    setFtpBusy(false);
                    setFtpTone("danger");
                    setFtpNote("No final answer. The host did not finish explicit TLS within 25 seconds. Check the hostname, port 21, and password.");
                  }, 25000);
                  void testFtpLogin({ data: fields })
                    .then((result) => {
                      if (settled) return;
                      setFtpSteps(result.steps ?? []);
                      if (!result.ok) {
                        setFtpTone("danger");
                        setFtpNote(result.error || "The FTP server refused the connection.");
                        setFtpBanner("");
                        return;
                      }
                      saveFtp("cpanel", { ...fields, user: result.user || fields.user, via: result.via });
                      verifyProvider("cpanel", `${fields.host} · ${result.user || fields.user} · ${fields.path}`);
                      setFtpPass("");
                      setFtpBanner(result.banner);
                      setFtpTone("ok");
                      setFtpNote("Connection successful. cPanel is verified.");
                      setEditingFtp(false);
                      setShowFtpSteps(true);
                    })
                    .catch((error: unknown) => {
                      if (settled) return;
                      setFtpTone("danger");
                      setFtpNote(error instanceof Error ? error.message : "The connection test did not run.");
                    })
                    .finally(() => {
                      settled = true;
                      window.clearTimeout(watchdog);
                      setFtpBusy(false);
                    });
                }}
                onDisconnect={() => {
                  disconnectProvider(provider.id);
                  setFtpBanner("");
                  setFtpSteps([]);
                  setFtpNote("");
                }}
              />
            ) : (
              <p className="mt-3 text-sm text-muted">Not yet wired — roadmap. Nothing is uploaded from this card. cPanel FTPS is the working path.</p>
            )}
          </Card>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-faint">
        Cloudflare, GitHub, and Vercel are not yet wired — roadmap. They do not deploy. cPanel runs a real explicit-TLS check: DNS, TCP, TLS, login, protected data channel, then a directory listing. The password stays in this browser and is not shown again.
      </p>
    </div>
  );
}

function maskMiddle(value: string): string {
  if (!value) return "not set";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}•••${value.slice(-3)}`;
}

function CpanelCard({
  provider,
  host,
  user,
  password,
  port,
  path,
  publicUrl,
  note,
  tone,
  steps,
  banner,
  editing,
  showSteps,
  busy,
  onHost,
  onUser,
  onPassword,
  onPort,
  onPath,
  onPublic,
  onToggleEdit,
  onToggleSteps,
  onSave,
  onTest,
  onDisconnect,
}: {
  provider: { status: string; hint: string; ftp?: { host: string; user: string; path: string; password?: string; port?: number; publicUrl?: string } };
  host: string;
  user: string;
  password: string;
  port: string;
  path: string;
  publicUrl: string;
  note: string;
  tone: "ok" | "danger";
  steps: FtpStep[];
  banner: string;
  editing: boolean;
  showSteps: boolean;
  busy: boolean;
  onHost: (value: string) => void;
  onUser: (value: string) => void;
  onPassword: (value: string) => void;
  onPort: (value: string) => void;
  onPath: (value: string) => void;
  onPublic: (value: string) => void;
  onToggleEdit: () => void;
  onToggleSteps: () => void;
  onSave: (fields: { host: string; user: string; password: string; path: string; port: number; publicUrl: string }) => void;
  onTest: (fields: { host: string; user: string; password: string; path: string; port: number; publicUrl: string }) => void;
  onDisconnect: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const saved = provider.ftp;
  function fields() {
    const data = new FormData(formRef.current ?? undefined);
    const typedPassword = String(data.get("password") ?? password);
    return {
      host: String(data.get("host") ?? host).trim() || saved?.host || "",
      user: String(data.get("user") ?? user).trim() || saved?.user || "",
      password: typedPassword || saved?.password || "",
      path: String(data.get("path") ?? path).trim() || saved?.path || "/",
      port: Number(data.get("port") ?? port) || saved?.port || 21,
      publicUrl: String(data.get("publicUrl") ?? publicUrl).trim(),
    };
  }
  const shownHost = host || saved?.host || "";
  const shownUser = user || saved?.user || "";
  const shownPath = path || saved?.path || "/";
  return (
    <form
      ref={formRef}
      className="mt-3 space-y-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(fields());
      }}
    >
      <p className="text-muted">Explicit-TLS FTPS. Uploads go to the hosting account only after this test can log in and read the remote directory.</p>
      {provider.status === "verified" ? (
        <p className="font-mono text-xs text-faint">
          host {maskMiddle(shownHost)} · username {maskMiddle(shownUser)} · password {password ? "typed" : "saved"} · path {shownPath}
        </p>
      ) : null}
      {banner ? <p className="rounded-xl border border-ok/40 bg-ok/10 px-3 py-2 text-ok">{banner}</p> : null}
      {note ? <p className={tone === "ok" ? "text-ok" : "text-danger"}>{note}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => onTest(fields())} disabled={busy}>
          {busy ? "Testing…" : "Test connection"}
        </Button>
        <Button variant="ghost" onClick={onToggleEdit}>
          {editing ? "Hide form" : "Edit"}
        </Button>
        {provider.status !== "not_connected" ? (
          <Button variant="danger" onClick={onDisconnect}>
            Disconnect
          </Button>
        ) : null}
      </div>
      {steps.length ? (
        <div>
          <button className="text-xs text-brass-2" onClick={onToggleSteps}>
            {showSteps ? "Hide technical details" : "Show technical details"}
          </button>
          {showSteps ? (
            <ul className="mt-2 space-y-1 rounded-xl border border-line px-3 py-2 font-mono text-xs">
              {steps.map((step) => (
                <li key={step.name} className="grid grid-cols-[8rem_4.5rem_minmax(0,1fr)] gap-x-3">
                  <span className={step.ok ? "text-ok" : "text-danger"}>{step.ok ? "OK" : "FAIL"} {step.name}</span>
                  <span className="text-faint">{step.ms}ms</span>
                  <span className="text-muted">{step.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="FTP hostname" hint="Public host only, such as ftp.yourdomain.com or the host shown by cPanel.">
            <input className={fieldClass} name="host" value={host} onChange={(event) => onHost(event.target.value)} placeholder={saved?.host || "ftp.example.com"} aria-label="FTP hostname" autoComplete="off" />
          </Field>
          <Field label="FTP username" hint="Hostinger prints u605638561.lesgouters.com. The login that the server accepts is u605638561.lesgouters. The test removes a trailing .com if the longer name is rejected.">
            <input className={fieldClass} name="user" value={user} onChange={(event) => onUser(event.target.value)} placeholder={saved?.user || "username"} aria-label="FTP username" autoComplete="username" />
          </Field>
          <Field label="FTP password" hint="Leave empty to keep the password already saved in this browser.">
            <input className={fieldClass} name="password" type="password" value={password} onChange={(event) => onPassword(event.target.value)} placeholder={saved ? "Saved — leave blank to keep" : "Password"} aria-label="FTP password" autoComplete="current-password" />
          </Field>
          <Field label="FTP port" hint="21 for explicit TLS on most cPanel hosts.">
            <input className={fieldClass} name="port" value={port} onChange={(event) => onPort(event.target.value)} inputMode="numeric" aria-label="FTP port" />
          </Field>
          <Field label="Remote directory" hint="Use /. This FTP account is already inside public_html, so public_html is not a folder you can open.">
            <input className={fieldClass} name="path" value={path} onChange={(event) => onPath(event.target.value)} aria-label="Remote directory" />
          </Field>
          <Field label="Public site URL" hint="The site this directory serves. Used later to confirm the upload.">
            <input className={fieldClass} name="publicUrl" value={publicUrl} onChange={(event) => onPublic(event.target.value)} placeholder="https://example.com" aria-label="Public site URL" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Save changes</Button>
            <p className="mt-2 text-xs text-faint">Saving stores the login in this browser and switches the badge to CONFIGURED. It does not mark the host verified — run Test connection after saving.</p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
