import type { Article, Persisted, Site } from "./types.ts";
import { hashStr } from "./utils.ts";

export type WorkspaceBackupFile = {
  kind: "gaw-workspace-backup";
  version: 1;
  exportedAt: number;
  site: Site;
  articles: Persisted["articles"];
  runs: Persisted["runs"];
  jobs: Persisted["jobs"];
  plans: Persisted["plans"];
  calendars: Persisted["calendars"];
  research: Persisted["research"];
  authors: Persisted["authors"];
  builds: Persisted["builds"];
  deploys: Persisted["deploys"];
  audits: Persisted["audits"];
  events: Persisted["events"];
  checksum: string;
};

function digest(body: Omit<WorkspaceBackupFile, "checksum">): string {
  return hashStr(JSON.stringify(body)).toString(16).padStart(8, "0");
}

export function packWorkspace(data: Persisted, siteId: string) {
  const site = data.sites.find((item) => item.id === siteId);
  if (!site) return null;
  const clean: Site = {
    ...site,
    ghost: { ...site.ghost, adminKey: undefined },
    // Rule 7 security invariant: no deploy credential ever leaves in an export.
    providers: site.providers.map((provider) => ({
      ...provider,
      ftp: provider.ftp ? { ...provider.ftp, password: "" } : provider.ftp,
      api: provider.api ? { ...provider.api, token: undefined } : provider.api,
    })),
  };
  const articles = data.articles.filter((item) => item.siteId === siteId);
  const body: Omit<WorkspaceBackupFile, "checksum"> = {
    kind: "gaw-workspace-backup",
    version: 1,
    exportedAt: Date.now(),
    site: clean,
    articles,
    runs: data.runs.filter((item) => item.siteId === siteId),
    jobs: data.jobs.filter((item) => item.siteId === siteId),
    plans: data.plans.filter((item) => item.siteId === siteId),
    calendars: data.calendars.filter((item) => item.siteId === siteId),
    research: data.research.filter((item) => item.siteId === siteId),
    authors: data.authors.filter((item) => item.siteId === siteId),
    builds: data.builds.filter((item) => item.siteId === siteId),
    deploys: data.deploys.filter((item) => item.siteId === siteId),
    audits: data.audits.filter((item) => item.siteId === siteId),
    events: data.events.filter((item) => item.siteId === siteId),
  };
  const checksum = digest(body);
  const file: WorkspaceBackupFile = { ...body, checksum };
  const payload = JSON.stringify(file);
  const edges = articles.reduce((sum, article) => sum + article.links.length, 0);
  return { payload, checksum, articles: articles.length, edges, bytes: payload.length, siteName: site.name, file };
}

export function readBackup(raw: string): { ok: true; file: WorkspaceBackupFile } | { ok: false; error: string; file?: WorkspaceBackupFile } {
  let parsed: WorkspaceBackupFile;
  try {
    parsed = JSON.parse(raw) as WorkspaceBackupFile;
  } catch {
    return { ok: false, error: "Could not read that backup file." };
  }
  if (parsed?.kind !== "gaw-workspace-backup" || !parsed.site?.id || !parsed.site.name) {
    return { ok: false, error: "That file is not a workspace backup." };
  }
  const { checksum, ...body } = parsed;
  const expect = digest(body);
  if (checksum !== expect) {
    return { ok: false, error: "Checksum failed. Create a new backup.", file: parsed };
  }
  return { ok: true, file: parsed };
}

export function linkCount(articles: Article[]): number {
  return articles.reduce((sum, article) => sum + article.links.length, 0);
}
