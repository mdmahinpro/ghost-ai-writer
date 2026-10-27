import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Globe } from "lucide-react";
import { useApp } from "@/lib/store";
import { stripVerify } from "@/lib/markdown";

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
  const articles = useMemo(() => allArticles.filter((article) => article.siteId === siteId), [allArticles, siteId]);
  if (!site) return <NoSiteYet to="/static-delivery" label="Back to studio" />;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper text-paper-ink">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{site.staticName}</p>
        <Link to="/static-delivery" className="shrink-0 text-[12px] text-muted transition-colors duration-150 hover:text-fg">
          Back to studio
        </Link>
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="font-editorial text-[clamp(2.5rem,6vw,3.75rem)] leading-[1.02] tracking-[-0.02em]">{site.staticName}</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-paper-muted">{site.footer}</p>
        <ul className="mt-10 divide-y divide-line border-t border-line">
          {articles.map((article) => {
            const photo = (article.images ?? []).find((image) => image.selected && image.src);
            return (
              <li key={article.id} className="py-5">
                <Link to="/preview/$slug" params={{ slug: article.slug }} className="group flex items-start gap-4">
                  {photo ? <img src={photo.src} alt="" className="hidden aspect-[4/3] w-28 shrink-0 rounded-md border border-line object-cover sm:block" /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block font-editorial text-[26px] leading-[1.15] tracking-[-0.01em] underline-offset-4 group-hover:underline">{article.title}</span>
                    <span className="mt-2 block text-[10px] uppercase tracking-[0.12em] text-paper-muted">
                      {article.keyword} · {article.words} words · {article.links.length} links
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {!articles.length ? <p className="mt-8 border-t border-line pt-5 text-[13px] text-paper-muted">This website has no pages yet.</p> : null}
        <p className="mt-10 border-t border-line pt-4 text-[10px] uppercase tracking-[0.14em] text-paper-muted">{site.authors}</p>
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
    <div className="overflow-hidden rounded-xl border border-line bg-paper text-paper-ink">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <Link to="/preview" className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors duration-150 hover:text-fg">
          {site.staticName}
        </Link>
      </div>
      <article className="mx-auto w-full max-w-[72ch] px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-paper-muted">{article.keyword}</p>
        <h1 className="mt-3 font-editorial text-[clamp(2.25rem,5.5vw,3.5rem)] leading-[1.04] tracking-[-0.02em]">{article.title}</h1>
        <div
          className="reading-prose mt-9 text-lg [&_a]:underline [&_a]:underline-offset-2"
          dangerouslySetInnerHTML={{ __html: stripVerify(article.html) }}
        />
        <p className="mt-12 border-t border-line pt-4 text-[11px] leading-5 text-paper-muted">{site.footer}</p>
      </article>
    </div>
  );
}
