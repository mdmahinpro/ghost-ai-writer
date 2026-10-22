import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { stripVerify } from "@/lib/markdown";

/** Graceful state shown when the workspace has no website to preview yet. */
function NoSiteYet({ to, label }: { to: "/static-delivery" | "/preview"; label: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6 text-paper-ink">
      <div className="text-center">
        <p>No website to preview yet. Create one in the studio first.</p>
        <Link to={to} className="mt-3 inline-block text-sm underline">
          {label}
        </Link>
      </div>
    </div>
  );
}

export function PreviewHome() {
  const siteId = useApp((s) => s.activeSiteId);
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]);
  const allArticles = useApp((s) => s.articles);
  const articles = useMemo(() => allArticles.filter((article) => article.siteId === siteId), [allArticles, siteId]);
  if (!site) return <NoSiteYet to="/static-delivery" label="Back to studio" />;
  return (
    <div className="min-h-screen bg-paper text-paper-ink">
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-xs uppercase tracking-widest text-paper-muted">{site.staticName}</p>
          <Link to="/static-delivery" className="font-sans text-xs text-paper-muted">
            Back to studio
          </Link>
        </div>
        <h1 className="mt-6 font-display text-5xl leading-none">{site.staticName}</h1>
        <p className="mt-4 text-lg leading-8">{site.footer}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {articles.map((article) => {
            const photo = (article.images ?? []).find((image) => image.selected && image.src);
            return (
              <li key={article.id}>
                <Link to="/preview/$slug" params={{ slug: article.slug }} className="block">
                  {photo ? <img src={photo.src} alt="" className="aspect-video w-full rounded-lg object-cover" /> : null}
                  <span className="mt-2 block font-display text-2xl">{article.title}</span>
                </Link>
                <p className="mt-1 font-sans text-sm text-paper-muted">
                  {article.keyword} · {article.words} words · {article.links.length} links
                </p>
              </li>
            );
          })}
        </ul>
        {!articles.length ? <p className="mt-8 text-paper-muted">This website has no pages yet.</p> : null}
        <p className="mt-10 font-sans text-xs text-paper-muted">{site.authors}</p>
      </div>
    </div>
  );
}

export function PreviewArticle({ slug }: { slug: string }) {
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]);
  const article = useApp((s) => s.articles.find((item) => item.siteId === s.activeSiteId && item.slug === slug));
  if (!site) return <NoSiteYet to="/static-delivery" label="Back to studio" />;
  if (!article) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-6 text-paper-ink">
        <div>
          <p>That page is not in the current website.</p>
          <Link to="/preview" className="mt-3 inline-block text-sm">
            Home
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-paper text-paper-ink">
      <article className="mx-auto w-full max-w-[72ch] px-5 py-8 sm:py-12">
        <Link to="/preview" className="font-sans text-xs uppercase tracking-widest text-paper-muted">
          {site.staticName}
        </Link>
        <p className="mt-6 font-sans text-xs uppercase tracking-widest text-paper-muted">{article.keyword}</p>
        <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">{article.title}</h1>
        <div
          className="reading-prose mt-8 text-lg [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: stripVerify(article.html) }}
        />
        <p className="mt-10 font-sans text-sm text-paper-muted">{site.footer}</p>
      </article>
    </div>
  );
}
