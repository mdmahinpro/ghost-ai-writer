import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button, PageIntro, fieldClass } from "@/components/ui";

function ghostMark(site: { ghost: { status: string; mode: string; lastError?: string } }) {
  if (site.ghost.status === "error") return { dot: "bg-danger", label: "Ghost refused the key", tone: "danger" as const };
  if (site.ghost.lastError) return { dot: "bg-brass", label: "Degraded", tone: "brass" as const };
  if (site.ghost.status === "connected" && site.ghost.mode === "studio") return { dot: "bg-ok", label: "Sandbox", tone: "ok" as const };
  if (site.ghost.status === "connected") return { dot: "bg-ok", label: "Connected", tone: "ok" as const };
  return { dot: "bg-faint", label: "Ghost not connected", tone: "muted" as const };
}

function pillClass(tone: "ok" | "danger" | "brass" | "muted") {
  if (tone === "ok") return "border-ok/30 bg-ok/10 text-ok";
  if (tone === "danger") return "border-danger/30 bg-danger/10 text-danger";
  if (tone === "brass") return "border-brass/30 bg-brass/10 text-brass";
  return "border-line bg-surface text-muted";
}

export function WorkspacesPage() {
  const sites = useApp((s) => s.sites);
  const activeSiteId = useApp((s) => s.activeSiteId);
  const articles = useApp((s) => s.articles);
  const runs = useApp((s) => s.runs);
  const builds = useApp((s) => s.builds);
  const setSite = useApp((s) => s.setSite);
  const createWorkspace = useApp((s) => s.createWorkspace);
  const deleteWorkspace = useApp((s) => s.deleteWorkspace);
  const runIdeas = useApp((s) => s.runIdeas);
  const ideas = useApp((s) => s.ideas);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const navigate = useNavigate();
  const pending = sites.find((site) => site.id === confirmId);

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Owner"
        title="Website workspaces"
        lede="Each website is an isolated tenant — its own Ghost connection, articles, link graph and static site. This studio is yours: there is no workspace cap."
      />
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Find a niche</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">Describe an interest. You get qualitative niche ideas only — no search volume or competition numbers.</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <input className={`${fieldClass} max-w-md`} value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="What do you want to write about?" aria-label="Niche interest" />
            <Button variant="secondary" className="bg-surface" disabled={niche.trim().length < 3} onClick={() => runIdeas(niche.trim(), 8)}>
              Discover
            </Button>
          </div>
          {ideas?.items.length ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {ideas.items.slice(0, 8).map((idea) => (
                <li key={idea.keyword} className="rounded-md border border-line bg-surface px-3 py-2">
                  <span className="block text-[13px] font-medium text-fg">{idea.keyword}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-faint">{idea.reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">New website workspace</h2>
          <p className="mt-1 text-[12px] text-muted">
            <span className="num">{sites.length}</span> in use · unlimited · owner
          </p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end">
          <input
            className={fieldClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="The Coffee Journal"
            aria-label="Website name"
          />
          <Button
            className="sm:w-auto"
            disabled={name.trim().length < 2}
            onClick={() => {
              createWorkspace(name);
              setName("");
              void navigate({ to: "/" });
            }}
          >
            Create workspace
          </Button>
        </div>
      </section>
      {!sites.length ? (
        <section className="rounded-xl border border-line bg-elev px-6 py-12 text-center">
          <span aria-hidden="true" className="mx-auto grid size-10 place-items-center rounded-lg bg-brass/10 text-brass">
            <Layers className="size-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-fg">Create your first workspace</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-muted">
            This studio starts completely empty — no demo data. Create one workspace per website; it is saved to the server database so every browser and incognito window loads the exact same workspaces, keys, and articles.
          </p>
          <p className="mx-auto mt-3 max-w-md text-[11px] leading-5 text-faint">Workspaces you create here sync to every device. Nothing is shared until you create it.</p>
        </section>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sites.map((site) => {
            const mark = ghostMark(site);
            const count = articles.filter((article) => article.siteId === site.id).length;
            const runCount = runs.filter((run) => run.siteId === site.id).length;
            const buildCount = builds.filter((item) => item.siteId === site.id).length;
            const open = confirmId === site.id;
            return (
              <section key={site.id} className={`overflow-hidden rounded-xl border bg-elev ${site.id === activeSiteId ? "border-accent/40" : "border-line"}`}>
                <button
                  className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-surface-2/60"
                  onClick={() => {
                    setSite(site.id);
                    void navigate({ to: "/" });
                  }}
                >
                  <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${mark.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[16px] font-semibold tracking-[-0.01em] text-fg">{site.name}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${pillClass(mark.tone)}`}>
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                        {mark.label}
                      </span>
                      {site.id === activeSiteId ? <span className="text-[11px] font-medium text-accent">Active</span> : null}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                      <span className="num">{count} articles</span>
                      <span className="num">{runCount} runs</span>
                      <span className="num">{buildCount} builds</span>
                    </span>
                  </span>
                </button>
                <div className="flex flex-wrap gap-1.5 border-t border-line px-5 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSite(site.id);
                      void navigate({ to: "/settings/website" });
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setConfirmId(open ? null : site.id);
                      setTyped("");
                    }}
                  >
                    Delete
                  </Button>
                </div>
                {open && pending ? (
                  <div className="mx-5 mb-4 rounded-md border border-danger/30 bg-danger/5 p-3">
                    <p className="text-[12px] leading-5 text-muted">
                      Deletes articles, runs, plans, the link graph, builds, and the saved Ghost connection in this studio. Posts already on Ghost stay there.
                    </p>
                    <p className="mt-2 text-[11px] text-faint">Type the workspace name to confirm</p>
                    <input className={`${fieldClass} mt-2`} value={typed} onChange={(event) => setTyped(event.target.value)} aria-label="Type the workspace name to confirm" />
                    <Button
                      className="mt-2"
                      variant="danger"
                      size="sm"
                      disabled={typed !== pending.name}
                      onClick={() => {
                        deleteWorkspace(pending.id);
                        setConfirmId(null);
                        setTyped("");
                      }}
                    >
                      Delete workspace
                    </Button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
