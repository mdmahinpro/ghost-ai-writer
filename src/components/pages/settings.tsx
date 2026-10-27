import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { BLADER_SOURCE, BLADER_VERSION } from "@/lib/humanizer";
import { Badge, Button, Card, Field, PageIntro, fieldClass } from "@/components/ui";
import { ThemePicker } from "@/components/theme-picker";
import type { VoiceSettings } from "@/lib/types";

export function ContentSettings() {
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]!);
  const defaults = useApp((s) => s.defaults);
  const keys = useApp((s) => s.keys);
  const limits = useApp((s) => s.limits);
  const patchVoice = useApp((s) => s.patchVoice);
  const patchDefaults = useApp((s) => s.patchDefaults);
  const patchLimits = useApp((s) => s.patchLimits);
  const webSearch = useApp((s) => s.webSearch);
  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Settings"
        title="Content"
        lede="Account defaults and this website's overrides. Duplicate thresholds stay 0.85 lexical and 0.88 semantic. Keyword batching and job concurrency are yours to set."
      />
      <Card className="p-5">
        <h2 className="font-display text-2xl text-fg">Appearance</h2>
        <p className="mt-2 text-sm text-muted">Two modes, one design: Midnight for long night sessions, Paper for bright rooms. The site preview follows the studio, and the choice stays after a reload.</p>
        <div className="mt-4">
          <ThemePicker variant="section" />
        </div>
      </Card>
      <Card className="grid gap-3 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="font-display text-2xl text-fg">Scale &amp; limits</h2>
          <p className="mt-1 text-sm text-muted">
            Leave a field empty for unlimited. These knobs replace the old hard caps (100 keywords / 2 jobs / 20 ideas / restart 5) so a
            10,000+ article run is a configuration choice, not a blocker.
          </p>
        </div>
        <Field label="Keywords per run" hint="Empty = unlimited. A 10,000-line batch is accepted; large batches gate L1+L2 at intake and re-check L3 at publish.">
          <input
            className={`${fieldClass} font-mono`}
            type="number"
            min={1}
            placeholder="unlimited"
            value={limits.keywordCap ?? ""}
            onChange={(e) => patchLimits({ keywordCap: e.target.value === "" ? null : Math.max(1, Number(e.target.value)) })}
          />
        </Field>
        <Field label="Concurrent article jobs per website" hint="How many jobs generate at once. Higher = faster bulk runs.">
          <input
            className={`${fieldClass} font-mono`}
            type="number"
            min={1}
            value={limits.concurrency}
            onChange={(e) => patchLimits({ concurrency: Math.max(1, Number(e.target.value) || 1) })}
          />
        </Field>
        <Field label="Ideas per round" hint="Empty = unlimited (bounded by what the corpus leaves uncovered).">
          <input
            className={`${fieldClass} font-mono`}
            type="number"
            min={1}
            placeholder="unlimited"
            value={limits.ideaCap ?? ""}
            onChange={(e) => patchLimits({ ideaCap: e.target.value === "" ? null : Math.max(1, Number(e.target.value)) })}
          />
        </Field>
        <Field label="Automatic restarts per job" hint="Empty = unlimited retries of a failed job.">
          <input
            className={`${fieldClass} font-mono`}
            type="number"
            min={0}
            placeholder="unlimited"
            value={limits.restartLimit ?? ""}
            onChange={(e) => patchLimits({ restartLimit: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
          />
        </Field>
        <Field label="Static build history" hint="Empty = unlimited local build records.">
          <input
            className={`${fieldClass} font-mono`}
            type="number"
            min={1}
            placeholder="unlimited"
            value={limits.buildHistory ?? ""}
            onChange={(e) => patchLimits({ buildHistory: e.target.value === "" ? null : Math.max(1, Number(e.target.value)) })}
          />
        </Field>
      </Card>
      <VoiceCard title="Account defaults" voice={defaults} keys={keys} onChange={patchDefaults} />
      <VoiceCard title={`${site.name} overrides`} voice={site.voice} keys={keys} onChange={patchVoice} site />
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl text-fg">Blader humanizer</h2>
          <Badge tone="ok">engine on · {BLADER_VERSION}</Badge>
        </div>
        <p className="text-sm text-muted">
          The external Metric37 API is replaced by the native blader/humanizer engine ({BLADER_SOURCE}). Stage 2 drafts avoid the 26 AI-writing
          patterns from the start; Stage 3 revision runs a deterministic scrub plus a two-pass surgical audit and rewrite through the model key
          pool, in the assigned author's voice. Tables, links, headings and the direct-answer opening are preserved structurally.
        </p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
          <li>Score: every article carries a 0–100 prose-purity score after humanization.</li>
          <li>Stripped tells: the article detail page lists each AI pattern the rewrite removed.</li>
          <li>No extra key needed: the deterministic pass always runs; usable model keys add the LLM passes.</li>
        </ul>
      </Card>
      <Card className="p-5 text-sm text-muted">
        <h2 className="font-display text-2xl text-fg">Read-only contracts</h2>
        <ul className="mt-3 list-disc space-y-1 pl-4">
          <li>
            Keyword batching: {limits.keywordCap == null ? "unlimited" : `${limits.keywordCap} per run`}. Concurrency: {limits.concurrency} job
            {limits.concurrency === 1 ? "" : "s"} in flight per website.
          </li>
          <li>Link intensity: light 1–2, standard 2–4, dense 4–6. Targets must already exist.</li>
          <li>Stage 6 records zero LLM tokens. Embeddings are metered separately.</li>
          <li>Publish mode freezes on the run. It does not follow a later settings change.</li>
          <li>
            Web search: <span className="text-fg">{webSearch.mode}</span> · {webSearch.tavilyKeys.length} Tavily key
            {webSearch.tavilyKeys.length === 1 ? "" : "s"} · {webSearch.firecrawlKeys.length} Firecrawl key
            {webSearch.firecrawlKeys.length === 1 ? "" : "s"} (switch lives on AI Keys &amp; Usage).
          </li>
        </ul>
      </Card>
    </div>
  );
}

function VoiceCard({
  title,
  voice,
  keys,
  onChange,
  site,
}: {
  title: string;
  voice: VoiceSettings;
  keys: { id: string; label: string }[];
  onChange: (patch: Partial<VoiceSettings>) => void;
  site?: boolean;
}) {
  return (
    <Card className="grid gap-3 p-5 md:grid-cols-2">
      <h2 className="font-display text-2xl md:col-span-2">{title}</h2>
      <Field label="Model">
        <select className={fieldClass} value={voice.modelKeyId} onChange={(e) => onChange({ modelKeyId: e.target.value })}>
          {keys.map((key) => (
            <option key={key.id} value={key.id}>
              {key.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Publish as">
        <select className={fieldClass} value={voice.publishAs} onChange={(e) => onChange({ publishAs: e.target.value as VoiceSettings["publishAs"] })}>
          <option value="draft">Draft</option>
          <option value="live">Live</option>
        </select>
      </Field>
      <Field label="Tone">
        <input className={fieldClass} value={voice.tone} onChange={(e) => onChange({ tone: e.target.value })} />
      </Field>
      <Field label="Voice">
        <input className={fieldClass} value={voice.voice} onChange={(e) => onChange({ voice: e.target.value })} />
      </Field>
      <Field label="Point of view">
        <select className={fieldClass} value={voice.pov} onChange={(e) => onChange({ pov: e.target.value as VoiceSettings["pov"] })}>
          <option value="first-person">First person</option>
          <option value="second-person">Second person</option>
          <option value="third-person">Third person</option>
        </select>
      </Field>
      <Field label="Reading level">
        <select className={fieldClass} value={voice.readingLevel} onChange={(e) => onChange({ readingLevel: e.target.value as VoiceSettings["readingLevel"] })}>
          <option value="grade-7">Grade 7</option>
          <option value="general">General</option>
          <option value="expert">Expert</option>
        </select>
      </Field>
      <Field label="Banned phrases" hint="One phrase per line. The model must not use these phrases.">
        <textarea className={fieldClass} rows={3} value={(voice.bannedPhrases ?? []).join("\n")} onChange={(e) => onChange({ bannedPhrases: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })} />
      </Field>
      <Field label="Brand facts" hint="One fact per line. These facts are asserted in every stage prompt.">
        <textarea className={fieldClass} rows={3} value={(voice.brandFacts ?? []).join("\n")} onChange={(e) => onChange({ brandFacts: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })} />
      </Field>
      <Field label="Sections / article">
        <input className={fieldClass} type="number" min={3} max={8} value={voice.sections} onChange={(e) => onChange({ sections: Number(e.target.value) })} />
      </Field>
      <Field label="Section images max">
        <input className={fieldClass} type="number" min={0} max={3} value={voice.sectionImages} onChange={(e) => onChange({ sectionImages: Number(e.target.value) })} />
      </Field>
      {site ? (
        <>
          <Field label="Link intensity">
            <select className={fieldClass} value={voice.linkIntensity} onChange={(e) => onChange({ linkIntensity: e.target.value as VoiceSettings["linkIntensity"] })}>
              <option value="light">Light · 1–2</option>
              <option value="standard">Standard · 2–4</option>
              <option value="dense">Dense · 4–6</option>
            </select>
          </Field>
          <Field label="Image provider" hint="Each post gets a featured photo plus section photos. Bing is searched first. If nothing relevant comes back, Openverse is used. Photos are copied onto this server, then into Ghost or the ZIP. Confirm rights before a page is public.">
            <select className={fieldClass} value={voice.imageProvider === "wikimedia" ? "wikimedia" : "bing"} onChange={(e) => onChange({ imageProvider: e.target.value })}>
              <option value="bing">Bing photos</option>
              <option value="wikimedia">Wikimedia Commons</option>
            </select>
          </Field>
        </>
      ) : null}
    </Card>
  );
}

export function WebsiteSettings() {
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]!);
  const patchSite = useApp((s) => s.patchSite);
  const createBackup = useApp((s) => s.createBackup);
  const verifyBackup = useApp((s) => s.verifyBackup);
  const deleteWorkspace = useApp((s) => s.deleteWorkspace);
  const restoreWorkspace = useApp((s) => s.restoreWorkspace);
  const backupList = useApp((s) => s.backups);
  const backups = useMemo(() => backupList.filter((item) => item.siteId === site.id), [backupList, site.id]);
  const [confirm, setConfirm] = useState("");
  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Settings"
        title="Website"
        lede={`${site.name} · ${site.id.slice(-8)} · ${site.ghost.mode === "live" ? "Live Ghost" : site.ghost.mode === "studio" ? "Sandbox" : "Ghost off"} · created ${new Date(site.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}`}
      />
      <Card className="grid gap-3 p-5 md:grid-cols-2">
        <Field label="Workspace name">
          <input className={fieldClass} value={site.name} onChange={(e) => patchSite({ name: e.target.value })} />
        </Field>
        <Field label="Static site name">
          <input className={fieldClass} value={site.staticName} onChange={(e) => patchSite({ staticName: e.target.value })} />
        </Field>
        <Field label="Authors and bylines">
          <input className={fieldClass} value={site.authors} onChange={(e) => patchSite({ authors: e.target.value })} />
        </Field>
        <Field label="Niche tag">
          <input className={fieldClass} value={site.nicheTag} onChange={(e) => patchSite({ nicheTag: e.target.value })} />
        </Field>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="text-xl font-semibold tracking-tight">Danger zone</h2>
        <p className="text-sm text-muted">Deleting cannot be undone inside this studio. Download a backup first. Posts already on Ghost are not removed.</p>
        <input className={fieldClass} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder={site.name} aria-label="Type the workspace name to confirm" />
        <Button variant="danger" disabled={confirm !== site.name} onClick={() => deleteWorkspace(site.id)}>
          Delete workspace
        </Button>
      </Card>
      <Card className="scroll-mt-24 space-y-5 p-6" id="backup">
        <h2 className="text-xl font-semibold tracking-tight">Backup and recovery</h2>
        <p className="text-sm leading-6 text-muted">
          A backup holds this website’s settings, authors, plans, articles, links, runs, and usage. It never includes your Ghost Admin key or AI keys. Restore only adds missing records.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => createBackup()}>Create backup</Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line px-3 text-sm">
            Restore backup
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => restoreWorkspace(String(reader.result ?? ""));
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
        <ul className="divide-y divide-line">
          {backups.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>
                <span className="block">{row.articles} articles · {row.edges} links · {Math.max(1, Math.round(row.bytes / 1024))} KB</span>
                <span className="text-xs text-faint">
                  {new Date(row.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} · {row.checksum}
                  {row.verified === true ? " · verified" : row.verified === false ? " · failed" : ""}
                </span>
              </span>
              <span className="flex gap-2">
                <Button variant="ghost" onClick={() => verifyBackup(row.id)}>
                  Verify
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const blob = new Blob([row.payload], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${row.siteName.replace(/\s+/g, "-").toLowerCase()}-backup.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download
                </Button>
              </span>
            </li>
          ))}
          {!backups.length ? <li className="py-3 text-sm text-muted">No backups stored for this workspace yet.</li> : null}
        </ul>
      </Card>
      <Card className="grid gap-2 p-5 text-sm sm:grid-cols-2">
        <Link className="rounded-lg border border-line px-3 py-3" to="/settings/content">
          Content defaults
        </Link>
        <Link className="rounded-lg border border-line px-3 py-3" to="/authors">
          Authors and bylines
        </Link>
        <Link className="rounded-lg border border-line px-3 py-3" to="/static-delivery">
          Static customization
        </Link>
        <Link className="rounded-lg border border-line px-3 py-3" to="/connections">
          Connections
        </Link>
      </Card>
    </div>
  );
}
