import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { Badge, Button, Card, PageIntro, fieldClass } from "@/components/ui";

function ghostMark(site: { ghost: { status: string; mode: string; lastError?: string } }) {
  if (site.ghost.status === "error") return { dot: "bg-danger", label: "Ghost refused the key", tone: "danger" as const };
  if (site.ghost.lastError) return { dot: "bg-brass", label: "Degraded", tone: "brass" as const };
  if (site.ghost.status === "connected" && site.ghost.mode === "studio") return { dot: "bg-ok", label: "Sandbox", tone: "ok" as const };
  if (site.ghost.status === "connected") return { dot: "bg-ok", label: "Connected", tone: "ok" as const };
  return { dot: "bg-faint", label: "Ghost not connected", tone: "muted" as const };
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
    <div>
      <PageIntro
        eyebrow="Owner"
        title="Website workspaces"
        lede="Each website is an isolated tenant — its own Ghost connection, articles, link graph and static site. This studio is yours: there is no workspace cap."
      />
      <Card className="mb-4 p-5">
        <h2 className="text-lg font-semibold">Find a niche</h2>
        <p className="mt-1 text-sm text-muted">Describe an interest. You get qualitative niche ideas only — no search volume or competition numbers.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${fieldClass} max-w-md`} value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="What do you want to write about?" aria-label="Niche interest" />
          <Button variant="ghost" disabled={niche.trim().length < 3} onClick={() => runIdeas(niche.trim(), 8)}>
            Discover
          </Button>
        </div>
        {ideas?.items.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {ideas.items.slice(0, 8).map((idea) => (
              <li key={idea.keyword} className="rounded-lg border border-line px-3 py-2 text-sm">
                <span className="block font-medium">{idea.keyword}</span>
                <span className="text-xs text-faint">{idea.reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">New website workspace</div>
          <p className="mt-1 text-xs text-faint">{sites.length} in use · unlimited · owner</p>
          <input
            className={`${fieldClass} mt-3`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="The Coffee Journal"
            aria-label="Website name"
          />
        </div>
        <Button
          disabled={name.trim().length < 2}
          onClick={() => {
            createWorkspace(name);
            setName("");
            void navigate({ to: "/" });
          }}
        >
          Create workspace
        </Button>
      </Card>
      {!sites.length ? (
        <Card className="p-8 text-center">
          <h2 className="text-base font-semibold text-fg">Create your first workspace</h2>
          <p className="mt-2 text-sm text-muted">
            This studio starts completely empty — no demo data. Create one workspace per website; it is saved to the server database so every browser and incognito window loads the exact same workspaces, keys, and articles.
          </p>
          <p className="mt-3 text-xs text-faint">Workspaces you create here sync to every device. Nothing is shared until you create it.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sites.map((site) => {
            const mark = ghostMark(site);
            const count = articles.filter((article) => article.siteId === site.id).length;
            const runCount = runs.filter((run) => run.siteId === site.id).length;
            const buildCount = builds.filter((item) => item.siteId === site.id).length;
            const open = confirmId === site.id;
            return (
              <Card key={site.id} className={`p-5 ${site.id === activeSiteId ? "border-brass" : ""}`}>
                <button
                  className="flex w-full items-start gap-3 text-left"
                  onClick={() => {
                    setSite(site.id);
                    void navigate({ to: "/" });
                  }}
                >
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${mark.dot}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-semibold tracking-tight">{site.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge tone={mark.tone}>{mark.label}</Badge>
                      <span>{count} articles</span>
                      <span>{runCount} runs</span>
                      <span>{buildCount} builds</span>
                      {site.id === activeSiteId ? <span className="text-brass">Active</span> : null}
                    </span>
                  </span>
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSite(site.id);
                      void navigate({ to: "/settings/website" });
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setConfirmId(open ? null : site.id);
                      setTyped("");
                    }}
                  >
                    Delete
                  </Button>
                </div>
                {open && pending ? (
                  <div className="mt-3 rounded-lg border border-danger/30 p-3">
                    <p className="text-sm text-muted">
                      Deletes articles, runs, plans, the link graph, builds, and the saved Ghost connection in this studio. Posts already on Ghost stay there.
                    </p>
                    <p className="mt-2 text-xs text-faint">Type the workspace name to confirm</p>
                    <input className={`${fieldClass} mt-2`} value={typed} onChange={(event) => setTyped(event.target.value)} aria-label="Type the workspace name to confirm" />
                    <Button
                      className="mt-2"
                      variant="danger"
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
