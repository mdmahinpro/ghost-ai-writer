import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Boxes } from "lucide-react";
import { probePublicUrl } from "@/lib/ghost.functions";
import { readMediaBatch } from "@/lib/images.functions";
import { deployCloudflarePages, deployGithubPages, deployVercel, mirrorArticlesToCms, submitIndexNow, uploadFtps } from "@/lib/ops.functions";
import { loadFtpCredentials, WORKSPACE_ID } from "@/lib/ftp-credentials";
import { adsConfigHash, adCodeWithinLimit, slotConfigs, staticMedia } from "@/lib/static-site";
import { useApp, useHydrated } from "@/lib/store";
import { zipStore } from "@/lib/zip";
import { validatePublicUrl } from "@/lib/engine";
import { AD_CODE_LIMIT, AD_SLOT_LABELS, type AdSlotConfig, type AdSlotId, type DeployProvider } from "@/lib/types";
import { Button, Card, Field, PageIntro, SkeletonRows, StateNote, fieldClass, statusTone } from "@/components/ui";
import { relTime } from "@/lib/utils";

const TEMPLATES = [
  { id: "classic-editorial", note: "Serif feature, 1.0.0 · essays" },
  { id: "minimal-authority", note: "Tight measure, 1.0.0 · reference" },
  { id: "affiliate-review", note: "Comparison blocks, 1.0.0 · reviews" },
] as const;

