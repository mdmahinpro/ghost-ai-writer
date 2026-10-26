/**
 * The guide library.
 *
 * The reference platform publishes one help page per topic; this is the same
 * coverage for this studio, and every line describes what this program actually
 * does — routes, buttons and failure modes as they exist here, not as they exist
 * somewhere else. Where a thing is genuinely not built yet, the guide says so
 * instead of describing a feature that would then feel broken.
 */
export type HelpTopic = {
  slug: string;
  title: string;
  /** One line in the index, so a reader knows whether to open it. */
  lede: string;
  /** Paragraphs. Kept short on purpose: a guide is a working note, not an essay. */
  body: string[];
};

export type HelpSection = {
  title: string;
  topics: HelpTopic[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Start here",
    topics: [
      {
        slug: "start-here",
        title: "Start here: your first week",
        lede: "The order that avoids rework.",
        body: [
          "Week one is a straight line: account, workspace, connection, key, defaults, research, plan, run, article, build, deploy.",
          "Do not skip the connection check. A Ghost key that has not been tested is a key that will fail at publish time, and the article will be held rather than lost — but you will have spent the tokens.",
          "Save drafts for the first runs. Read the six stages on a finished article before you let one go live; that is cheaper than fixing a published mistake.",
        ],
      },
      {
        slug: "glossary",
        title: "Glossary",
        lede: "The words this studio uses, and what they mean here.",
        body: [
          "Workspace: one website. Everything — keys, authors, articles, builds — belongs to a workspace, and switching your active workspace switches all of it.",
          "Run: one batch of keywords pushed through the six stages. A run holds many jobs, and a job is one keyword.",
          "Corpus: every article this site already owns, drafts included. The duplicate gate reads it, and so do the internal-link tools.",
          "Hold: the pipeline stopped on purpose rather than publishing something doubtful. There are review holds (your call) and publish holds (Ghost refused or the connection was missing).",
          "Slot: one place an image belongs in an article (featured, inline, section). A slot resolves to a photo, and can be retried.",
          "Enrichment: stage five. It picks internal links from your published inventory and the photo for each slot.",
          "IndexNow: the ping that tells Bing the changed URLs. It needs an IndexNow key and a live site.",
        ],
      },
    ],
  },
  {
    title: "Get into your account",
    topics: [
      {
        slug: "create-your-account",
        title: "Create your account",
        lede: "What the account is for, and what it is not.",
        body: [
          "The Account page holds your operator profile, your email confirmation state, and your sessions.",
          "Your AI provider is billed by your provider, never by this studio: you bring a base URL, a model name and a key of your own.",
        ],
      },
      {
        slug: "sign-in-and-reset-your-password",
        title: "Sign in or reset your password",
        lede: "Getting back in without losing work.",
        body: [
          "Signing out does not touch your data: the workspace lives in the studio's own storage and on the server, not in the session.",
          "If you are signed out and need to work, the studio still opens — the pipeline is the server's, and it keeps running whether or not a browser is watching.",
        ],
      },
      {
        slug: "keep-your-account-secure",
        title: "Change your password or end sessions",
        lede: "Turning off the machines that should not still be in.",
        body: [
          "Ending sessions is the blunt but effective move: it invalidates every other tab immediately.",
          "Never paste your Ghost Admin key or your AI key into a message, a ticket or a screenshot. Nobody legitimate needs it in writing.",
        ],
      },
    ],
  },
  {
    title: "Set up a website",
    topics: [
      {
        slug: "create-a-website-workspace",
        title: "Create a website workspace",
        lede: "One website, one workspace, its own keys.",
        body: [
          "Create the workspace before you create a key. Keys are bound to the workspace that saved them: there is no account-wide default, so a new workspace starts with no key at all, exactly as it should.",
          "The domain you enter here is what the builds, the links and the name of the site are built from. Get it right at this point and nothing later needs correction.",
        ],
      },
      {
        slug: "use-the-setup-guide",
        title: "Use the Setup guide",
        lede: "The five things a new workspace needs.",
        body: [
          "A new workspace needs five things in order: a Ghost connection (or Studio mode to practise), an AI key with a daily allowance, content defaults, at least one author, and a public URL if you want to deploy.",
          "The Overview dashboard reports which of those are missing. Nothing else on this platform will behave correctly until they are all green, which is why the checklist exists.",
        ],
      },
      {
        slug: "switch-rename-or-delete-a-workspace",
        title: "Switch, rename or delete a workspace",
        lede: "Including what a delete refuses to take with it.",
        body: [
          "Switching workspaces switches keys, authors, articles, builds and deploys together. There is no mixing between them.",
          "Deleting refuses while runs, jobs, builds or deploys are still active — cancel those first. That refusal is the point: a half-deleted workspace leaves orphaned files on a live host.",
        ],
      },
      {
        slug: "understand-the-overview-dashboard",
        title: "Understand your Overview",
        lede: "Reading the dashboard without guessing.",
        body: [
          "Overview is a status page, not a scoreboard: connections, key health, queue depth, worker lease, last build and last deploy.",
          "The worker badge is real. If the lease is not held, the queue is not being worked, and waiting will not change that.",
        ],
      },
    ],
  },
  {
    title: "Connect your blog and AI",
    topics: [
      {
        slug: "connect-your-ghost-website",
        title: "Connect your Ghost website",
        lede: "The admin key, the origin, and the mode.",
        body: [
          "You need the Ghost site's https origin and an Admin API key. The key is issued by Ghost and looks like an id and a secret joined by a colon.",
          "The connection mode decides what a publish does: a live connection writes the post to Ghost, Studio mode keeps everything in the studio ledger so you can practise without touching the blog.",
          "The key is stored sealed on the server, and it travels with the workspace rather than with the browser, so closing a tab does not interrupt a running job.",
        ],
      },
      {
        slug: "check-your-ghost-connection",
        title: "Check your Ghost connection",
        lede: "Test first, publish second.",
        body: [
          "Press Test on the connection card. A pass returns the Ghost version and switches the mode to live; a refusal returns Ghost's own words about why.",
          "A 401 almost always means the key scheme: Ghost expects `Authorization: Ghost <id>:<secret>`, not `Bearer`.",
        ],
      },
      {
        slug: "add-an-ai-key",
        title: "Add an AI key",
        lede: "Bring your own provider.",
        body: [
          "Add a base URL, a model name and a key. The key is sealed at rest and never comes back to the browser; the studio only keeps a hint so you can tell two keys apart.",
          "One key is not enough for a long run: add several and the pool rotates on failure, penalising the one that failed rather than the whole run.",
        ],
      },
      {
        slug: "set-daily-token-limits",
        title: "Set a daily token limit",
        lede: "The brake that stops a runaway night.",
        body: [
          "The daily limit is checked before a stage spends, and usage is recorded per stage, so you can see which stage costs and which does not.",
          "Stage six spends nothing at all: validation is code, not a model call.",
        ],
      },
      {
        slug: "choose-your-ai-model-and-content-defaults",
        title: "Choose your AI model and content defaults",
        lede: "Where the house style lives.",
        body: [
          "Content defaults cover the model, whether runs save drafts or publish, the tone, the section count, images on or off, and how densely internal links are woven.",
          "Humanization is not one of those switches. Every draft and every revision carries the same list of AI tells that the publish linter refuses, so the writing arrives humanized rather than being cleaned up afterwards.",
        ],
      },
      {
        slug: "set-up-author-bylines",
        title: "Set up author bylines",
        lede: "Real-looking authors, without the duplication.",
        body: [
          "An author carries a name, a role, a beat, a city, a short bio and a portrait. The portrait is generated once when the author is created, then stored as a small inline image — the upstream portrait service ignores cache-busting, so fetching it per page would show every reader the same face and cost you the bandwidth.",
          "Articles attach to an author, and later articles on the same beat reuse that author rather than inventing a new one.",
        ],
      },
    ],
  },
  {
    title: "Research and plan content",
    topics: [
      {
        slug: "research-your-niche",
        title: "Research your niche",
        lede: "Evidence labels, and no invented numbers.",
        body: [
          "Research projects collect notes with an evidence label per claim. Nothing here reports search volume, keyword difficulty or traffic — this platform does not have those numbers and will not guess them.",
          "Use research to decide what the site should be about, then turn the finished project into a plan.",
        ],
      },
      {
        slug: "turn-research-into-content-plans",
        title: "Turn research into content plans",
        lede: "From notes to a queue you can see.",
        body: [
          "A finished research project converts into a topic plan: one pillar and its clusters, each with an angle.",
          "Everything is editable at this point — exclude, rename, reorder — because a plan you disagree with at review time is cheaper to fix than an article you disagree with afterwards.",
        ],
      },
      {
        slug: "get-ai-keyword-ideas",
        title: "Get AI keyword ideas",
        lede: "Suggestions that are checked before they cost anything.",
        body: [
          "Keyword ideas are filtered against your corpus before they are offered: a keyword the site already owns is flagged rather than queued.",
          "Nothing is auto-queued from the suggestion list. You choose, and the choice is recorded.",
        ],
      },
      {
        slug: "plan-a-pillar-and-cluster",
        title: "Plan a pillar and cluster",
        lede: "Why clusters write first.",
        body: [
          "Clusters dispatch before the pillar, deliberately. The pillar is meant to link out to the cluster articles, so they have to exist first.",
          "Selected topics queue; excluded topics are never generated, and that exclusion survives later edits.",
        ],
      },
      {
        slug: "schedule-articles-with-a-content-calendar",
        title: "Schedule articles with a content calendar",
        lede: "Days, slots, and who decides.",
        body: [
          "A calendar holds publishing days and a per-week article count. Slots can be queued by hand, or filled by automation when you turn it on.",
          "Write now holds an article until you release it — that is the difference between a calendar item and a publish.",
        ],
      },
      {
        slug: "turn-on-calendar-automation",
        title: "Turn calendar automation on or off",
        lede: "The switch that spends your tokens while you sleep.",
        body: [
          "Automation fills the next slot on schedule. Turn it on when the defaults, the key and the connection have all been proven on a real article.",
          "Turning it off stops new slots from being created. It does not cancel a run that is already in flight.",
        ],
      },
    ],
  },
  {
    title: "Write and publish articles",
    topics: [
      {
        slug: "create-your-first-content-run",
        title: "Create your first content run",
        lede: "Keywords in, articles out, six stages.",
        body: [
          "Paste keywords, or take them from a plan, and queue the run. Each keyword becomes a job: blueprint, draft, revision, metadata, enrichment, validation and publication.",
          "The intake refuses duplicates before anything is spent, so a keyword the site already owns stops at the door instead of costing you a draft.",
        ],
      },
      {
        slug: "follow-a-run-in-progress",
        title: "Follow a run in progress",
        lede: "Stages, tokens, and what waiting means.",
        body: [
          "The run page shows each stage with its token count. A stage that shows zero tokens and a payload is a stage that did not call a model — that is a fact about the stage, not a shortage.",
          "A job that sits in waiting is waiting on the stage before it. If nothing moves for longer than a stage should take, the worker lease is the thing to check, not the job.",
        ],
      },
      {
        slug: "review-and-publish-an-article",
        title: "Review and publish an article",
        lede: "The checks between writing and going live.",
        body: [
          "An article is checked for language, length, internal links and duplicate overlap before publication. A review hold is a decision for you; a publish hold is a refusal by Ghost or by a missing connection.",
          "Stage five picks the internal links from the pages the site has actually published — an anchor that no longer appears in the prose is dropped rather than forced in.",
        ],
      },
      {
        slug: "understand-a-duplicate-refusal",
        title: "Why was this keyword refused?",
        lede: "Two articles, one keyword, and the number in the reason.",
        body: [
          "The refusal names its layer and, for a keyword clash, the measured similarity: `DUPLICATE REFUSED (L1-keyword 0.94)`.",
          "That number is there because the gate compares keywords, not just titles. `…transition from academia…` and `…transition academia…` are the same ask, and a second article on the same ask is how a site ends up competing with itself and wearing `-2` on every URL.",
        ],
      },
      {
        slug: "retry-a-failed-task",
        title: "Retry a failed task",
        lede: "What a retry does, and what it does not redo.",
        body: [
          "Retry re-runs from the stage that failed. Finished stages are not paid for twice.",
          "A held article retried after a connection was fixed will push to Ghost on the retry — that is the shortest path to catching up a backlog of publish holds.",
        ],
      },
      {
        slug: "edit-export-or-delete-an-article",
        title: "Edit, export or delete an article",
        lede: "All three live on the article page and the article list.",
        body: [
          "Edit article opens the stored markdown. Save parses it back through the same reader the rewrite path uses, so the sections, the HTML and the markdown stay in step and image slots survive.",
          "Export .md downloads one file named after the slug — the thing to paste into Ghost's editor or anywhere else.",
          "Deleting is on the article list: Select all beside Export CSV arms every filtered row, each status header has its own checkbox, and the delete button asks twice. The server copy is marked deleted at the same time, so the next load cannot bring the article back.",
        ],
      },
      {
        slug: "retry-a-photo",
        title: "Retry a photo",
        lede: "When a slot picked the wrong picture, or none.",
        body: [
          "Open the article and find the Images card. Retry this image re-fetches one slot; Fetch images again retries every slot on the article.",
          "The retry hands the current sources back to the picker as images to avoid and salts the request, so you get different photos rather than the same one again. The salt is shown beside the button, so a run of identical results is visible instead of mysterious.",
          "Replacement photos are saved to the article. Build again to ship them.",
        ],
      },
      {
        slug: "audit-and-repair-internal-links",
        title: "Audit and repair internal links",
        lede: "A graph you can inspect, and repairs you can read first.",
        body: [
          "Analytics shows the link graph and the per-article checks; Connections audits a handful of posts at a time.",
          "Repairs are offered as explicit actions with the text they would change, and the ones that rewrite an article ask you to type APPLY first. Internal links are the cheapest ranking lever a small site has, which is exactly why they should not be applied silently.",
        ],
      },
    ],
  },
  {
    title: "Build and publish a static website",
    topics: [
      {
        slug: "connect-a-hosting-provider",
        title: "Connect a hosting provider",
        lede: "cPanel over FTPS, or a Git-based host.",
        body: [
          "For cPanel, give the hostname, port, username and password, then press Test. A configuration is only deployable once it reads VERIFIED — the password is stored sealed on the server and never returns to the browser.",
          "For Cloudflare Pages, Vercel or GitHub Pages, the provider's own token is used at deploy time.",
        ],
      },
      {
        slug: "customize-your-static-site",
        title: "Customize your static site",
        lede: "Name, footer, robots, ads and the look.",
        body: [
          "The static settings cover the site name, footer, robots policy, ad slots and the theme tokens.",
          "Robots matters before anything else: a site that says noindex is invisible no matter how good the writing is.",
        ],
      },
      {
        slug: "build-and-preview-your-static-site",
        title: "Build and preview your static site",
        lede: "What a build produces, and what it refuses.",
        body: [
          "A build writes one HTML file per article plus an index, a sitemap, a robots file, a stylesheet and the author pages.",
          "A build refuses when nothing indexable remains, when the public URL is missing, or when a route differs from the last build without being acknowledged. All three refusals protect the live site.",
        ],
      },
      {
        slug: "deploy-your-static-site",
        title: "Deploy your static site",
        lede: "Upload, then prove it.",
        body: [
          "Upload live sends the built files to the configured host inside a five-minute budget — a build is tens of files written one at a time, and a shorter cap used to abort real uploads mid-transfer.",
          "The deploy is recorded only after the public probe answers, so a green deploy on the Delivery page means the site really is serving.",
        ],
      },
      {
        slug: "mirror-articles-to-your-cms",
        title: "Mirror articles to your CMS",
        lede: "Getting Ghost caught up, automatically and by hand.",
        body: [
          "Publishing pushes to Ghost at the moment the article goes live. A successful cPanel upload also mirrors on its own, so a deploy never leaves the CMS behind.",
          "Mirror articles to the CMS on the Delivery page is the manual catch-up: it pushes every finished article Ghost does not already have, as a draft, and skips the ones it has. It answers with the resolved mode and connection, so an empty run says why instead of looking like success.",
        ],
      },
      {
        slug: "submit-to-indexnow",
        title: "Submit to IndexNow",
        lede: "Telling Bing the URLs changed.",
        body: [
          "Set an IndexNow key on Analytics. The server writes `<key>.txt` to the public root and calls Bing over its own connection — nothing about it depends on your browser holding credentials.",
          "The submission fires after a successful public probe, with the URLs that actually changed. If it is skipped, the notice now names the real cause: a missing key, or a build that changed nothing.",
        ],
      },
    ],
  },
  {
    title: "Usage, plans and payments",
    topics: [
      {
        slug: "check-your-usage-and-limits",
        title: "Check your usage and limits",
        lede: "What was spent, by stage and by day.",
        body: [
          "Usage is recorded per stage per job, so the cost of a run is attributable rather than a lump sum.",
          "The daily allowance is enforced before a stage spends, not after.",
        ],
      },
      {
        slug: "read-your-analytics",
        title: "Read your analytics",
        lede: "What is measured, and what is deliberately not.",
        body: [
          "Analytics is computed in your browser from your own articles: uniqueness against siblings, internal link counts, per-article checks.",
          "There is no search volume, no ranking position and no traffic chart, because this platform does not have those feeds. Anything shown as a number can be traced to an article you can open.",
        ],
      },
      {
        slug: "order-or-renew-a-package",
        title: "Order or renew a package",
        lede: "How an order is recorded here.",
        body: [
          "An order records the package, the article count, the price, a tracking code and the window it is active for. A renewal extends the window from whichever is later — today, or the end of the term you already paid for — so renewing early never costs you days.",
          "The ordering screen inside the studio is still being finished. Until it lands, orders are placed through support, and the record behind it already exists on the server.",
        ],
      },
      {
        slug: "track-or-cancel-an-order",
        title: "Track or cancel an order",
        lede: "The tracking code, and what cancelling does.",
        body: [
          "Every order carries a tracking code of the form `ORD-<workspace>-<timestamp>`. Quote it to support and the order can be found without ambiguity.",
          "Cancelling stops the renewal; it does not take back time already paid for, and the order keeps its row, its code and its cancellation date. A second cancel is refused rather than re-stamped, so the record stays truthful.",
        ],
      },
    ],
  },
  {
    title: "Protect your data",
    topics: [
      {
        slug: "back-up-and-restore-a-workspace",
        title: "Back up and restore a workspace",
        lede: "One file, and what it deliberately leaves out.",
        body: [
          "A backup is a single file containing the workspace's sites, articles, authors, plans, calendars and research.",
          "Secrets are not in it. AI keys and the CMS admin key stay sealed on the server, so a backup file can be moved between machines without carrying your credentials with it.",
        ],
      },
    ],
  },
];

export const HELP_TOPICS: HelpTopic[] = HELP_SECTIONS.flatMap((section) => section.topics);

export function findHelpTopic(slug: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.slug === slug);
}
