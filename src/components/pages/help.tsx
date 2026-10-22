import { Link } from "@tanstack/react-router";
import { Card, PageIntro } from "@/components/ui";

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
  return (
    <div>
      <PageIntro
        eyebrow="Operator guide"
        title="First week, in order"
        lede="This is the working path inside the studio. Ghost AI Writer does not invent rankings or bill you for AI — your own key is billed by your provider. It publishes to Ghost, or to the studio ledger when you are practising."
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
