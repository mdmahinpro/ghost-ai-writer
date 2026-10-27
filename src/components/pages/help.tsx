import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { PageIntro } from "@/components/ui";
import { HELP_SECTIONS, findHelpTopic } from "@/lib/help-topics";

const STAGES = [
  ["Intent & Blueprint", "Works out what the reader needs and plans the article."],
  ["Draft", "Writes the first version."],
  ["Revision", "Improves the draft against coverage."],
  ["Metadata", "Title, description, and tags."],
  ["Enrichment", "Relevant images and internal links to siblings only."],
  ["Validation & Publish", "Duplicate checks, then one Ghost write. This stage spends 0 LLM tokens."],
];

const PATH = [
  ["Get in", "Account holds the operator profile, email confirmation, and sessions.", "/account"],
  ["Workspace", "One website per blog. Rename, add, or remove one under Website settings.", "/settings/website"],
  ["Connect", "Studio ledger for practice, or a live Ghost Admin key. Sync inventory before a run.", "/connections"],
  ["AI key", "Bring your own base URL, model name, and key. Set a daily allowance. These keys also power the native Blader humanizer and Firecrawl search.", "/ai-keys"],
  ["Defaults", "Model, publish-as, tone, sections, images, and link intensity. First runs should save drafts.", "/settings/content"],
  ["Research", "Niche notes with evidence labels. No search volume. Turn a project into a plan when it is ready.", "/research"],
  ["Ideas", "On Create, suggest keywords. They are filtered against the corpus and are not auto-queued.", "/create"],
  ["Topic plan", "Pillar plus clusters. Exclude, edit, reorder, then queue selected. Clusters write before the pillar.", "/topic-plans"],
  ["Calendar", "Manual until you turn automation on. Write now holds the article until you publish it.", "/calendar"],
  ["Run", "Watch the six stages, refused keywords, review holds, and publish holds. Cancel or download CSV.", "/runs"],
  ["Article", "Uniqueness, links, images, ledger, and humanization. Authors are US names derived from the topic.", "/articles"],
  ["Links", "Analytics shows the graph and Bing checks. Connections audits up to five posts. Type APPLY before any edit.", "/analytics"],
  ["Static site", "Public URL first, then build, then deploy only to a verified host. Auto-rebuild is off until you enable it.", "/static-delivery"],
];

export function HelpPage() {
  // One selected guide at a time, in place. A guide is a working note: the
  // reader arrives with a problem, so the answer should not need a second page
  // load to reach.
  const [openSlug, setOpenSlug] = useState<string>("");
  const open = findHelpTopic(openSlug);

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Operator guide"
        title="First week, in order"
        lede="This is the working path inside the studio, plus a guide for every area of it. Ghost AI Writer does not invent rankings or bill you for AI — your own key is billed by your provider. It publishes to Ghost, or to the studio ledger when you are practising."
      />
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <ol className="divide-y divide-line">
          {PATH.map(([title, body, href], index) => (
            <li key={href}>
              <Link to={href} className="group flex items-start gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-2/60">
                <span className="num mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface text-[11px] text-faint">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-fg">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-muted">{body}</span>
                </span>
                <ArrowUpRight aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Guides</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
            {HELP_SECTIONS.reduce((total, section) => total + section.topics.length, 0)} guides, grouped the way the work happens. Pick one and it opens here.
          </p>
        </div>
        <div className="divide-y divide-line">
          {HELP_SECTIONS.map((section) => (
            <section key={section.title} className="px-5 py-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{section.title}</h3>
              <ul className="mt-2">
                {section.topics.map((topic) => (
                  <li key={topic.slug}>
                    <button
                      type="button"
                      aria-expanded={openSlug === topic.slug}
                      onClick={() => setOpenSlug(openSlug === topic.slug ? "" : topic.slug)}
                      className="w-full rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2/60 aria-expanded:bg-surface-2"
                    >
                      <span className="text-[13px] font-medium text-fg">{topic.title}</span>
                      <span className="ml-2 text-[12px] text-faint">{topic.lede}</span>
                    </button>
                    {openSlug === topic.slug ? (
                      <div className="mb-2 ms-2 mt-1 border-s border-line ps-3">
                        {topic.body.map((paragraph) => (
                          <p key={paragraph.slice(0, 32)} className="mt-1 text-[13px] leading-6 text-muted">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {open ? null : <p className="border-t border-line px-5 py-3 text-[11px] text-faint">Nothing open. The list above is complete without a selection.</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Six stages on every article</h2>
        </div>
        <ol className="divide-y divide-line">
          {STAGES.map(([name, body], index) => (
            <li key={name} className="px-5 py-3 text-[13px] leading-6">
              <span className="font-medium text-fg">
                {index + 1}. {name}.{" "}
              </span>
              <span className="text-muted">{body}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">What this studio will not pretend</h2>
        </div>
        <ul className="divide-y divide-line">
          <li className="px-5 py-2.5 text-[13px] leading-5 text-muted">No search volume, keyword difficulty, or traffic charts.</li>
          <li className="px-5 py-2.5 text-[13px] leading-5 text-muted">A provider marked CONFIGURED is not deployable until Test marks it VERIFIED. Upload still happens with your host.</li>
          <li className="px-5 py-2.5 text-[13px] leading-5 text-muted">The worker badge is real for this panel. Offline keeps the queue and does not write.</li>
          <li className="px-5 py-2.5 text-[13px] leading-5 text-muted">Duplicate protection runs at submit and again before publish. Review held means you decide.</li>
        </ul>
      </section>
    </div>
  );
}
