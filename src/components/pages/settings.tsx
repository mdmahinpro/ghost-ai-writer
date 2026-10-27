import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Database } from "lucide-react";
import { useApp } from "@/lib/store";
import { BLADER_SOURCE, BLADER_VERSION } from "@/lib/humanizer";
import { Badge, Button, PageIntro, fieldClass } from "@/components/ui";
import { ThemePicker } from "@/components/theme-picker";
import type { VoiceSettings } from "@/lib/types";

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

function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {hint ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

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
    <div className="space-y-5">
      <PageIntro
        eyebrow="Settings"
        title="Content"
        lede="Account defaults and this website's overrides. Duplicate thresholds stay 0.85 lexical and 0.88 semantic. Keyword batching and job concurrency are yours to set."
      />
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <SectionHead
          title="Appearance"
          hint="Two modes, one design: Midnight for long night sessions, Paper for bright rooms. The site preview follows the studio, and the choice stays after a reload."
        />
        <div className="px-5 py-5">
          <ThemePicker variant="section" />
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <SectionHead
          title="Scale &amp; limits"
          hint="Leave a field empty for unlimited. These knobs replace the old hard caps (100 keywords / 2 jobs / 20 ideas / restart 5) so a 10,000+ article run is a configuration choice, not a blocker."
        />
        <div className="divide-y divide-line">
          <SettingRow label="Keywords per run" hint="Empty = unlimited. A 10,000-line batch is accepted; large batches gate L1+L2 at intake and re-check L3 at publish.">
            <input
              className={`${fieldClass} font-mono tabular-nums`}
              type="number"
              min={1}
              placeholder="unlimited"
              value={limits.keywordCap ?? ""}
              onChange={(e) => patchLimits({ keywordCap: e.target.value === "" ? null : Math.max(1, Number(e.target.value)) })}
            />
          </SettingRow>
          <SettingRow label="Concurrent article jobs per website" hint="How many jobs generate at once. Higher = faster bulk runs.">
            <input
              className={`${fieldClass} font-mono tabular-nums`}
              type="number"
              min={1}
              value={limits.concurrency}
              onChange={(e) => patchLimits({ concurrency: Math.max(1, Number(e.target.value) || 1) })}
            />
          </SettingRow>
          <SettingRow label="Ideas per round" hint="Empty = unlimited (bounded by what the corpus leaves uncovered).">
            <input
              className={`${fieldClass} font-mono tabular-nums`}
              type="number"
              min={1}
              placeholder="unlimited"
              value={limits.ideaCap ?? ""}
              onChange={(e) => patchLimits({ ideaCap: e.target.value === "" ? null : Math.max(1, Number(e.target.value)) })}
            />
          </SettingRow>
          <SettingRow label="Automatic restarts per job" hint="Empty = unlimited retries of a failed job.">
            <input
              className={`${fieldClass} font-mono tabular-nums`}
              type="number"
              min={0}
              placeholder="unlimited"
              value={limits.restartLimit ?? ""}
              onChange={(e) => patchLimits({ restartLimit: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            />
          </SettingRow>
          <SettingRow label="Static build history" hint="Empty = unlimited local build records.">
            <input
              className={`${fieldClass} font-mono tabular-nums`}
              type="number"
              min={1}
              placeholder="unlimited"
              value={limits.buildHistory ?? ""}
              onChange={(e) => patchLimits({ buildHistory: e.target.value === "" ? null : Math.max(1, Number(e.target.value)) })}
            />
          </SettingRow>
        </div>
      </section>
      <VoiceCard title="Account defaults" voice={defaults} keys={keys} onChange={patchDefaults} />
      <VoiceCard title={`${site.name} overrides`} voice={site.voice} keys={keys} onChange={patchVoice} site />
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <SectionHead
          title="Blader humanizer"
          action={<Badge tone="ok">engine on · {BLADER_VERSION}</Badge>}
          hint={`The external Metric37 API is replaced by the native blader/humanizer engine (${BLADER_SOURCE}). Stage 2 drafts avoid the 26 AI-writing patterns from the start; Stage 3 revision runs a deterministic scrub plus a two-pass surgical audit and rewrite through the model key pool, in the assigned author's voice. Tables, links, headings and the direct-answer opening are preserved structurally.`}
        />
        <ul className="divide-y divide-line">
          <li className="px-5 py-3 text-[13px] leading-5 text-muted">Score: every article carries a 0–100 prose-purity score after humanization.</li>
          <li className="px-5 py-3 text-[13px] leading-5 text-muted">Stripped tells: the article detail page lists each AI pattern the rewrite removed.</li>
          <li className="px-5 py-3 text-[13px] leading-5 text-muted">No extra key needed: the deterministic pass always runs; usable model keys add the LLM passes.</li>
        </ul>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <SectionHead title="Read-only contracts" />
        <ul className="divide-y divide-line">
          <li className="px-5 py-3 text-[13px] leading-5 text-muted">
            Keyword batching: {limits.keywordCap == null ? "unlimited" : `${limits.keywordCap} per run`}. Concurrency: <span className="num text-fg">{limits.concurrency}</span> job
            {limits.concurrency === 1 ? "" : "s"} in flight per website.
          </li>
          <li className="px-5 py-3 text-[13px] leading-5 text-muted">Link intensity: light 1–2, standard 2–4, dense 4–6. Targets must already exist.</li>
          <li className="px-5 py-3 text-[13px] leading-5 text-muted">Stage 6 records zero LLM tokens. Embeddings are metered separately.</li>
          <li className="px-5 py-3 text-[13px] leading-5 text-muted">Publish mode freezes on the run. It does not follow a later settings change.</li>
          <li className="px-5 py-3 text-[13px] leading-5 text-muted">
            Web search: <span className="text-fg">{webSearch.mode}</span> · <span className="num">{webSearch.tavilyKeys.length}</span> Tavily key
            {webSearch.tavilyKeys.length === 1 ? "" : "s"} · <span className="num">{webSearch.firecrawlKeys.length}</span> Firecrawl key
            {webSearch.firecrawlKeys.length === 1 ? "" : "s"} (switch lives on AI Keys &amp; Usage).
          </li>
        </ul>
      </section>
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
    <section className="overflow-hidden rounded-xl border border-line bg-elev">
      <SectionHead title={title} />
      <div className="divide-y divide-line">
        <SettingRow label="Model">
          <select className={fieldClass} value={voice.modelKeyId} onChange={(e) => onChange({ modelKeyId: e.target.value })}>
            {keys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.label}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Publish as">
          <select className={fieldClass} value={voice.publishAs} onChange={(e) => onChange({ publishAs: e.target.value as VoiceSettings["publishAs"] })}>
            <option value="draft">Draft</option>
            <option value="live">Live</option>
          </select>
        </SettingRow>
        <SettingRow label="Tone">
          <input className={fieldClass} value={voice.tone} onChange={(e) => onChange({ tone: e.target.value })} />
        </SettingRow>
        <SettingRow label="Voice">
          <input className={fieldClass} value={voice.voice} onChange={(e) => onChange({ voice: e.target.value })} />
        </SettingRow>
        <SettingRow label="Point of view">
          <select className={fieldClass} value={voice.pov} onChange={(e) => onChange({ pov: e.target.value as VoiceSettings["pov"] })}>
            <option value="first-person">First person</option>
            <option value="second-person">Second person</option>
            <option value="third-person">Third person</option>
          </select>
        </SettingRow>
        <SettingRow label="Reading level">
          <select className={fieldClass} value={voice.readingLevel} onChange={(e) => onChange({ readingLevel: e.target.value as VoiceSettings["readingLevel"] })}>
            <option value="grade-7">Grade 7</option>
            <option value="general">General</option>
            <option value="expert">Expert</option>
          </select>
        </SettingRow>
        <SettingRow label="Banned phrases" hint="One phrase per line. The model must not use these phrases.">
          <textarea className={fieldClass} rows={3} value={(voice.bannedPhrases ?? []).join("\n")} onChange={(e) => onChange({ bannedPhrases: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })} />
        </SettingRow>
        <SettingRow label="Brand facts" hint="One fact per line. These facts are asserted in every stage prompt.">
          <textarea className={fieldClass} rows={3} value={(voice.brandFacts ?? []).join("\n")} onChange={(e) => onChange({ brandFacts: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })} />
        </SettingRow>
        <SettingRow label="Sections / article">
          <input className={`${fieldClass} font-mono tabular-nums`} type="number" min={3} max={8} value={voice.sections} onChange={(e) => onChange({ sections: Number(e.target.value) })} />
        </SettingRow>
        <SettingRow label="Section images max">
          <input className={`${fieldClass} font-mono tabular-nums`} type="number" min={0} max={3} value={voice.sectionImages} onChange={(e) => onChange({ sectionImages: Number(e.target.value) })} />
        </SettingRow>
        {site ? (
          <>
            <SettingRow label="Link intensity">
              <select className={fieldClass} value={voice.linkIntensity} onChange={(e) => onChange({ linkIntensity: e.target.value as VoiceSettings["linkIntensity"] })}>
                <option value="light">Light · 1–2</option>
                <option value="standard">Standard · 2–4</option>
                <option value="dense">Dense · 4–6</option>
              </select>
            </SettingRow>
            <SettingRow label="Image provider" hint="Each post gets a featured photo plus section photos. Bing is searched first. If nothing relevant comes back, Openverse is used. Photos are copied onto this server, then into Ghost or the ZIP. Confirm rights before a page is public.">
              <select className={fieldClass} value={voice.imageProvider === "wikimedia" ? "wikimedia" : "bing"} onChange={(e) => onChange({ imageProvider: e.target.value })}>
                <option value="bing">Bing photos</option>
                <option value="wikimedia">Wikimedia Commons</option>
              </select>
            </SettingRow>
          </>
        ) : null}
      </div>
    </section>
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
    <div className="space-y-5">
      <PageIntro
        eyebrow="Settings"
        title="Website"
        lede={`${site.name} · ${site.id.slice(-8)} · ${site.ghost.mode === "live" ? "Live Ghost" : site.ghost.mode === "studio" ? "Sandbox" : "Ghost off"} · created ${new Date(site.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}`}
      />
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="divide-y divide-line">
          <SettingRow label="Workspace name">
            <input className={fieldClass} value={site.name} onChange={(e) => patchSite({ name: e.target.value })} />
          </SettingRow>
          <SettingRow label="Static site name">
            <input className={fieldClass} value={site.staticName} onChange={(e) => patchSite({ staticName: e.target.value })} />
          </SettingRow>
          <SettingRow label="Authors and bylines">
            <input className={fieldClass} value={site.authors} onChange={(e) => patchSite({ authors: e.target.value })} />
          </SettingRow>
          <SettingRow label="Niche tag">
            <input className={fieldClass} value={site.nicheTag} onChange={(e) => patchSite({ nicheTag: e.target.value })} />
          </SettingRow>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-danger/30 bg-elev">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-danger">Danger zone</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">Deleting cannot be undone inside this studio. Download a backup first. Posts already on Ghost are not removed.</p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <input className={`${fieldClass} sm:max-w-xs`} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder={site.name} aria-label="Type the workspace name to confirm" />
          <Button variant="danger" disabled={confirm !== site.name} onClick={() => deleteWorkspace(site.id)}>
            Delete workspace
          </Button>
        </div>
      </section>
      <section className="scroll-mt-24 overflow-hidden rounded-xl border border-line bg-elev" id="backup">
        <SectionHead
          title="Backup and recovery"
          hint="A backup holds this website’s settings, authors, plans, articles, links, runs, and usage. It never includes your Ghost Admin key or AI keys. Restore only adds missing records."
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <Button onClick={() => createBackup()}>Create backup</Button>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-fg transition-colors duration-150 hover:border-line-strong">
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
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-surface-2/60">
              <span className="min-w-0">
                <span className="block text-[13px] text-fg">
                  {row.articles} articles · {row.edges} links · {Math.max(1, Math.round(row.bytes / 1024))} KB
                </span>
                <span className="num mt-0.5 block truncate text-[10px] text-faint">
                  {new Date(row.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} · {row.checksum}
                  {row.verified === true ? " · verified" : row.verified === false ? " · failed" : ""}
                </span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => verifyBackup(row.id)}>
                  Verify
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
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
          {!backups.length ? (
            <li className="flex items-center gap-3 px-5 py-6">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 text-faint">
                <Database className="size-4" />
              </span>
              <span className="text-[13px] text-muted">No backups stored for this workspace yet.</span>
            </li>
          ) : null}
        </ul>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="divide-y divide-line">
          <Link className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] text-fg transition-colors duration-150 hover:bg-surface-2/60" to="/settings/content">
            Content defaults
            <ChevronRight aria-hidden="true" className="size-4 text-faint" />
          </Link>
          <Link className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] text-fg transition-colors duration-150 hover:bg-surface-2/60" to="/authors">
            Authors and bylines
            <ChevronRight aria-hidden="true" className="size-4 text-faint" />
          </Link>
          <Link className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] text-fg transition-colors duration-150 hover:bg-surface-2/60" to="/static-delivery">
            Static customization
            <ChevronRight aria-hidden="true" className="size-4 text-faint" />
          </Link>
          <Link className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] text-fg transition-colors duration-150 hover:bg-surface-2/60" to="/connections">
            Connections
            <ChevronRight aria-hidden="true" className="size-4 text-faint" />
          </Link>
        </div>
      </section>
    </div>
  );
}
