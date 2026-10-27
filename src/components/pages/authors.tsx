import { Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { previewAuthorMatch } from "@/lib/authors";
import { avatarProxySrc, avatarSeed, isStoredPortrait, portraitDataUri, portraitSrc } from "@/lib/avatar";
import { useApp } from "@/lib/store";
import type { AuthorProfile } from "@/lib/types";
import { Button, Empty, PageIntro, fieldClass } from "@/components/ui";

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
        className="shrink-0 rounded-full border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const src = stage === 0 ? portraitSrc(author, Math.max(96, size * 2)) : avatarProxySrc({ ...author, avatarUrl: author.avatarUrl }, Math.max(96, size * 2));
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
      className="shrink-0 rounded-full border border-line bg-surface-2 object-cover"
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
      className="grid shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-display text-[13px] font-semibold text-muted"
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
    <div className="min-w-40 flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="num text-[11px] text-muted">
          {author.articleCount} / {author.maxArticles} articles
        </span>
        <span className="num text-[11px] text-faint">{pct}%</span>
      </div>
      <div role="progressbar" aria-label={`${author.name} article capacity`} aria-valuenow={author.articleCount} aria-valuemin={0} aria-valuemax={author.maxArticles} className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
        <div className={capped ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function stateBadge(author: AuthorProfile): { label: string; className: string } {
  if (author.articleCount >= author.maxArticles || author.status === "retired")
    return { label: `Capped at ${author.maxArticles}`, className: "border-danger/30 bg-danger/10 text-danger" };
  return { label: "Active", className: "border-ok/30 bg-ok/10 text-ok" };
}

function ghostBadge(author: AuthorProfile): string {
  return author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId.slice(0, 10)}…` : "local byline";
}

function EngineBanner() {
  return (
    <section className="rounded-xl border border-line bg-elev px-5 py-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-brass/10 text-brass">
          <Users className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Auto-Author Engine Active (250-article cap · US Personas · Zero-Disk Avatars)</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            Authors are created and assigned automatically by niche expertise — you never have to make one before a run. Each expert writes in a
            unique humanized voice, retires at 250 articles, and the niche rotates to a fresh US expert. Avatars live as external URL strings
            (thispersondoesnotexist.com) — nothing is ever downloaded to disk.
          </p>
        </div>
      </div>
    </section>
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
    <section className="overflow-hidden rounded-xl border border-line bg-elev">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Test niche match / auto-generate expert</h2>
        <p className="mt-1 text-[13px] leading-5 text-muted">
          Type any niche or keyword and watch the engine either pick an eligible under-250 expert or plan a new US expert.
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${fieldClass} min-w-56 flex-1 font-mono`}
            placeholder="e.g. phd funding, home espresso, rrsp planning…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
          />
          <Button variant="secondary" className="bg-surface" onClick={run}>
            Dry-run match
          </Button>
          <Button onClick={() => addExpertAuthor(topic.trim() || "general research")}>Auto-Generate US Expert Author</Button>
        </div>
        {result ? (
          <div className="mt-3 rounded-lg border border-line bg-surface px-3.5 py-3 text-[13px]">
            {result.matched ? (
              <div className="text-fg">
                Picked eligible expert: <strong className="font-semibold">{result.matched}</strong>
              </div>
            ) : (
              <div className="text-fg">{result.created}</div>
            )}
            <div className="mt-1 font-mono text-[11px] text-faint">Primary niche token: {result.stem}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AuthorsPage() {
  const siteId = useApp((s) => s.activeSiteId);
  const authorList = useApp((s) => s.authors);
  const captureAuthorPortrait = useApp((s) => s.captureAuthorPortrait);
  // Authors created before portraits were captured — or by an older sync — still
  // carry a generator URL. Capture those once per session: the generator ignores
  // its query and answers with a new stranger per request, so a profile without a
  // stored portrait shows a different face on every render.
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    for (const author of authorList) {
      if (author.siteId !== siteId || isStoredPortrait(author.avatarUrl)) continue;
      if (attempted.current.has(author.id)) continue;
      attempted.current.add(author.id);
      void captureAuthorPortrait(author.id);
    }
  }, [authorList, captureAuthorPortrait, siteId]);
  const authors = useMemo(() => authorList.filter((author) => author.siteId === siteId), [authorList, siteId]);

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Settings"
        title="Authors & Bylines"
        lede="The smart auto-author engine assigns a US expert to every job. Manual control stays here for power users — there is no cap on how many experts the studio can hold."
      />
      <EngineBanner />
      <MatchSimulator />
      {!authors.length ? (
        <Empty title="No authors yet" body="They spawn automatically the moment a job in any niche is queued. Or use the generator above." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {authors.map((author) => {
            const badge = stateBadge(author);
            return (
              <article key={author.id} className="rounded-xl border border-line bg-elev p-4 transition-colors duration-150 hover:border-line-strong">
                <div className="flex items-start gap-3">
                  <AuthorAvatar author={author} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link to="/authors/$id" params={{ id: author.id }} className="text-[15px] font-semibold tracking-[-0.01em] text-fg underline-offset-4 hover:underline">
                        {author.name}
                      </Link>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {author.city}, {author.region} · US
                    </div>
                    <div className="text-[12px] text-faint">{author.role}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {author.expertise.map((tag) => (
                        <span key={tag} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      <CapacityMeter author={author} />
                      <span className="num rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-faint">{ghostBadge(author)}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] leading-4 text-faint">
                      Voice: {author.voice.tone} · {author.voice.sentenceLengthBand} · {author.voice.pov}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
      <section className="rounded-xl border border-line bg-elev lg:col-span-2">
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-start gap-4">
            <AuthorAvatar author={author} size={64} />
            <div className="min-w-0">
              <p className="eyebrow">Author</p>
              <h1 className="display mt-1.5 text-fg">{author.name}</h1>
              <p className="mt-1.5 text-[13px] leading-5 text-muted">
                {author.role}
                <br />
                {author.city}, {author.region}, US
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                  {badge.label}
                </span>
                <span className="num rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-faint">
                  {author.ghostAuthorId ? `Ghost · ${author.ghostAuthorId}` : "local byline"}
                </span>
                <span className="num rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-faint">{author.origin === "auto" ? "auto-generated" : "manual"}</span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <CapacityMeter author={author} />
          </div>
        </div>
        <div className="px-5 py-5">
          {editing ? (
            <div className="space-y-2.5">
              <input className={fieldClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              <input className={fieldClass} value={draftRole} onChange={(e) => setDraftRole(e.target.value)} />
              <textarea className={fieldClass} rows={3} value={draftBio} onChange={(e) => setDraftBio(e.target.value)} />
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => {
                    patchAuthor(author.id, { name: draftName.trim() || author.name, role: draftRole.trim() || author.role, shortBio: draftBio.trim() || author.shortBio });
                    setEditing(false);
                  }}
                >
                  Save
                </Button>
                <Button variant="secondary" size="md" className="bg-surface" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[13px] leading-6 text-muted">{author.shortBio}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {author.expertise.map((item) => (
                  <li key={item} className="rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-muted">
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size="sm" className="mt-4 bg-surface" onClick={startEdit}>
                Edit byline
              </Button>
            </>
          )}
          <div className="mt-5 rounded-lg bg-surface-2 px-4 py-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Voice signature</div>
            <div className="mt-2 space-y-1 text-[12px] leading-5 text-muted">
              <div>Tone: {author.voice.tone}</div>
              <div>Rhythm: {author.voice.rhythm}</div>
              <div>Diction: {author.voice.diction}</div>
              <div>
                Sentences: {author.voice.sentenceLengthBand} · POV: {author.voice.pov} · Level: {author.voice.readingLevel}
              </div>
              <div>Signature moves: {author.voice.signatureMoves.join("; ")}</div>
              <div>Refuses: {author.voice.bannedPhrases.join(", ")}</div>
            </div>
          </div>
          <div className="num mt-3 truncate text-[10px] text-faint">Avatar (external, zero-disk): {author.avatarUrl}</div>
        </div>
      </section>
      <section className="self-start rounded-xl border border-line bg-elev lg:col-span-3">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Articles on this beat</h2>
        </div>
        <ul className="divide-y divide-line">
          {articles.map((article) => (
            <li key={article.id} className="px-5 py-3 transition-colors duration-150 hover:bg-surface-2/60">
              <Link to="/articles/$id" params={{ id: article.id }} className="text-[13px] font-medium text-fg underline-offset-4 hover:underline">
                {article.title}
              </Link>
              <div className="num mt-0.5 truncate text-[11px] text-faint">/{article.slug}</div>
            </li>
          ))}
          {!articles.length ? <li className="px-5 py-6 text-[13px] text-muted">No articles assigned yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