function differentHost(ghostUrl: string, publicUrl: string): boolean {
  try {
    if (!ghostUrl || !publicUrl) return false;
    return new URL(ghostUrl).host !== new URL(publicUrl).host;
  } catch {
    return Boolean(ghostUrl && publicUrl && ghostUrl !== publicUrl);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

function decode64(data: string): Uint8Array {
  const binary = atob(data);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

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

function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  return <Pill tone={tone === "brass" ? "warn" : tone}>{label ?? status}</Pill>;
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="inline-flex items-center gap-2.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:text-fg"
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ${
          checked ? "border-brass/50 bg-brass/20" : "border-line bg-surface-2"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 size-3.5 rounded-full transition-transform duration-150 ${
            checked ? "translate-x-[1.125rem] bg-brass" : "translate-x-[0.125rem] bg-faint"
          }`}
        />
      </span>
      {children}
    </button>
  );
}

export function DeliveryPage() {
  const hydrated = useHydrated();
  const siteId = useApp((s) => s.activeSiteId);
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]!);
  const allArticles = useApp((s) => s.articles);
  const allBuilds = useApp((s) => s.builds);
  const allDeploys = useApp((s) => s.deploys);
  const articles = useMemo(() => allArticles.filter((article) => article.siteId === siteId), [allArticles, siteId]);
  const builds = useMemo(() => allBuilds.filter((build) => build.siteId === siteId), [allBuilds, siteId]);
  const deploys = useMemo(() => allDeploys.filter((deploy) => deploy.siteId === siteId), [allDeploys, siteId]);
  const patchSite = useApp((s) => s.patchSite);
  const buildSite = useApp((s) => s.buildSite);
  const packageBuild = useApp((s) => s.packageBuild);
  const acknowledgeRouteDiff = useApp((s) => s.acknowledgeRouteDiff);
  const rebuildForRouteDiff = useApp((s) => s.rebuildForRouteDiff);
  const saveProviderApi = useApp((s) => s.saveProviderApi);
  const saveFtp = useApp((s) => s.saveFtp);
  const verifyProvider = useApp((s) => s.verifyProvider);
  const logEvent = useApp((s) => s.logEvent);
  const [packing, setPacking] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [adsPreview, setAdsPreview] = useState(false);
  const urlCheck = site.publicUrl ? validatePublicUrl(site.publicUrl) : { ok: false as const, error: "Public URL is required before an indexable build." };
  const holds = deploys.filter((deploy) => deploy.status === "hold-route-diff");

  async function packedFiles(): Promise<{ name: string; base64: string }[]> {
    const build = builds[0];
    if (!build?.artifact.length) throw new Error("No frozen build artifact is available. Build a non-empty site first.");
    const media = staticMedia(articles);
    const packed = media.length ? await readMediaBatch({ data: { files: media } }) : { ok: true as const, files: [] };
    return [
      ...build.artifact.map((file) => ({ name: file.name, base64: bytesToBase64(new TextEncoder().encode(file.text)) })),
      ...packed.files.map((file) => ({ name: `assets/img/${file.name}`, base64: file.base64 })),
    ];
  }

  async function download() {
    setPacking(true);
    try {
      const build = builds[0];
      if (!build?.artifact.length) throw new Error("No frozen build artifact is available. Build a non-empty site first.");
      const textFiles = build.artifact;
      const media = staticMedia(articles);
      const packed = media.length ? await readMediaBatch({ data: { files: media } }) : { ok: true as const, files: [] };
      const enc = new TextEncoder();
      const files = [
        ...textFiles.map((file) => ({ name: file.name, data: enc.encode(file.text) })),
        ...packed.files.map((file) => ({ name: `assets/img/${file.name}`, data: decode64(file.base64) })),
      ];
      const blob = await zipStore(files);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${site.staticName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-static.zip`;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setPacking(false);
    }
  }

  // Backfill the CMS: the server pushes the articles Ghost does not have yet.
  // Stage 6 pushes only at the moment an article publishes, so anything finished
  // before the connection was saved stayed off the CMS with no way to catch up.
  const [mirroring, setMirroring] = useState(false);
  const [mirrorNote, setMirrorNote] = useState("");

  async function mirrorToCms() {
    setMirroring(true);
    setMirrorNote("Pushing the articles the CMS does not have yet…");
    const res = await mirrorArticlesToCms({ data: { site_ref: site.id } });
    setMirroring(false);
    if (!res.ok) {
      setMirrorNote(res.error);
      return;
    }
    const failed = res.failed.length ? ` · ${res.failed.length} failed: ${res.failed[0]}` : "";
    setMirrorNote(
      `Drafts added to the CMS: ${res.pushed}${failed}${res.pushed === 0 && !failed ? " · already in sync" : ""}`,
    );
  }

  async function uploadLive(buildId: string) {
    // The connection is whatever the server holds for this workspace. The
    // browser copy of the provider card is a leftover from when the password
    // lived in localStorage, and it reads "not_connected" even after a verified
    // test, so it must not be the thing that decides whether to upload.
    const saved = await loadFtpCredentials(siteId);
    if (!saved?.has_password) {
      setUploadNote("No live copy yet. Save the cPanel connection on Connections first.");
      return;
    }
    setPacking(true);
    setUploadNote("Uploading the static files. A full build writes tens of files, so give it up to five minutes.");
    let settled = false;
    const watchdog = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setPacking(false);
      setUploadNote("Upload did not finish. The host stopped answering. Check the cPanel hostname, port, and remote directory.");
    }, 300000);
    try {
      const files = await packedFiles();
      const result = await uploadFtps({
        data: {
          host: saved.host,
          user: saved.username,
          // Blank on purpose: the API opens the password sealed for this workspace.
          password: "",
          port: saved.port || 21,
          path: saved.remote_dir || "/public_html",
          via: "ftps",
          workspace_id: WORKSPACE_ID,
          site_uid: siteId,
          files,
        },
      });
      if (settled) return;
      if (!result.ok) {
        setUploadNote(result.error);
        return;
      }
      const host = result.host || saved.host;
      // The CMS push now happens on the server, inside the upload itself, and
      // rides back on this same answer. Nothing is left for this tab to do —
      // which is the point: a tab is allowed to close, and a CMS that needed a
      // second browser step was a CMS that stayed empty.
      const ghost = result.ghost;
      // The provider card in this browser is a leftover from the localStorage
      // era and still reads "not_connected"; sync it from the connection the
      // server just used, or packageBuild refuses to record the deploy and the
      // page keeps saying there is no live copy.
      saveFtp("cpanel", {
        host: saved.host,
        user: saved.username,
        path: saved.remote_dir || "/public_html",
        password: "",
        port: saved.port,
        publicUrl: saved.public_url || undefined,
        trust_cert: saved.trust_cert,
      });
      const deployId = packageBuild(buildId, "cpanel");
      if (deployId) void probe(deployId);
      // Say what the CMS actually did. "Uploaded" on its own is the sentence
      // that hid an empty CMS for days.
      const cmsLine = ghost
        ? ghost.ok
          ? ` CMS: ${ghost.pushed ?? 0} pushed${ghost.failed?.length ? `, ${ghost.failed.length} failed (${ghost.failed[0]})` : ""} · ${ghost.published ?? 0} live · mode ${ghost.mode ?? "SANDBOX"}.`
          : ` The files are live but the CMS refused: ${ghost.error ?? ghost.failed?.[0] ?? "no reason given"}.`
        : "";
      setUploadNote(
        deployId
          ? `Uploaded ${result.files} files to ${host}. Run Live probe before calling the site live.${cmsLine}`
          : `Uploaded ${result.files} files, but the deploy was held. Check the route-diff card.${cmsLine}`,
      );
    } catch (error) {
      if (!settled) setUploadNote(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      settled = true;
      window.clearTimeout(watchdog);
      setPacking(false);
    }
  }

  async function deployWith(provider: DeployProvider, buildId: string) {
    if (!provider.api?.token) {
      setUploadNote(`Save a ${provider.name} token first.`);
      return;
    }
    setPacking(true);
    setUploadNote(`Sending the frozen build to ${provider.name}…`);
    try {
      const files = await packedFiles();
      const result =
        provider.id === "cloudflare"
          ? await deployCloudflarePages({ data: { accountId: provider.api.accountId ?? "", token: provider.api.token, projectName: provider.api.projectName ?? "", files } })
          : provider.id === "vercel"
            ? await deployVercel({ data: { token: provider.api.token, projectName: provider.api.projectName ?? "", files } })
            : await deployGithubPages({ data: { token: provider.api.token, repo: provider.api.repo ?? "", branch: provider.api.branch ?? "gh-pages", files } });
      if (!result.ok) {
        setUploadNote(result.error);
        logEvent(site.id, "warn", `${provider.name} deploy failed: ${result.error}`);
        return;
      }
      const deployId = packageBuild(buildId, provider.id);
      setUploadNote(`${result.detail}${result.url ? ` Live URL ${result.url}.` : ""}`);
      logEvent(site.id, "ok", `${provider.name} deploy · ${result.detail}`);
      if (deployId) void probe(deployId);
    } catch (error) {
      setUploadNote(error instanceof Error ? error.message : "Deploy failed.");
    } finally {
      setPacking(false);
    }
  }

  async function probe(deployId: string) {
    const result = await probePublicUrl({ data: { url: site.publicUrl } });
    if (!result.ok) {
      useApp.getState().recordProbe(deployId, false, result.error);
      return;
    }
    const deploy = deploys.find((item) => item.id === deployId);
    const build = builds.find((item) => item.id === deploy?.buildId);
    const ftp = site.providers.find((provider) => provider.id === "cpanel" && provider.status === "verified")?.ftp;
    const urls = build?.includedIds.map((id) => allArticles.find((article) => article.id === id)?.slug).filter(Boolean).map((slug) => `${site.publicUrl.replace(/\/$/, "")}/post/${slug}/`) ?? [];
    if (!site.indexNowKey || !ftp || !build || !urls.length) {
      useApp.getState().recordProbe(deployId, true, `${result.detail} IndexNow skipped: missing verified key-file configuration or changed URLs.`);
      return;
    }
    const submitted = await submitIndexNow({ data: { publicUrl: site.publicUrl, key: site.indexNowKey, urls, verified: true, ftp } });
    useApp.getState().recordProbe(deployId, true, submitted.ok ? `${result.detail} IndexNow submitted ${urls.length} changed URL(s).` : `${result.detail} IndexNow skipped: ${submitted.error}`);
  }

  // Rule 7: honest loading state before the store hydrates (after every hook).
  if (!hydrated) return <SkeletonRows rows={5} />;
  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Website"
        title="Static delivery"
        lede="Ghost updates the CMS. This page builds the frozen public site: 7 configured ad slots, ads.txt, a route-diff gate that refuses to drop a live URL silently, and real deploy adapters for cPanel, Cloudflare Pages, Vercel, and GitHub Pages."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" className="bg-surface" onClick={() => void download()} disabled={packing || (!articles.length && !builds.length)}>
              {packing ? "Packing ZIP…" : "Download ZIP"}
            </Button>
            <Link
              to="/preview"
              className="inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-fg transition-colors duration-150 hover:border-line-strong"
            >
              Preview
            </Link>
            <Button onClick={buildSite}>Build now</Button>
          </div>
        }
      />

      {holds.map((deploy) => {
        const diff = deploy.routeDiff;
        return (
          <Card key={deploy.id} className="overflow-hidden rounded-xl border-danger/40 bg-danger/5 p-0">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-danger/20 px-5 py-3.5">
              <Pill tone="danger">ROUTE-DIFF HOLD</Pill>
              <span className="num text-[11px] text-muted">
                build {deploy.buildId.slice(-6)} · {diff?.removedRoutes.length ?? 0} removed · {diff?.addedRoutes.length ?? 0} added · {diff?.unchangedCount ?? 0} unchanged
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] leading-6 text-muted">
                Deploying this build would remove {(diff?.removedRoutes.length ?? 0) === 1 ? "a URL that is currently live" : "URLs that are currently live"}. Nothing has been uploaded. Acknowledge explicitly, or rebuild with the missing articles.
              </p>
              <ul className="num mt-3 max-h-40 space-y-1 overflow-auto rounded-md border border-danger/20 bg-elev px-3 py-2 text-[11px] leading-5 text-danger">
                {(diff?.removedRoutes ?? []).map((route) => (
                  <li key={route}>{route}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="danger" size="sm" onClick={() => acknowledgeRouteDiff(deploy.id)}>
                  Acknowledge & Deploy Anyway
                </Button>
                <Button variant="ghost" size="sm" onClick={() => rebuildForRouteDiff(deploy.id)}>
                  Rebuild with missing articles
                </Button>
              </div>
            </div>
          </Card>
        );
      })}

      <Card className="rounded-xl p-0">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Where a published post actually goes</h2>
        </div>
        <p className="px-5 py-4 text-[13px] leading-6 text-muted">
          Ghost Admin writes to {site.ghost.url || "the connected CMS"}. The public website is {site.publicUrl || "not set"}.{" "}
          {differentHost(site.ghost.url, site.publicUrl)
            ? "Those are different hosts, so a CMS post will not show on the public site by itself. Download the ZIP or deploy through an adapter."
            : "Upload live sends the build to a verified cPanel directory. The public URL changes only after that upload and a successful probe."}
        </p>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4">
        <div>
          <div className="text-[13px] font-medium text-fg">Auto-rebuild on publish</div>
          <p className="mt-0.5 max-w-xl text-[12px] leading-5 text-muted">When on, a new article queues a fresh snapshot. Deploy still respects the route-diff gate.</p>
        </div>
        <Switch checked={site.autoRebuild} onChange={() => patchSite({ autoRebuild: !site.autoRebuild })}>
          {site.autoRebuild ? "On" : "Off"}
        </Switch>
      </Card>

      <Card className="overflow-hidden rounded-xl p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Delivery targets</h2>
            <p className="mt-1 text-[12px] leading-5 text-muted">Four adapters. Credentials stay in this browser; every host is a hardcoded https origin.</p>
          </div>
          <Pill>ads hash {adsConfigHash(site)}</Pill>
        </div>
        <div className="grid gap-px bg-line md:grid-cols-2">
          {site.providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              buildId={builds.find((build) => build.status === "succeeded")?.id}
              packing={packing}
              onSave={(api) => saveProviderApi(provider.id, api)}
              onVerify={() => verifyProvider(provider.id, "")}
              onDeploy={(buildId) => void deployWith(provider, buildId)}
            />
          ))}
        </div>
      </Card>

      <AdSlotsCard site={site} preview={adsPreview} onPreview={setAdsPreview} onPatch={(patch) => patchSite(patch)} />

      <Card className="rounded-xl p-0">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">ads.txt</h2>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-[13px] leading-6 text-muted">
            Emitted as a tracked build artifact at <span className="num">/ads.txt</span> whenever it is not empty.
          </p>
          <textarea
            className={`${fieldClass} font-mono text-[11px] leading-5`}
            rows={5}
            value={site.adsTxt ?? ""}
            onChange={(e) => patchSite({ adsTxt: e.target.value })}
            placeholder={"google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"}
          />
          <p className="num text-[11px] text-faint">{new TextEncoder().encode(site.adsTxt ?? "").length} bytes · will ship on the next build</p>
        </div>
      </Card>

      {!urlCheck.ok ? (
        <StateNote tone="partial" title="Delivery is not indexable yet" body={urlCheck.error} />
      ) : (
        <p className="text-[12px] text-muted">
          Public origin <span className="num text-fg">{urlCheck.url}</span>
        </p>
      )}
      {uploadNote ? (
        <Card className="rounded-xl border-warn/30 bg-warn/5 p-0">
          <div className="border-b border-warn/20 px-5 py-3.5">
            <div className="text-[13px] font-medium text-fg">Last delivery action</div>
          </div>
          <p className="px-5 py-3.5 text-[13px] leading-6 text-muted">{uploadNote}</p>
        </Card>
      ) : null}

      <Card className="overflow-hidden rounded-xl p-0">
        <div className="divide-y divide-line">
          {builds.map((build) => {
            const deploy = deploys.find((item) => item.buildId === build.id);
            return (
              <div key={build.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="num text-[11px] text-faint">{build.id}</span>
                  {build.auto ? <Pill tone="warn">AUTO</Pill> : null}
                  <StatusPill status={build.status} />
                  <span className="num text-[12px] text-muted">
                    {build.pages} pages · {(build.routes ?? []).length} routes · {Math.round(build.bytes / 1024)} KB · ads {build.adsConfigHash ?? "—"} · {relTime(build.at)}
                  </span>
                </div>
                {build.detail ? <p className="mt-2 text-[13px] leading-6 text-muted">{build.detail}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!deploy && build.status === "succeeded" ? (
                    <Button variant="secondary" size="sm" className="bg-surface" disabled={packing} onClick={() => void uploadLive(build.id)}>
                      {packing ? "Uploading… (also pushes to the CMS)" : "Upload live (cPanel + CMS)"}
                    </Button>
                  ) : null}
                  {build.status === "succeeded" ? (
                    <>
                      <Button variant="ghost" size="sm" disabled={mirroring} onClick={() => void mirrorToCms()}>
                        {mirroring ? "Syncing…" : "Re-sync an existing build"}
                      </Button>
                      {mirrorNote ? <span className="text-[11px] text-faint">{mirrorNote}</span> : null}
                    </>
                  ) : null}
                  {deploy ? (
                    <>
                      <StatusPill status={deploy.status === "hold-route-diff" ? "failed" : deploy.status} />
                      <span className="text-[11px] text-muted">{deploy.probe}</span>
                      {deploy.status === "packaged" ? (
                        <Button variant="ghost" size="sm" onClick={() => void probe(deploy.id)}>
                          Live probe
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!builds.length ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto grid size-9 place-items-center rounded-md bg-surface-2 text-faint">
                <Boxes aria-hidden="true" strokeWidth={1.6} className="size-4" />
              </span>
              <p className="mt-2 text-[12px] text-muted">No builds yet.</p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-xl p-0">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Site customization</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => patchSite({ template: template.id })}
                className={`rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors duration-150 ${
                  site.template === template.id
                    ? "border-brass/40 bg-brass/5 text-fg"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                <span className="block font-medium">{template.id}</span>
                <span className="mt-0.5 block text-[11px] text-faint">{template.note}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Site name">
              <input className={fieldClass} value={site.staticName} onChange={(e) => patchSite({ staticName: e.target.value })} />
            </Field>
            <Field label="Public URL" hint="Required for an indexable build. Placeholder domains are rejected.">
              <input className={fieldClass} value={site.publicUrl} onChange={(e) => patchSite({ publicUrl: e.target.value })} placeholder="https://notes.example" />
            </Field>
            <Field label="Footer">
              <input className={fieldClass} value={site.footer} onChange={(e) => patchSite({ footer: e.target.value })} />
            </Field>
            <Field label="Robots">
              <select className={fieldClass} value={site.robots} onChange={(e) => patchSite({ robots: e.target.value as typeof site.robots })}>
                <option value="index,follow">index,follow</option>
                <option value="noindex,nofollow">noindex,nofollow</option>
              </select>
            </Field>
            <Field label="Header menu">
              <input className={fieldClass} value={site.headerMenu} onChange={(e) => patchSite({ headerMenu: e.target.value })} />
            </Field>
            <Field label="Footer menu">
              <input className={fieldClass} value={site.footerMenu} onChange={(e) => patchSite({ footerMenu: e.target.value })} />
            </Field>
          </div>
          <Field label="Head HTML" hint="Inserted into the downloaded ZIP only.">
            <textarea className={fieldClass} rows={3} value={site.headHtml} onChange={(e) => patchSite({ headHtml: e.target.value })} />
          </Field>
          <Field label="Analytics snippet" hint="Same rule: customer static site only, never this control panel.">
            <textarea className={fieldClass} rows={3} value={site.analyticsSnippet} onChange={(e) => patchSite({ analyticsSnippet: e.target.value })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function ProviderCard({
  provider,
  buildId,
  packing,
  onSave,
  onVerify,
  onDeploy,
}: {
  provider: DeployProvider;
  buildId?: string;
  packing: boolean;
  onSave: (api: NonNullable<DeployProvider["api"]>) => void;
  onVerify: () => void;
  onDeploy: (buildId: string) => void;
}) {
  const [draft, setDraft] = useState({
    accountId: provider.api?.accountId ?? "",
    projectName: provider.api?.projectName ?? "",
    repo: provider.api?.repo ?? "",
    branch: provider.api?.branch ?? "gh-pages",
    token: "",
  });
  const credentialFields =
    provider.id === "cloudflare"
      ? [
          { key: "accountId" as const, label: "Account ID" },
          { key: "projectName" as const, label: "Pages project" },
          { key: "token" as const, label: "API token", secret: true },
        ]
      : provider.id === "vercel"
        ? [
            { key: "projectName" as const, label: "Project name" },
            { key: "token" as const, label: "Token", secret: true },
          ]
        : provider.id === "github"
          ? [
              { key: "repo" as const, label: "owner/repo" },
              { key: "branch" as const, label: "Branch" },
              { key: "token" as const, label: "Token", secret: true },
            ]
          : [];
  return (
    <div className="bg-elev p-4 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-medium text-fg">{provider.name}</div>
        <Pill tone={provider.status === "verified" ? "ok" : provider.status === "configured" ? "warn" : "muted"}>{provider.status.replace("_", " ")}</Pill>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-faint">{provider.capability}</p>
      {provider.id === "cpanel" ? (
        <div className="num mt-2 text-[11px] leading-5 text-faint">
          {provider.ftp?.host ? `${provider.ftp.host}${provider.ftp.path ?? ""} · ${provider.ftp.via ?? "ftps"}` : "Configure FTPS/SFTP on Connections."}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {credentialFields.map((field) => (
            <label key={field.key} className="block text-[11px]">
              <span className="text-faint">{field.label}</span>
              <input
                className={`${fieldClass} mt-1`}
                type={field.secret ? "password" : "text"}
                value={draft[field.key]}
                placeholder={field.secret ? provider.api?.tokenHint || "••••" : ""}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() =>
                onSave({
                  accountId: draft.accountId,
                  projectName: draft.projectName,
                  repo: draft.repo,
                  branch: draft.branch,
                  ...(draft.token ? { token: draft.token } : {}),
                })
              }
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onVerify}>
              Verify
            </Button>
            <Button size="sm" variant="ghost" disabled={packing || !buildId || provider.status !== "verified"} onClick={() => buildId && onDeploy(buildId)}>
              Deploy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdSlotsCard({
  site,
  preview,
  onPreview,
  onPatch,
}: {
  site: ReturnType<typeof useApp.getState>["sites"][number];
  preview: boolean;
  onPreview: (value: boolean) => void;
  onPatch: (patch: { adsEnabled?: boolean; ads?: AdSlotConfig[] }) => void;
}) {
  const slots = slotConfigs(site);
  const update = (id: AdSlotId, patch: Partial<AdSlotConfig>) => onPatch({ ads: slots.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)) });
  const [unit, setUnit] = useState({ publisher: "", slotId: "" });
  return (
    <Card className="overflow-hidden rounded-xl p-0">
      <div className="space-y-3 border-b border-line px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-sans text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">Ad slots (7)</h2>
            <p className="mt-1 text-[12px] leading-5 text-muted">Each slot is independent, capped at {Math.round(AD_CODE_LIMIT / 1024)} KiB of code, and only renders on the public build.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Switch checked={preview} onChange={() => onPreview(!preview)}>
              {preview ? "Preview mode ON (scripts disabled)" : "Preview mode OFF"}
            </Switch>
            <Switch checked={Boolean(site.adsEnabled)} onChange={() => onPatch({ adsEnabled: !site.adsEnabled })}>
              {site.adsEnabled ? "Ads enabled" : "Ads disabled"}
            </Switch>
          </div>
        </div>
        {preview ? (
          <div className="rounded-md border border-dashed border-brass/30 bg-brass/5 px-3 py-2 text-[11px] leading-5 text-muted">
            Preview mode renders the slot placeholders and never loads live ad code — use it to check placement before switching ads on.
          </div>
        ) : null}
      </div>
      <div className="grid gap-px bg-line md:grid-cols-2">
        {slots.map((slot) => {
          const bytes = new TextEncoder().encode(slot.code).length;
          const over = !adCodeWithinLimit(slot.code);
          return (
            <div key={slot.id} className="bg-elev p-4 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-3.5 accent-brass" checked={slot.enabled} onChange={(e) => update(slot.id, { enabled: e.target.checked })} />
                  <span className="font-medium text-fg">{AD_SLOT_LABELS[slot.id]}</span>
                  {slot.enabled ? <span aria-hidden="true" className="size-1.5 rounded-full bg-brass" /> : null}
                </label>
                <span className="num text-[11px] text-faint">{slot.id}</span>
              </div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <label className="block text-[11px]">
                  <span className="text-faint">Internal name</span>
                  <input className={`${fieldClass} mt-1`} value={slot.name} onChange={(e) => update(slot.id, { name: e.target.value })} />
                </label>
                <label className="block text-[11px]">
                  <span className="text-faint">Type</span>
                  <select className={`${fieldClass} mt-1`} value={slot.adType} onChange={(e) => update(slot.id, { adType: e.target.value as AdSlotConfig["adType"] })}>
                    <option value="custom_code">Custom code</option>
                    <option value="adsense_responsive">AdSense responsive</option>
                  </select>
                </label>
              </div>
              {slot.adType === "custom_code" ? (
                <label className="mt-2 block text-[11px]">
                  <span className="text-faint">Code</span>
                  <textarea className={`${fieldClass} mt-1 font-mono text-[11px] leading-5`} rows={3} value={slot.code} onChange={(e) => update(slot.id, { code: e.target.value })} />
                </label>
              ) : (
                <div className="mt-2 space-y-2 text-[11px]">
                  <span className="text-faint">AdSense unit id (data-ad-slot)</span>
                  <input className={fieldClass} value={slot.code} onChange={(e) => update(slot.id, { code: e.target.value })} placeholder="1234567890" />
                  <div className="flex flex-wrap items-center gap-2">
                    <input className={fieldClass} value={unit.publisher} onChange={(e) => setUnit({ ...unit, publisher: e.target.value })} placeholder="pub-1234567890" />
                    <input className={fieldClass} value={unit.slotId} onChange={(e) => setUnit({ ...unit, slotId: e.target.value })} placeholder="unit id" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => update(slot.id, { adType: "custom_code", code: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${unit.publisher}" crossorigin="anonymous"></script>\n<ins class="adsbygoogle" style="display:block" data-ad-client="${unit.publisher}" data-ad-slot="${unit.slotId || slot.code}" data-ad-format="auto" data-full-width-responsive="true"></ins>\n<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>` })}
                    >
                      Generate unit code
                    </Button>
                  </div>
                </div>
              )}
              <div className={`num mt-2.5 text-[11px] ${over ? "text-danger" : "text-faint"}`}>
                {bytes.toLocaleString()} / {AD_CODE_LIMIT.toLocaleString()} bytes {over ? "· OVER LIMIT — the build will refuse this slot" : ""}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-faint">
                desktop: {slot.position.desktop}
                <br />
                mobile: {slot.position.mobile}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
