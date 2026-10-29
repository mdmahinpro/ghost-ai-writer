import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Globe } from "lucide-react";
import { useApp } from "@/lib/store";
import { stripVerify } from "@/lib/markdown";
import { cardCreditText, cardLedeText } from "@/lib/static-site";

/**
 * The preview is the website, not the studio: it renders on the site's own
 * paper palette at every studio theme, so what you approve is what visitors
 * get. The frame around it stays studio chrome and does follow the theme.
 */

/** Graceful state shown when the workspace has no website to preview yet. */
function NoSiteYet({ to, label }: { to: "/static-delivery" | "/preview"; label: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-line bg-elev px-6 py-20">
      <div className="text-center">
        <span aria-hidden="true" className="mx-auto grid size-10 place-items-center rounded-lg bg-brass/10 text-brass">
          <Globe className="size-5" />
        </span>
        <p className="mt-4 text-[13px] text-muted">No website to preview yet. Create one in the studio first.</p>
        <Link to={to} className="mt-3 inline-block text-[13px] font-medium text-fg underline underline-offset-4">
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
  const allAuthors = useApp((s) => s.authors);
  const articles = useMemo(() => allArticles.filter((article) => article.siteId === siteId), [allArticles, siteId]);
  const authors = useMemo(() => allAuthors.filter((author) => author.siteId === siteId), [allAuthors, siteId]);
  if (!site) return <NoSiteYet to="/static-delivery" label="Back to studio" />;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-elev">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{site.staticName}</p>
        <Link to="/static-delivery" className="shrink-0 text-[12px] text-muted transition-colors duration-150 hover:text-fg">
          Back to studio
        </Link>
      </div>
      <div className="site-surface">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
          <h1 className="text-[clamp(2.25rem,5.5vw,3.5rem)] leading-[1.05] tracking-[-0.01em]">{site.staticName}</h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-7 text-[var(--sp-muted)]">{site.footer}</p>
          <ul className="mt-10 divide-y divide-[var(--sp-line)] border-t border-[var(--sp-line)]">
            {articles.map((article) => {
              const photo = (article.images ?? []).find((image) => image.selected && image.src);
              const lede = cardLedeText(article);
              return (
                <li key={article.id} className="py-5">
                  <Link to="/preview/$slug" params={{ slug: article.slug }} className="group flex items-start gap-4">
                    {photo ? (
                      <img
                        src={photo.src}
                        alt=""
                        className="hidden aspect-[4/3] w-28 shrink-0 rounded-md border border-[var(--sp-line)] object-cover sm:block"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[26px] leading-[1.15] tracking-[-0.01em] underline-offset-4 group-hover:underline">
                        {article.title}
                      </span>
                      {lede ? <span className="mt-1.5 block text-[13.5px] leading-6 text-[var(--sp-faint)]">{lede}</span> : null}
                      {/* Word and link counts are production metrics, not reader
                          information: the published card credits the writer, their
                          expertise and the read time, and the preview must match. */}
                      <span className="site-ui mt-2 block text-[12.5px] leading-5 text-[var(--sp-muted)]">
                        {cardCreditText(
                          article,
                          authors.find((author) => author.id === article.authorId) ??
                            authors.find((author) => article.authorName && author.name === article.authorName),
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {!articles.length ? (
            <p className="site-ui mt-8 border-t border-[var(--sp-line)] pt-5 text-[13px] text-[var(--sp-muted)]">
              This website has no pages yet.
            </p>
          ) : null}
          <p className="site-ui mt-10 border-t border-[var(--sp-line)] pt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--sp-muted)]">
            {site.authors}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PreviewArticle({ slug }: { slug: string }) {
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId) ?? s.sites[0]);
  const authors = useApp((s) => s.authors);
  const article = useApp((s) => s.articles.find((item) => item.siteId === s.activeSiteId && item.slug === slug));
  if (!site) return <NoSiteYet to="/static-delivery" label="Back to studio" />;
  if (!article) {
    return (
      <div className="grid place-items-center rounded-xl border border-line bg-elev px-6 py-20">
        <div className="text-center">
          <span aria-hidden="true" className="mx-auto grid size-10 place-items-center rounded-lg bg-surface-2 text-faint">
            <Globe className="size-5" />
          </span>
          <p className="mt-4 text-[13px] text-muted">That page is not in the current website.</p>
          <Link to="/preview" className="mt-3 inline-block text-[13px] font-medium text-fg underline underline-offset-4">
            Home
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-elev">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-3">
        <Link
          to="/preview"
          className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors duration-150 hover:text-fg"
        >
          {site.staticName}
        </Link>
      </div>
      <div className="site-surface">
        <article className="mx-auto w-full max-w-[68ch] px-6 py-10 sm:px-10 sm:py-14">
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[1.06] tracking-[-0.01em]">{article.title}</h1>
          <p className="site-ui mt-3 text-[13px] leading-5 text-[var(--sp-muted)]">
            {cardCreditText(
              article,
              authors.find((author) => author.id === article.authorId) ??
                authors.find((author) => article.authorName && author.name === article.authorName),
            )}
          </p>
          <div className="reading-prose mt-8 text-[19px] leading-[1.75] [&_a]:underline [&_a]:underline-offset-2" dangerouslySetInnerHTML={{ __html: stripVerify(article.html) }} />
          <p className="site-ui mt-12 border-t border-[var(--sp-line)] pt-4 text-[11px] leading-5 text-[var(--sp-muted)]">{site.footer}</p>
        </article>
      </div>
    </div>
  );
}
