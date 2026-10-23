import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { previewAuthorMatch } from "@/lib/authors";
import { avatarProxySrc, avatarSeed, portraitDataUri } from "@/lib/avatar";
import { useApp } from "@/lib/store";
import type { AuthorProfile } from "@/lib/types";
import { Card, Empty, PageIntro } from "@/components/ui";

/**
 * Author portrait: the external AI-portrait URL first (with
 * `referrerPolicy="no-referrer"` so ORB/CORP/referrer rules do not block the
 * hotlink), then the in-memory server proxy, then a deterministic inline SVG
 * portrait — so a portrait always renders, always with zero disk storage.
 */
export function AuthorAvatar({ author, size = 44 }: { author: AuthorProfile; size?: number }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const seed = avatarSeed(author.avatarUrl) ?? author.id;
  const initials = author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  if (stage === 2) {
    return (
      <img
        src={portraitDataUri(seed, author.name, Math.max(96, size * 2))}
        alt={`Portrait of ${author.name}`}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const src = stage === 0 ? author.avatarUrl : avatarProxySrc({ ...author, avatarUrl: author.avatarUrl }, Math.max(96, size * 2));
  return (
    <img
      src={src || portraitDataUri(seed, author.name, Math.max(96, size * 2))}
      alt={`Portrait of ${author.name}`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      data-avatar-stage={stage === 0 ? "direct" : "proxy"}
      className="shrink-0 rounded-full bg-surface-2 object-cover"
      style={{ width: size, height: size }}
      onError={() => setStage((current) => (current === 0 ? 1 : 2))}
      title={initials}
    />
  );
}

/** Compact initials badge used when a portrait is not wanted at all. */
export function AuthorInitials({ author, size = 44 }: { author: AuthorProfile; size?: number }) {
  const initials = author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-brass/15 text-sm font-semibold text-brass"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

function CapacityMeter({ author }: { author: AuthorProfile }) {
  const pct = Math.min(100, Math.round((author.articleCount / Math.max(1, author.maxArticles)) * 100));
  const capped = author.articleCount >= author.maxArticles;
  return (
    <div className="min-w-36">
      <div className="flex items-center justify-between gap-3 font-mono text-[13px] tabular-nums text-muted">
        <span>
          {author.articleCount} / {author.maxArticles} articles
        </span>
        <span>{pct}%</span>
      </div>
      <div role="progressbar" aria-label={`${author.name} article capacity`} aria-valuenow={author.articleCount} aria-valuemin={0} aria-valuemax={author.maxArticles} className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div className={capped ? "h-full rounded-full bg-red-500" : "h-full rounded-full bg-brass"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function stateBadge(author: AuthorProfile): { label: string; className: string } {
  if (author.articleCount >= author.maxArticles || author.status === "retired")
    return { label: `Capped at ${author.maxArticles}`, className: "border-red-400/40 bg-red-500/10 text-red-500" };
  return { label: "Active", className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-600" };
}

function ghostBadge(author: AuthorProfile): string {
  return author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId.slice(0, 10)}…` : "local byline";
}

function EngineBanner() {
  return (
    <div className="rounded-lg border border-line bg-brass/5 p-4 text-sm">
      <div className="font-semibold tracking-tight">Auto-Author Engine Active (250-article cap · US Personas · Zero-Disk Avatars)</div>
      <p className="mt-1 text-muted">
        Authors are created and assigned automatically by niche expertise — you never have to make one before a run. Each expert writes in a
        unique humanized voice, retires at 250 articles, and the niche rotates to a fresh US expert. Avatars live as external URL strings
        (thispersondoesnotexist.com) — nothing is ever downloaded to disk.
      </p>
    </div>
  );
}

function MatchSimulator() {
  const siteId = useApp((s) => s.activeSiteId);
  const authors = useApp((s) => s.authors);
  const addExpertAuthor = useApp((s) => s.addExpertAuthor);
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<null | { matched: string; created: string; stem: string }>(null);
  const run = () => {
    const niche = topic.trim();
    if (niche.length < 3) return;
    const preview = previewAuthorMatch(siteId, authors, niche);
    setResult({
      matched: preview.matched ? `${preview.matched.name} (${preview.matched.articleCount}/${preview.matched.maxArticles} · ${preview.matched.expertise[0]})` : "",
      created: preview.wouldGenerate ? `New US expert author would be spawned for “${preview.stem}”.` : "",
      stem: preview.stem,
    });
  };
  return (
    <Card className="p-4">
      <h2 className="font-semibold tracking-tight">Test niche match / auto-generate expert</h2>
      <p className="mt-1 text-xs text-faint">
        Type any niche or keyword and watch the engine either pick an eligible under-250 expert or plan a new US expert.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="min-w-56 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brass/40"
          placeholder="e.g. phd funding, home espresso, rrsp planning…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
        />
        <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-brass/10" onClick={run}>
          Dry-run match
        </button>
        <button
          type="button"
          className="rounded-lg bg-brass px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          onClick={() => addExpertAuthor(topic.trim() || "general research")}
        >
          Auto-Generate US Expert Author
        </button>
      </div>
      {result ? (
        <div className="mt-3 rounded-lg border border-line bg-paper/60 p-3 text-sm">
          {result.matched ? (
            <div>
              Picked eligible expert: <strong>{result.matched}</strong>
            </div>
          ) : (
            <div className="text-brass">{result.created}</div>
          )}
          <div className="mt-1 text-xs text-faint">Primary niche token: {result.stem}</div>
        </div>
      ) : null}
    </Card>
  );
}

export function AuthorsPage() {
  const siteId = useApp((s) => s.activeSiteId);
  const authorList = useApp((s) => s.authors);
  const authors = useMemo(() => authorList.filter((author) => author.siteId === siteId), [authorList, siteId]);

  return (
    <div>
      <PageIntro
        eyebrow="Settings"
        title="Authors & Bylines"
        lede="The smart auto-author engine assigns a US expert to every job. Manual control stays here for power users — there is no cap on how many experts the studio can hold."
      />
      <div className="space-y-4">
        <EngineBanner />
        <MatchSimulator />
        {!authors.length ? (
          <Empty title="No authors yet" body="They spawn automatically the moment a job in any niche is queued. Or use the generator above." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {authors.map((author) => {
              const badge = stateBadge(author);
              return (
                <Card key={author.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <AuthorAvatar author={author} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link to="/authors/$id" params={{ id: author.id }} className="font-semibold tracking-tight">
                          {author.name}
                        </Link>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
                      </div>
                      <div className="text-sm text-muted">
                        {author.city}, {author.region} · US
                      </div>
                      <div className="mt-0.5 text-sm text-faint">{author.role}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {author.expertise.map((tag) => (
                          <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <CapacityMeter author={author} />
                        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-faint">{ghostBadge(author)}</span>
                      </div>
                      <div className="mt-2 text-xs text-faint">
                        Voice: {author.voice.tone} · {author.voice.sentenceLengthBand} · {author.voice.pov}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuthorDetail({ id }: { id: string }) {
  const author = useApp((s) => s.authors.find((item) => item.id === id));
  const articleList = useApp((s) => s.articles);
  const patchAuthor = useApp((s) => s.patchAuthor);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const articles = useMemo(() => articleList.filter((article) => article.authorId === id), [articleList, id]);
  if (!author) return <Empty title="Author missing" body="This byline is not in the studio." />;
  const badge = stateBadge(author);
  const startEdit = () => {
    setDraftName(author.name);
    setDraftRole(author.role);
    setDraftBio(author.shortBio);
    setEditing(true);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-start gap-4">
          <AuthorAvatar author={author} size={64} />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-faint">Author</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{author.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {author.role}
              <br />
              {author.city}, {author.region}, US
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full border px-2 py-0.5 ${badge.className}`}>{badge.label}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-faint">
                {author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId}` : "local byline"}
              </span>
              <span className="rounded-full border border-line px-2 py-0.5 text-faint">{author.origin === "auto" ? "auto-generated" : "manual"}</span>
            </div>
          </div>
        </div>
        <CapacityMeter author={author} />
        {editing ? (
          <div className="mt-4 space-y-2 text-sm">
            <input className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:ring-2 focus:ring-brass/40" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            <input className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:ring-2 focus:ring-brass/40" value={draftRole} onChange={(e) => setDraftRole(e.target.value)} />
            <textarea className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:ring-2 focus:ring-brass/40" rows={3} value={draftBio} onChange={(e) => setDraftBio(e.target.value)} />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-brass px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                onClick={() => {
                  patchAuthor(author.id, { name: draftName.trim() || author.name, role: draftRole.trim() || author.role, shortBio: draftBio.trim() || author.shortBio });
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6">{author.shortBio}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {author.expertise.map((item) => (
                <li key={item} className="rounded-full border border-line px-2 py-1 text-xs text-muted">
                  {item}
                </li>
              ))}
            </ul>
            <button type="button" className="mt-4 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-brass/10" onClick={startEdit}>
              Edit byline
            </button>
          </>
        )}
        <div className="mt-5 rounded-lg border border-line bg-paper/60 p-3 text-xs leading-5 text-muted">
          <div className="font-semibold text-foreground">Voice signature</div>
          <div className="mt-1">Tone: {author.voice.tone}</div>
          <div>Rhythm: {author.voice.rhythm}</div>
          <div>Diction: {author.voice.diction}</div>
          <div>
            Sentences: {author.voice.sentenceLengthBand} · POV: {author.voice.pov} · Level: {author.voice.readingLevel}
          </div>
          <div className="mt-1">Signature moves: {author.voice.signatureMoves.join("; ")}</div>
          <div>Refuses: {author.voice.bannedPhrases.join(", ")}</div>
        </div>
        <div className="mt-3 truncate text-xs text-faint">Avatar (external, zero-disk): {author.avatarUrl}</div>
      </Card>
      <Card className="p-5 lg:col-span-3">
        <h2 className="font-semibold tracking-tight">Articles on this beat</h2>
        <ul className="mt-3 divide-y divide-line">
          {articles.map((article) => (
            <li key={article.id} className="py-3">
              <Link to="/articles/$id" params={{ id: article.id }} className="font-medium">
                {article.title}
              </Link>
              <div className="text-xs text-faint">/{article.slug}</div>
            </li>
          ))}
          {!articles.length ? <li className="py-4 text-sm text-muted">No articles assigned yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
