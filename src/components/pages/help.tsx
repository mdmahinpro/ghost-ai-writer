import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageIntro } from "@/components/ui";
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
    <div>
      <PageIntro
        eyebrow="Operator guide"
        title="First week, in order"
        lede="This is the working path inside the studio, plus a guide for every area of it. Ghost AI Writer does not invent rankings or bill you for AI — your own key is billed by your provider. It publishes to Ghost, or to the studio ledger when you are practising."
      />
      <div className="grid gap-3">
        {PATH.map(([title, body, href], index) => (
          <Link key={href} to={href} className="block">
            <Card className="flex gap-4 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line font-mono text-xs text-brass">{index + 1}</span>
              <span>
                <span className="block font-medium">{title}</span>
                <span className="mt-1 block text-sm leading-6 text-muted">{body}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-2xl">Guides</h2>
        <p className="mt-1 text-sm text-muted">
          {HELP_SECTIONS.reduce((total, section) => total + section.topics.length, 0)} guides, grouped the way the work happens. Pick one and it opens here.
        </p>
        <div className="mt-4 grid gap-4">
          {HELP_SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-[13px] font-semibold text-fg">{section.title}</h3>
              <ul className="mt-2 grid gap-1">
                {section.topics.map((topic) => (
                  <li key={topic.slug}>
                    <button
                      type="button"
                      aria-expanded={openSlug === topic.slug}
                      onClick={() => setOpenSlug(openSlug === topic.slug ? "" : topic.slug)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface/70 hover:text-fg aria-expanded:text-fg"
                    >
                      <span className="font-medium">{topic.title}</span>
                      <span className="ml-2 text-xs text-faint">{topic.lede}</span>
                    </button>
                    {openSlug === topic.slug ? (
                      <div className="mb-2 ms-2 mt-1 border-s border-line ps-3">
                        {topic.body.map((paragraph) => (
                          <p key={paragraph.slice(0, 32)} className="mt-1 text-sm leading-6 text-muted">
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
        {open ? null : <p className="mt-3 text-xs text-faint">Nothing open. The list above is complete without a selection.</p>}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-2xl">Six stages on every article</h2>
        <ol className="mt-3 space-y-2">
          {STAGES.map(([name, body], index) => (
            <li key={name} className="text-sm leading-6">
              <span className="text-brass">{index + 1}. {name}. </span>
              <span className="text-muted">{body}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card className="mt-4 p-5 text-sm leading-6 text-muted">
        <h2 className="font-display text-2xl text-fg">What this studio will not pretend</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>No search volume, keyword difficulty, or traffic charts.</li>
          <li>A provider marked CONFIGURED is not deployable until Test marks it VERIFIED. Upload still happens with your host.</li>
          <li>The worker badge is real for this panel. Offline keeps the queue and does not write.</li>
          <li>Duplicate protection runs at submit and again before publish. Review held means you decide.</li>
        </ul>
      </Card>
    </div>
  );
}
