# Ghost AI Writer: Application Audit and Build Handoff

**Purpose:** Give an implementation agent a source-linked specification for building a product with similar workflows and safeguards.

**Audit date:** 2026-10-10  
**Scope:** Public product pages, pricing, signup/reset surfaces, all 37 linked public help guides, a signed-in walkthrough of all 20 authenticated areas, and authorized runtime tests for article generation, research, planning, image retry, Ghost connection/sync, backup/restore, static build/preview, build-archive route comparison, article metadata editing, and public route verification. No public article publication or external static deployment was performed; payment/order and deletion flows were not submitted.

## How to Read This Spec

- **Documented:** Explicitly described in a public product guide or pricing page.
- **Observed:** Seen on a live public page or during the signed-in read-only walkthrough dated above.
- **Inferred:** A reasonable implementation implication, not confirmed source-code architecture.
- **Unverified:** Requires an authenticated runtime pass or private API/source access.

The product guides are strong evidence for intended behavior, limits, and user-visible states. They do not prove the current backend implementation or that every release matches the documentation. Treat the live signed-in application as the final authority when available.

## Product Summary

Ghost AI Writer is a multi-workspace content-operations system for Ghost publishers. It combines niche/topic research, article planning, AI generation, duplicate protection, review and Ghost publishing, analytics, internal-link maintenance, and an optional static-site build/deploy workflow.

The key product boundaries are:

- A **website workspace** represents one Ghost site and isolates its content, jobs, plans, calendar, Ghost inventory, links, static-site configuration/builds, deployment history, and backups.
- **Account-wide resources** include AI provider keys, shared content defaults, account security, usage history, and workspace package capacity.
- **AI provider usage** is billed by OpenAI/OpenRouter separately from the product's yearly workspace-capacity packages.
- There are two publishing destinations: generated articles publish to Ghost; Static Delivery builds a separate static site from already-published Ghost posts.
- Background jobs are durable server work; closing the browser does not stop a queued run.

## User-Specified Branding Reference

The requested REA favicon mark is at [`morluto/rea/website/public/assets/favicon.svg`](https://github.com/morluto/rea/blob/main/website/public/assets/favicon.svg). It is a dark square with a white `R`. REA's repository identifies the project under the MIT license; retain the copyright and permission notice if redistributing that artwork. The REA repository is a reverse-engineering toolkit, not Ghost AI Writer's source code.

## Navigation Inventory

The 20 authenticated areas comprise the app's visible destinations plus nested author and backup screens. Their primary pages have now been opened while signed in; individual destructive/billable controls were not submitted.

| Area | Main responsibility | Data scope |
|---|---|---|
| Overview | Health, progress, totals, latest runs/articles/builds, worker status | Workspace plus some platform-wide counters |
| Create | Submit keyword batches, AI ideas, or pillar/cluster plans | Workspace; consumes account AI key |
| Topic Plans | Review and edit planned content clusters | Workspace |
| Research | Build evidence-tagged niche research projects | Workspace; consumes account AI key |
| Calendar | Plan write and publish times; optionally automate work | Workspace |
| Runs | Track, cancel, retry, and export generation jobs | Workspace |
| Articles | Search, review, edit metadata, export, and delete articles | Workspace plus connected Ghost |
| Analytics | Tokens, generation output, quality, stage reliability, link graph | Workspace |
| Connections | Ghost/sandbox connection, inventory, audits, and host providers | Workspace |
| Static Delivery | Customize, build, preview, download, and deploy a static site | Workspace |
| AI Keys & Usage | Configure providers, key priority, capability, limits, and usage | Account-wide |
| Bloggent Unlimited / Funding | Optional platform-funded niche discovery | Account/service availability |
| Content Defaults | Set account defaults and workspace/run overrides | Account and workspace |
| Website Settings | Rename and configure a specific workspace/site | Workspace |
| Authors & Bylines | Maintain author profiles and Ghost author assignment | Workspace |
| Backup & Recovery | Export and restore workspace data | Workspace |
| Account | Profile, password, active sessions, sign-out | Account |
| Billing & Plan | Workspace-capacity packages and manual orders | Account |
| Websites | Create, switch, and delete workspaces | Account → workspace |
| Help | Search task guides and troubleshooting | Public/account context |

### Observed Route Map

Route patterns below were read from the authenticated app. Replace `{siteId}`, `{runId}`, and `{articleId}` with account-scoped IDs; always enforce authorization server-side.

| Page | Route pattern |
|---|---|
| Websites | `/app/sites` |
| Overview | `/app/sites/{siteId}/overview` |
| Create | `/app/sites/{siteId}/create` |
| Topic plans | `/app/sites/{siteId}/plans` and `/app/sites/{siteId}/plans/{planId}` |
| Research | `/app/sites/{siteId}/research` and `/app/sites/{siteId}/research/{researchId}` |
| Calendar | `/app/sites/{siteId}/calendar` |
| Runs | `/app/sites/{siteId}/runs` and `/app/sites/{siteId}/runs/{runId}` |
| Articles | `/app/sites/{siteId}/articles` and `/app/sites/{siteId}/articles/{articleId}` |
| Analytics | `/app/sites/{siteId}/analytics` |
| Connections | `/app/sites/{siteId}/connections` |
| Static Delivery | `/app/sites/{siteId}/static` |
| AI Keys & Usage | `/app/sites/{siteId}/ai-keys` |
| Bloggent Unlimited | `/app/sites/{siteId}/funding` |
| Content defaults | `/app/sites/{siteId}/settings/content` |
| Website settings | `/app/sites/{siteId}/settings` |
| Authors & bylines | `/app/sites/{siteId}/settings/authors` |
| Backup & recovery | `/app/sites/{siteId}/settings/backup` |
| Account | `/app/account` |
| Billing & plan / orders | `/app/billing`, `/app/billing/orders` |
| Help | `/help` and `/help/{guideSlug}` |

### Authenticated Runtime Findings

These are observations of the signed-in UI on 2026-10-09. User-specific article titles, profile details, credentials, and payment references are intentionally excluded.

| Area | What the signed-in UI showed | Safe verification boundary |
|---|---|---|
| Global shell and Overview | Sidebar, `Ctrl+K` command palette, activity indicator, workspace switcher, theme/account controls; overview has health, Golden Path, recent work, and static-build panels. | Read-only; no shell action that changes account state was used. |
| Create | `Keywords` and `Topic plan` tabs; batch textarea; publish/model/type selectors; AI ideas and live-source research modes; topic tab has one-topic input and `Generate topic plan`. Current workspace UI shows live Ghost publish mode by default. | Initial walkthrough submitted nothing. A later authorized one-keyword run used GPT-4o mini and was explicitly saved as a Ghost draft; one research project also built four review-only content plans. See test results below. |
| Topic Plans | Existing plan cards show status and topic counts. Plan detail exposes publish/model/type selectors, topic add, selected-topic queue action, and expandable priority rationale. `New plan` opens Create. | Opened list/detail only; did not queue selected topics. |
| Research | New-research form has name, description, and corpus-size selector. Existing project detail has Overview, Niche, Audiences, Problems, Topic map, Queries, Coverage, and Clusters & plan tabs; stage/evidence/provenance controls are visible. | One compact 11-stage research project completed; see test results. No result edits, archive, or manual stage reruns. |
| Calendar | New-calendar form has name, timezone, articles/week, local publish time, write-ahead hours, weekday selection, and ordering strategy. The page showed a planning-only banner, but the current guide says the calendar-list banner is stale; see discrepancy and critical-workflow sections below. | Did not create a calendar or schedule/publish an item. The prior pass did not inspect an individual calendar's automation toggles, so live automation state remains unverified. |
| Runs | List uses loading skeletons before data arrives. Run detail exposes frozen publish mode, outcome counts, progress, cost/tokens/calls, per-job engine, six stages, duration/token counts, and CSV action. | Initial walkthrough inspected an existing run detail; a later authorized run completed as a draft. Did not cancel, retry, or export. |
| Articles | Inventory has search, engine filters, status filters, CSV export, and columns for status, links, images, uniqueness, and publish time. Detail exposes Ghost URL/ID, edit, HTML/Markdown copy/export actions, and featured-image retry. | Initial walkthrough was read-only. Follow-up retry completed; metadata editor was inspected. Attempting to clear the featured image was rejected as an invalid URL and canceled, leaving the draft unchanged. No body edit, delete, export, or publication. |
| Analytics | 7/14/30-day range controls and sections for token trend, article output, stage performance, content quality, generation engine/reliability, live-engine success, AI ideation, model usage, most-linked articles, link-graph truth, and graph view. | Read-only date-range controls; no settings were saved. |
| Connections | Current workspace is connected to live Ghost. UI offers read-only test, inventory sync, link audit, Sandbox/Live choice, Ghost URL/API-key form, and a separate AI Keys link. It states connection tests do not publish or edit posts. | Read-only Ghost test passed (Ghost 5.130); inventory sync completed and refreshed 25 recent records. Did not run link audit/apply, replace credentials, or switch connection. |
| Static Delivery | Four templates; site identity/canonical URL/robots/menu/snippet controls; ads UI with seven placements and 16 KiB code limits; auto-rebuild toggle; build history, preview/download, and host-specific deploy controls. A disconnected host shows deploy-blocked guidance. | One build and in-app preview succeeded; follow-up downloaded and compared the current and last-deployed build ZIPs. No customization was saved or deployment performed. Current cPanel provider is verified; see route-diff results. |
| AI Keys & Usage | Add-key dialog offers OpenAI/OpenRouter; label, API key (minimum 20 characters), and daily allowance; Test and Save are separate. UI says encryption occurs before storage and the key is never displayed again. | One saved OpenAI key was listed first in priority order with writing and semantic support; its latest displayed tests had passed. The secret was not revealed or edited. A later run completed using GPT-4o mini. |
| Bloggent Unlimited | Current screen says the service is not funding this website and new runs use the user's own eligible key; links to AI Keys. | Read-only. |
| Content Defaults | Separate account defaults and site overrides; site controls can inherit values. Save actions are separate. | Read-only; no defaults changed. |
| Website Settings | Site name save; nested Authors & bylines, Backup & recovery, and Content defaults; destructive workspace-delete action. | Did not save or complete any destructive confirmation. |
| Authors & bylines | Profile list with 20-profile cap; Add author dialog includes avatar URL, name, short bio, expertise, explicit Ghost author ID, and default-byline switch. | Opened form only; did not add/change a profile. |
| Backup & recovery | Import accepts JSON; page describes checksum/structure validation, included/excluded data, existing content rows skipped, and website/static settings replaced by backup values. Backup history/create action is separate. | Created and verified a backup, then restored that same snapshot in the same workspace; restore added zero rows because existing rows were skipped. The warned-about settings matched, so changed-settings replacement was not established. No external import tested. |
| Account | Email-verification status/action, current/new password fields, active-session list, revoke-one-session, and sign-out-everywhere. | Did not change password, revoke sessions, or sign out. |
| Billing & Plan | Package cards, manual-payment instructions, saved quote/recent-order sections, and enabled Order buttons. This conflicts with the public pricing page; see discrepancy below. | Did not click order/resume/report-payment buttons or submit payment details. |
| Websites | Workspace list/capacity link and niche-discovery form with funding-source choice, interest, language, and optional country code. | Did not request discovery or create a workspace. |
| Help | In-app help index groups guides by account, setup, connections, research, writing/publishing, static delivery, billing, privacy, and support. | Read-only. |

### Documentation vs Runtime Discrepancies

| Area | Public documentation | Signed-in UI | Build guidance |
|---|---|---|---|
| Calendar automation | Current calendar guides describe three separate, opt-in automation switches. The schedule guide explicitly says the “planning only” notice on the calendar list is out of date and directs users to inspect each calendar's actual state. | Prior signed-in walkthrough saw the planning-only notice, but did not verify the individual calendar detail/toggle state. This notice is not reliable evidence that automation is unavailable. | Include per-calendar write, publish, and cluster-link automation in the product spec. Runtime availability and the draft-calendar configuration still need a signed-in detail-page check; do not label the feature absent based on the stale list notice. |
| Paid orders | Public pricing said paid ordering was not open because payment details were unpublished. | Billing currently displays manual-payment instructions and enabled Order buttons. | Availability is unresolved. Do not initiate a real order during audit; test order creation only in a controlled test account or after explicit approval. |
| Backup restore | Current guide says article/plan/author/link rows are additive (existing rows skipped), but website name and static-site settings are replaced. Imports are applied when imported; they do not have a second Restore action. | Prior same-snapshot restore showed existing rows skipped and confirmed the settings-replacement warning, but the backup settings matched the current values. The changed-settings replacement effect was not exercised. | Preserve additive row semantics, explicitly preview settings replacement, and verify that replacement on a disposable fixture before production use. Restore must never publish to Ghost. |
| Static host readiness | Public docs list Cloudflare Pages, Vercel, GitHub Pages, and FTPS cPanel. | The visible static deploy control can be blocked when its selected host is disconnected; Overview may reflect a different prior deployment target. | Model connection state per provider and per deployment; do not infer all hosts are configured from one successful build. |

### Critical Workflow Verification

The public help guides were reopened and checked for the four high-impact workflows below. Status labels distinguish what the documentation specifies from what was exercised in the signed-in app. This is a behavior handoff, not a claim that irreversible production actions were performed.

| Workflow | Verified end-to-end behavior to implement | Evidence and test status |
|---|---|---|
| Ghost publishing | Freeze `Publish live in Ghost` vs `Save as Ghost draft` when the run starts. A successful live-mode job publishes to Ghost and is labeled `PUBLISHED`; draft mode saves a `GHOST DRAFT`. Drafts have no in-app publish button: the user opens the draft in Ghost, reviews/edits its body, and publishes there. Verify the public post, then sync inventory. A later change to defaults must not alter an in-flight run. | **Guide verified; draft-save runtime tested.** The authorized test run saved a Ghost draft and did not publish. Direct live publish/public verification was not performed; the user had asked to skip Ghost Admin sign-in, and this test draft has content and image-rights issues. [Review and publish](https://ghost.bloggent.com/help/review-and-publish-an-article). |
| Static build/deployment | Build an immutable snapshot from published Ghost articles only; building/previewing/downloading does not itself publish to a host. Deploy only `SUCCEEDED` or `SUCCEEDED WITH WARNINGS` builds to a `VERIFIED` host; block `SUCCEEDED PARTIAL SOURCE`. Warn that deployment replaces the files currently served at the target. Track `QUEUED → RUNNING → VERIFIED DEPLOYED / SUCCEEDED / FAILED`; host acceptance alone is not public verification. Confirm the public URL and allow redeploying an older immutable build as rollback. | **Guides and build runtime verified; deployment intentionally not run.** The build and in-app preview succeeded and cPanel connectivity passed, but the candidate would remove 15 currently live sitemap routes (all returned HTTP 200) and 47 HTML paths from the deployed archive. Do not deploy candidate `jvndt0`; require route-preservation review before any replacement. [Build and preview](https://ghost.bloggent.com/help/build-and-preview-your-static-site), [Connect a hosting provider](https://ghost.bloggent.com/help/connect-a-hosting-provider), [Deploy](https://ghost.bloggent.com/help/deploy-your-static-site). |
| Calendar scheduling and automation | Create from a `READY` plan; store timezone plus separate write and publish times; support list/month/cluster views, fill/re-plan, reschedule/skip/restore/remove before work starts, and explicit `Write now`/`Publish now`. Each calendar has independent, default-off switches for AI writing, Ghost publishing, and edits that add links among published cluster posts. Writing consumes AI tokens; publishing can make content public; link automation edits existing live posts. Show per-calendar status and require explicit opt-in; backup restore/app updates must never enable it. | **Guides verified; automation detail runtime not verified.** Prior signed-in walkthrough saw a list-page “planning only” banner, but the current guide says that notice is out of date; it says to open a calendar and read its actual automation state. The individual toggle screen was not checked. Documentation also differs on draft calendars: the schedule guide says new calendars publish live by default and offers no calendar-page draft switch, while the automation guide includes “Save drafts automatically on a draft calendar.” Confirm this in the individual calendar UI before implementing draft-calendar creation. [Schedule articles](https://ghost.bloggent.com/help/schedule-articles-with-a-content-calendar), [Calendar automation](https://ghost.bloggent.com/help/turn-on-calendar-automation). |
| Backup, restore, and import | Create an export, verify its checksum, download JSON, then restore only a valid artifact. Restore skips existing article/plan/author/link rows and never deletes those rows; it replaces website name and static-site settings with the backup's values. Importing a downloaded artifact applies it immediately and records an Import history row (no follow-up Restore button). Backups exclude Ghost/AI credentials and sessions; reconnect Ghost and configure AI keys after moving to a new workspace. Restoring/importing never publishes to Ghost and never enables calendar automation. | **Create, verify, download/restore path runtime-tested on the same snapshot.** It added zero rows because records already existed; settings matched, so changed-settings replacement, arbitrary external import, invalid/tampered-file rejection, and rollback after a partial restore remain untested. Current guide states a 25 MB import limit, 10 backups and 5 imports per 15 minutes per account, up to 30 Export backups per workspace, and no automatic backup schedule. [Backup and restore](https://ghost.bloggent.com/help/back-up-and-restore-a-workspace). |

### Test Execution Status

- **Complete:** public page/help-guide review; signed-in page map; read-only inspection of all 20 areas; one GPT-4o mini article draft run; one compact 11-stage research project; four research-derived content plans; one featured-image retry; Ghost read-only connection test and inventory sync; one verified backup and same-workspace additive restore; one static build and preview; cPanel connection test.
- **Public publishing:** the review/publish guide and live-vs-draft workflow were rechecked. The test article remains a Ghost draft because its body quality is weak and its Bing image has no visible source/license. No direct live publication or Ghost Admin sign-in was performed; drafts are published through Ghost's editor, not a Bloggent publish button.
- **Static deployment:** not performed. The only verified provider is cPanel and the configured public origin is `https://gophd.com`. ZIP comparison confirmed that the 64-page candidate omits 15 currently live article routes (all HTTP 200) and 47 HTML routes overall from the 96-page deployed build.
- **Key handling:** the run used the saved OpenAI key without revealing or editing it. OpenAI usage is billed by OpenAI.
- **Still gated:** payments/orders and account/workspace deletion. Restore was tested only by restoring an immediately created same-workspace snapshot; it did not test changed settings, external imports, tampered artifacts, or recovery after a partial restore.

### Authorized Generation Test

**Topic:** `QA TEST: A realistic weekly research schedule for a first-year PhD student`  
**Workspace:** Go PhD, connected to live Ghost  
**Run:** `cmv1m55ad0tcspe01gtsqaeyp`  
**Ghost draft:** ID `6ac97caeb7ec0f00016996f7`; slug `/post/weekly-research-schedule-phd-student/`  
**Settings:** OpenAI GPT-4o mini ($0.15/$0.60 per 1M input/output tokens as listed in the picker), five-section default, up to two section images, intentional-variant bypass off, Save as Ghost draft. No account or workspace defaults were changed.

**Pipeline result:** Completed; 1 draft saved, 0 failed/refused/cancelled, 100% progress, 8 settled calls, 13,288 tokens, app-reported cost `$0.0033`. Stage timings: Intent & Blueprint 3.3s; Draft 8.0s; Revision 9.0s; Metadata 1.1s; Enrichment 1.8s; Validation & Publish 5.2s. Draft creation and the six-stage pipeline were verified; public publication was intentionally not attempted.

**Automated quality signals:** 740 words, 81% uniqueness, 100% coverage, 100% intent match. The title matched the requested topic and the draft included relevant internal links and tags.

**Human review:** The article promises a realistic weekly schedule but provides no sample week, timetable, or concrete schedule. Most of the 740 words are generic time-management tips; the introduction and conclusion repeat the same points. It includes unsourced numerical advice (for example, break intervals and a 500-word writing target), several tool recommendations without qualification, and an awkward internal-link anchor. Treat the app's 100% intent score as a false positive for this prompt.

**Image review:** The article detail showed a relevant student-at-a-desk image with descriptive alt text and a 474×274 thumbnail that loaded. The app exposes a query-based Bing `tse1.mm.bing.net` thumbnail URL, not the original source, creator, license, or attribution. Image rights therefore could not be established. Keep the post unpublished until the image is replaced with a rights-cleared asset and the article is revised to include an actual weekly schedule.

### Additional Runtime Workflow Tests

**Research project:** `QA TEST - Research workflow audit` (`cmv1neprs0td7pe01ahr4aviq`). The compact run reached `READY` with all 11 stages complete: 9 LLM stages and 2 derived stages, 19,189 reported stage tokens, using the account-default OpenAI GPT-4o. The detail view showed per-stage tokens but no dollar total. R1 read 23 site records. The UI showed 4 proposed audience segments, 12 proposed problems, 24 mapped topics, 72 embedded query candidates (4 merged; 68 distinct), and coverage data for 42 of 44 published posts. At run time query overlap was explicitly `unknown` because the duplicate-corpus snapshot was `STALE`; coverage indicated 13 missing, 4 weak, 5 partial, 1 covered, and 1 strong topic. The research detail explicitly labels AI interpretation versus first-party and calculated evidence and disclaims search-volume/traffic data.

The saved description visibly ended with the project name appended directly to the final sentence; the same concatenated string appeared in both the overview and provenance entry. This may be a data-binding issue or a side effect of the automated field-entry sequence; retest with natural typing and blur before treating it as a confirmed product defect.

**Research-derived plans:** `Build content plans` created 4 ready-to-review plans from 4 proposed clusters, 24 topics total, while 0 clusters were accepted. The UI states these plans are for review on Topic Plans; nothing is generated or published until queued. Priorities were displayed as deterministic scores (84–97/100) with internal-link opportunity counts; no search-demand metrics were claimed.

**Connection and inventory:** the read-only Ghost test passed against Ghost 5.130. `Sync inventory` completed and the page showed 25 recent records, including the test draft. The action updated the app's inventory snapshot; it did not publish or edit Ghost posts.

**Image retry:** `Retry featured image` completed; the follow-up article detail showed `Retry finished 21h ago — new featured image selected`. Two section candidates were rejected as insufficiently relevant. The selected 474×274 image still loads from the query-based Bing thumbnail URL, with no original source, creator, license, or attribution shown. The completion status is now verified, but image rights remain unknown. A Bing Images search for the query surfaced commercial stock providers (including Adobe Stock, Freepik Premium, and Vecteezy); it did not identify the exact selected thumbnail or establish a reusable license.

**Backup/restore:** the app created a 2.8 MB backup (23 articles, 83 links, 16 plans), verified it, then restored that exact snapshot into the same workspace. Restore reported 0 authors, 0 articles, 0 links, and 0 plans added because existing rows were skipped. No deletion or Ghost publication was reported. The confirmation warned that website name and static configuration are replaced; because those settings matched the current values, the replacement effect itself was not verified. The current guide further documents that a JSON Import is applied at import time and receives an Import history row without a second Restore action. This validates same-snapshot row idempotence, not changed-setting replacement, arbitrary-file import, tamper rejection, or recovery from a partial restore.

**Static build/preview:** build `jvndt0` completed `SUCCEEDED` (64 pages, 1.0 MB, 2.0s). The preview opened in-app and rendered the Go PhD homepage. A build notice reported 35 Bing images remain linked at their original Bing addresses rather than being copied into the ZIP. Auto-rebuild was OFF. Cloudflare Pages, Vercel, and GitHub Pages were not connected; cPanel connectivity was verified by explicit-TLS FTPS, but the route diff blocks deployment of this build. Current help confirms deployment replaces the files at the target and requires a complete build plus a verified host; accepted upload and publicly verified deployment are separate outcomes.

The configured canonical origin is `https://gophd.com`; cPanel history records an earlier verified deployment there with 144 managed files and another accepted upload whose public verification did not complete for two article paths. The last deployed build shown was 96 pages/2.5 MB; `jvndt0` is 64 pages/1.0 MB. The route diff confirms that `jvndt0` would remove live routes, so it was not deployed. Rebuild only after preserving the existing route coverage; no safe route-preserving deployment was available in this test.

**Public article status:** the test article remains labeled `GHOST DRAFT`. Its apparent `gophd.com` slug returned the static site's not-found page; the currently deployed static build predates this draft, so this is not a test of the Ghost Admin API's published-page response. Direct live-mode publishing and public verification remain pending.

### Follow-Up Verification (2026-10-10)

**Public route check:** `https://gophd.com/sitemap.xml` returned HTTP 200 and listed 29 URLs (the homepage and 28 posts). The test draft path `https://gophd.com/post/weekly-research-schedule-phd-student/` returned HTTP 404. The full ZIP route comparison below explains the 96-page versus 64-page difference and confirms the candidate's live-route losses.

**Authenticated app access:** The Bloggent session is active in the browser. The Go PhD workspace showed 23 article records (22 published and one draft). Ghost Admin/CMS sign-in was skipped per the user's instruction.

**Build route comparison:** Downloaded ZIPs for the last deployed build `0rdr2p` and candidate `jvndt0` were compared. The app labels them 96 and 64 pages; their archives contain 93 and 61 HTML files, respectively. The deployed archive's sitemap contains the same 29 currently observed live URLs; the candidate sitemap has 24 URLs. Only 14 sitemap URLs are shared: the candidate omits 15 currently live article routes and adds 10 different posts. All 15 omitted live paths returned HTTP 200 when fetched from `gophd.com`. They are: `/post/time-management-phd-candidates/`, `/post/phd-online-vs-traditional/`, `/post/interdisciplinary-phd-programs/`, `/post/transitioning-industry-phd/`, `/post/choose-apply-international-phd-programs/`, `/post/impact-phd-career-advancement/`, `/post/phd-research-methodologies-explained/`, `/post/phd-program-expectations/`, `/post/phd-funding-alternatives/`, `/post/choose-phd-research-topic/`, `/post/benefits-pursuing-phd/`, `/post/role-research-ethics-phd-programmes/`, `/post/apply-phd-programme/`, `/post/choose-right-phd-programme/`, and `/post/typical-structure-phd-programme/`. Comparing all HTML routes, `jvndt0` removes 47 paths from `0rdr2p` and adds 15. One candidate-only post is `/post/low-calorie-savory-evening-snacks-weight-loss/`, unrelated to the Go PhD niche. A deployment would remove live routes; none was attempted.

**Draft editor check:** The Bloggent `Edit article` form exposes title, slug, search description, excerpt, tags, featured-image URL, and alt text, but no body editor. The test article still lacks the promised sample week/timetable. Clearing its Bing image URL and alt text was rejected with `featuredImageUrl: Invalid URL`; canceling and reopening the editor confirmed the original metadata remained unchanged. The test article remains an unpublished Ghost draft. It was not published because the body needs substantive revision and image rights remain unverified.

**Content settings follow-up:** The authenticated Content settings page showed OpenAI GPT-4o as the account default, `Publish live in Ghost` as the default publish mode, professional tone, five sections, and a maximum of two section images. Go PhD overrides inherit the tone, publish mode, and `Featured image: inherit (optional)`; internal links are Standard. No settings were changed. The test run itself explicitly used GPT-4o mini and Save as Ghost draft, so it did not use these current defaults.

## Image and Writing-Style Findings

### Image Strategy

**Documented behavior:** Content defaults allow 0–4 section images. The run guide says images are included only when a relevant one is found, so an article may have fewer than the maximum or none. Article detail supports a featured-image URL and alt text; changing body text itself is done in the Ghost editor. The guides describe no source-license selector.

**Observed behavior:** The tested article's detail showed one of three image slots placed. Two section candidates were rejected with a relevance reason. `Retry featured image` re-runs only the featured slot from saved queries, can examine up to three candidates, and performs byte and vision checks; the UI says it does not regenerate text and that retrying a live article updates it in place. The actual retry completed and selected an image, but the saved URL still resolved through a Bing thumbnail and exposed no original source, author, or license. A blank featured-image URL was rejected as invalid, so the metadata editor offers no working remove-image state. Separately, the Content settings page documents a `Required` featured-image policy: if the slot is empty, hold the run and let the user retry or publish without an image (recorded). The current site override is `inherit (optional)`, so that hold behavior is not active for Go PhD now.

**Implementation specification for a similar product (inferred; not verified source architecture):**

1. **Represent each slot independently.** An article has zero or one featured-image slot and zero to four inline section-image slots. Each slot stores its purpose/section, desired subject, status, selected asset, alt text, and an optional reason it is empty. Do not treat a configured maximum as a promise that every slot will be filled.
2. **Build a query from meaning, not just the keyword.** Use the article outline and target section to describe the subject, context, and desired visual. Exclude text/logo-heavy images unless requested. Send a small bounded number of candidates to review (the observed featured retry examined up to three); persist the query and provider for reproducibility.
3. **Use a rights-aware source adapter.** Prefer a provider whose API returns original-source and reuse-license metadata. A search-result thumbnail, proxy URL, or image found by a general web search is not proof of permission. Reject Bing thumbnail/proxy URLs as publishable assets unless the original source and license are independently resolved. Offer user uploads with a rights attestation as an alternative.
4. **Store provenance with the asset.** Persist provider and provider asset ID, original source-page URL, direct original asset URL, creator/rights-holder, license name and URL, attribution text, commercial-use and derivative permissions, retrieval time, query, content hash, MIME type, byte size, dimensions, and review decision. Keep this record if the article is edited or the provider later removes the result. Do not store only the thumbnail URL.
5. **Apply eligibility before relevance ranking.** First reject unknown/unsupported rights, search-engine thumbnails, watermarked previews, disallowed license terms for the configured use (including non-commercial/no-derivatives restrictions where relevant), invalid/unsafe files, and unusable dimensions. Then rank remaining candidates for visual relevance. Use file validation plus a vision/relevance check; neither substitutes for rights validation. Record rejection reasons. A low relevance score or any unresolved rights state leaves the slot empty.
6. **Fetch defensively.** Allow only configured provider hosts or validated user uploads; re-check every redirect and resolved address to prevent SSRF. Enforce byte, pixel-dimension, and timeout limits; verify the decoded file type rather than trusting the extension or response header; reject malformed files. Avoid embedding arbitrary external URLs into the published page. When terms permit, copy eligible assets into controlled storage and serve a stable URL; preserve the required attribution and license link.
7. **Make empty, remove, and required distinct.** `Optional` permits an empty slot. `Required` blocks the publish transition when the featured slot is empty, with explicit `Retry` and `Publish without image` actions. The latter is a deliberate, timestamped user override with actor and reason, not an automatic fallback. `Remove image` sets the slot's asset to null and status to empty; it must work in the editor and must not be confused with an invalid blank URL. Keep the slot policy frozen in the run snapshot.
8. **Make retry narrow and safe.** A featured-image retry reprocesses only that slot and does not regenerate article text, metadata, or inline images. Use an idempotency key, bounded attempts, per-candidate results, and a terminal reason (`selected`, `no eligible candidate`, `provider error`, or `cancelled`). Preserve the prior asset until a replacement is eligible. For an already-live Ghost post, show the old/new image and attribution, explain that Ghost will be updated in place, and require confirmation before applying; reconcile uncertain Ghost responses before retrying the update.
9. **Expose review information.** Candidate preview should show the actual image, source/creator, license and attribution, relevance explanation, dimensions, and any rights warning. Selected-image detail should expose its provenance and a clear remove/replace action. Generate factual, concise alt text from the image itself; let the user edit it, and support explicitly marking a decorative image with empty alt text.

Recommended slot lifecycle: `EMPTY → SEARCHING → REVIEWING → SELECTED`; terminal alternatives are `NO_ELIGIBLE_CANDIDATE`, `FAILED`, and `SKIPPED_BY_USER`. Keep retry history as events instead of erasing earlier candidate/rejection records. Do not surface a generic “success” when the only found image has unverified reuse rights.

### Writing Style

**Documented controls:** The content-defaults guide exposes four broad tones (professional, friendly, authoritative, casual), 3–10 sections, and 0–4 section images; workspace overrides can change tone, publish mode, section count, images, and internal-link intensity. The live settings page showed the current account tone is professional, while Go PhD inherits it. Runs have six stages and a content-type contract. Auto chooses a structure from how-to, troubleshooting, comparison, explainer, list, review, and general; the contract reports structural checks but does not guarantee publication-quality prose.

**Observed limitation:** The tested 740-word article passed its content contract (4/4) and showed 100% intent match/coverage, yet it omitted the requested sample week/timetable and repeated generic advice. The app detail and current Content settings exposed no brand-voice profile or writing-sample field. The broad tone selector is not enough to claim a reliably humanized voice.

**Implementation specification for a similar product (inferred; not verified source architecture):**

1. **Separate voice from article requirements.** A four-value tone preset can remain as a quick starting point, but add a reusable, versioned voice profile. Suggested fields: profile name; intended audience and expertise; desired traits and traits to avoid; formality/warmth/directness; point of view and language variant; preferred terminology; prohibited phrases; sentence/paragraph rhythm; formatting conventions; evidence/claim rules; and a short “voice in practice” description. Use bounded structured fields plus an editable brief, not only a single free-form prompt.
2. **Use user-authorized examples carefully.** Let users add a few writing samples they own or have permission to use, with source/title, language, and intended use. Extract style characteristics (for example, sentence length range, use of first person, headings, and terminology) rather than copying sample sentences into generated work. Provide preview, replace, and delete controls. Respect account/workspace access boundaries; do not use samples to train shared models or other tenants. Do not promise exact imitation of a living writer.
3. **Create a structured brief for each article.** Capture audience, reader intent/problem, desired outcome, article type, key points, required concrete deliverables, sources/evidence, claim boundaries, exclusions, call to action, and optional word/section targets. Make required deliverables explicit and independently checkable. For the tested request, the brief must name a seven-day example timetable with adjustable time blocks; “write about a weekly schedule” is too vague to validate.
4. **Freeze the effective configuration.** Resolve account defaults, workspace overrides, selected voice profile/version, article brief, and per-run overrides at submission. Store a read-only snapshot with the run/job so later profile edits do not silently change queued or historical work. Allow a user to deliberately regenerate using the current profile as a new attempt.
5. **Apply voice at planning and revision, not as a final veneer.** Have the planning stage translate the brief into an outline and acceptance criteria. Draft against those criteria; revise for clarity, specificity, voice consistency, and redundancy. Preserve author-approved facts and user edits. Show the outline/required deliverables in review so omissions are visible.
6. **Use layered quality gates.** Deterministic checks should catch missing required sections/artifacts, empty sections, word/section constraints, broken links, and missing source references where required. Semantic review can flag whether requested artifacts are substantively present, claims that need evidence, unsupported numbers, repeated advice, generic filler, and voice drift. A high intent/coverage percentage must not override a failed hard requirement. Scores are review signals, not proof of factual accuracy or publish readiness.
7. **Make uncertainty visible and preserve human control.** Link factual claims to supplied/retrieved sources where the product supports research; label assumptions and ask for review when evidence is missing. Never invent statistics, citations, credentials, or personal anecdotes. Show actionable findings and let users edit/approve; keep live publication behind its separate explicit setting and review boundary.

Example profile/brief to seed product QA: “Write as a thoughtful PhD adviser: warm, clear, practical, and academically credible, not stiff or chatty. Use concrete examples and varied sentence rhythm. Avoid filler openings/conclusions, repeated advice, invented personal anecdotes, and unsupported universal numbers. Label assumptions and explain what readers should adapt to their course, lab, and adviser.” Test request: require a realistic seven-day sample timetable with adjustable time blocks. Expected review findings on the observed draft: missing timetable, repeated generic advice, and unsourced numeric recommendations; the job must fail the required-artifact gate even if aggregate intent/coverage scores are high.

Do not market this as “humanization” that guarantees undetectability. The goal is a useful, accurate, reader-aware draft that reflects a user's authorized voice preferences, with clear provenance and review controls.

**Verified guides:** [Choose your AI model and content defaults](https://ghost.bloggent.com/help/choose-your-ai-model-and-content-defaults), [Create your first content run](https://ghost.bloggent.com/help/create-your-first-content-run), [Edit, export, or delete an article](https://ghost.bloggent.com/help/edit-export-or-delete-an-article), and [Review and publish an article](https://ghost.bloggent.com/help/review-and-publish-an-article).

## Information Architecture and Tenancy

### Account and Workspace Rules

- One workspace maps to one blog/site; do not mix one site's Ghost inventory or content with another workspace.
- One free workspace is included. Yearly packages raise the workspace cap.
- Account-level AI keys and defaults are shared across workspaces. Workspace settings override account defaults; a per-run choice overrides both.
- A new workspace starts in Ghost Sandbox mode. Sandbox records are quarantined when switching to live; they are not silently copied into the live site.
- Workspace deletion is destructive to app-side data and should require exact-name confirmation. Block deletion while runs, jobs, builds, or deployments are active.
- Workspace deletion does not delete existing Ghost posts or files on a hosting provider.
- Workspace switch should preserve the current page type where practical and display connection health for the selected workspace.

### Global Shell

The observed shell includes the primary navigation/sidebar, workspace switcher, global search/command launcher (`Ctrl+K`), activity indicator, theme switch, account menu, and help access. Search can jump to pages/articles and initiate supported actions such as starting a run, restarting setup, or signing out. Verify command availability and keyboard behavior in the signed-in UI.

## Feature Specification

### 1. Signup, Approval, Sign-In, and Account Security

- Signup fields: name, email, password. Public signup UI describes an eight-character minimum and a password-strength indicator.
- Account lifecycle: signup → email verification → awaiting manual operator approval → active. Suspended is an administrator-controlled state.
- Verification/resend and sign-in/reset endpoints are rate-limited.
- Password reset sends a one-use, expiring link, returns the user to sign-in, and invalidates other sessions after completion.
- Reset-request responses should not disclose whether an email is registered.
- Account settings include profile/status, verified email, password change, active sessions, revoking one session, and sign out everywhere.
- Public security guidance describes pausing sign-in/password changes after repeated incorrect current-password attempts. Verify the exact threshold and recovery UX in the live app before copying it.
- Store password hashes, not plaintext. Keep provider and Ghost secrets encrypted and never echo stored secrets back to the UI.

Sources: [Create account](https://ghost.bloggent.com/help/create-your-account), [Sign-in and password reset](https://ghost.bloggent.com/help/sign-in-and-reset-your-password), [Account security](https://ghost.bloggent.com/help/keep-your-account-secure).

### 2. Guided Setup and Workspace Lifecycle

The setup guide is a seven-step flow: welcome → name site → choose sandbox/live Ghost → select model → optionally configure a key/limit → submit up to five initial topics → watch the run or return to overview. It can be skipped, resumed, or restarted.

Important side-effect boundary: submitting the first topics queues generation. In production this can consume provider tokens and, depending on frozen publish mode, can publish live. Clearly disclose that before starting.

Workspace UI should support create, switch, rename, and delete; distinguish sandbox from live; preserve separate connection status; and lock destructive actions while active work exists.

Sources: [Create a workspace](https://ghost.bloggent.com/help/create-a-website-workspace), [Setup guide](https://ghost.bloggent.com/help/use-the-setup-guide), [Switch, rename, or delete](https://ghost.bloggent.com/help/switch-rename-or-delete-a-workspace).

### 3. Overview Dashboard

Documented/observed overview concepts include:

- Article, run, link, and token totals.
- Golden Path checklist and completion percentage.
- Background worker health and per-site/platform-wide job counts.
- Per-key usage, recent runs/articles, latest static build, and a link-graph preview.
- Current-workspace counters should be used for local troubleshooting; platform-wide totals may change due to other customers.
- Golden Path progress must be based on evidence-backed completion, not merely visited screens.
- Dashboard is read-only: no generation, publish, or deployment side effect should happen by opening it.

Source: [Overview dashboard](https://ghost.bloggent.com/help/understand-the-overview-dashboard).

### 4. Ghost Connection and Inventory

- Modes: Sandbox for practice; Live Ghost for the actual blog.
- Live connection requires a public HTTPS Ghost URL and Admin API credential in `id:secret` form.
- Validate a replacement credential before saving. A failed replacement must not destroy a working connection.
- Connection status vocabulary: `CONNECTED`, `DEGRADED` (temporary/retry), `ERROR` (saved address/credential rejected), `NOT CONNECTED`.
- Test is read-only. Inventory sync imports posts into the workspace and powers duplicate checks and internal-link candidates.
- Documented sync limit: three full syncs per 15 minutes.
- Keep connection secrets encrypted at rest; mask them after save.
- Never merge sandbox article records into live inventory without an explicit user action.

Sources: [Connect Ghost](https://ghost.bloggent.com/help/connect-your-ghost-website), [Check your connection](https://ghost.bloggent.com/help/check-your-ghost-connection).

### 5. AI Keys, Models, Quotas, and Content Defaults

AI provider keys are account-wide and can be used across workspaces. Each key has a label, provider (OpenAI/OpenRouter), priority, supported capabilities, enabled state, cooling-down state, daily allowance, and usage history.

- Higher priority is selected first; fail over to the next eligible key when required capability, quota, or provider health is unavailable.
- Key tests report chat and semantic capability separately.
- Keys are encrypted and only shown as a masked hint after save; never reveal the secret again.
- Per-key daily limits: 1,000–50,000,000 tokens or unlimited; reset at 00:00 UTC.
- Reserve quota for in-flight work; settle actual usage idempotently. Preserve usage history after key deletion.
- A job over quota can remain pending until reset; one-shot ideas/research/plan requests stop and need a new request.
- Defaults include model, publish mode (live vs draft), tone, 3–10 sections, 0–4 section images, and link intensity (Light/Standard/Rich).
- Precedence: run override > workspace override > account default. Freeze effective settings at submission; edits to defaults do not mutate an existing run.
- Model picker should expose provider/model support and listed input/output pricing.

Sources: [Add an AI key](https://ghost.bloggent.com/help/add-an-ai-key), [Daily token limits](https://ghost.bloggent.com/help/set-daily-token-limits), [Model and content defaults](https://ghost.bloggent.com/help/choose-your-ai-model-and-content-defaults).

### 6. Create Content, Keyword Ideas, and Topic Plans

**Keyword run input**

- Accept up to 100 topic lines, one topic per line.
- Normalize whitespace/case, show a duplicate preview and row count, flag lines longer than 200 characters, and identify over-limit rows.
- Choose publish mode, model, and content type: Auto, how-to, troubleshooting, comparison, explainer, list, review, or general.
- Freeze run settings at submission. Cap article-job concurrency at two per workspace.
- Check exact-match duplicates at submission and immediately before publish. A deliberate variant can bypass the exact-match gate, but title/slug/text similarity checks remain.
- Make refused, review-held, publish-held, and cancelled outcomes explicit.

**AI keyword ideas**

- Seed must be at least three characters. User chooses 8, 12, 16, or 20 ideas.
- Spend from the highest-priority eligible key; return purpose/angle/token information and let user add one or all suggestions to the keyword box.
- Documented rate limit: 20 requests per 15 minutes. Filter topics already covered by the corpus.
- Optional pre-workspace niche discovery may have a small Bloggent-funded allowance. It does not fund workspace research or article generation; a user's own eligible AI key is still required for those.

**Pillar/cluster plan**

- Start from one broad subject; generate a pillar and narrower cluster topics.
- Allow edit, reorder, exclude/restore, remove, and add operations.
- Select topics and effective model/publish mode; then queue or schedule.
- Suggestions are not measured search-volume data unless a named data provider is explicitly shown.

Sources: [Create a content run](https://ghost.bloggent.com/help/create-your-first-content-run), [AI keyword ideas](https://ghost.bloggent.com/help/get-ai-keyword-ideas), [Pillar/cluster plan](https://ghost.bloggent.com/help/plan-a-pillar-and-cluster).

### 7. Niche Research Projects

- Optional, asynchronous, 11-stage research workflow using the configured model and, ideally, a connected-site corpus.
- Prompt length: 20–4,000 characters. Corpus sample options: Compact, Standard, Wide.
- Show stage progress, tokens, retryability, and terminal status: `READY`, `PARTIAL`, `FAILED`.
- Results are editable in Niche, Audiences, Problems, Topic map, Queries, Coverage, and Clusters & plan tabs.
- Evidence labels distinguish `From your site`, `Calculated`, `AI interpretation`, and `You wrote this`; explicit user corrections win.
- Individual stages can be rerun (and may consume more tokens) without discarding existing edits. Support archive/restore.
- Priority is rule-calculated from displayed inputs. Do not fabricate search volume, difficulty, CPC, rankings, or traffic.
- Research-derived clusters can become editable plans; already-covered topics are skipped.

Sources: [Research your niche](https://ghost.bloggent.com/help/research-your-niche), [Turn research into plans](https://ghost.bloggent.com/help/turn-research-into-content-plans).

### 8. Calendar and Automation

**Documented workflow:** Create a calendar from a `READY` plan. Configure timezone, publishing days, 1–21 articles/week, local publish time, write-ahead window (1–336 hours), and ordering. Keep `write_at` and `publish_at` distinct. Fill from a plan; re-filling re-plans entries that have not started. List/Month/By-cluster views support reschedule, skip/restore, and remove before work starts. `Write now` spends AI tokens and then waits for publication; `Publish now` sends the article to Ghost and may make it public. Manual generate-now is limited to 10 requests per 15 minutes per account.

**Automation behavior documented:** Each calendar independently controls automatic writing, automatic publishing (or draft saving for a draft calendar), and automatic cluster linking. All switches start off. Writing uses tokens; publishing can make posts public; link automation edits already-published posts to link cluster content. The calendar detail should state exactly what is enabled. Turning automation off affects future actions; it does not undo content already written/published or links already applied. Restore and app updates do not turn automation on.

**Runtime status and documentation conflict:** The prior signed-in walkthrough saw a “planning only” message on the calendar page. The current schedule guide explicitly calls the calendar-list notice out of date and says to open an individual calendar to read its real automation state. That detail view was not verified; therefore automation is a documented feature, not a verified unavailable feature. There is also a draft-mode ambiguity: the schedule guide says new calendars publish live by default and have no calendar-page setting to switch to draft, while the automation guide describes a “draft calendar” and `Save drafts automatically`. Confirm how a draft calendar is created and how its publish mode is frozen before treating either path as fully validated.

**Build guidance:** Implement the documented per-calendar switches, default-off behavior, clear per-action consequences, token checks, timezone-safe scheduling, and worker/job status. Require explicit opt-in per toggle and make automation idempotent across retries. Before enabling real scheduling, verify the individual calendar detail in the signed-in UI or test the behavior in a disposable workspace; do not infer absence from the stale list banner. Test live publishing and link edits against a disposable Ghost site, never against the user's production content.

Sources: [Schedule articles](https://ghost.bloggent.com/help/schedule-articles-with-a-content-calendar), [Calendar automation](https://ghost.bloggent.com/help/turn-on-calendar-automation).

### 9. Runs, Jobs, and Recovery

Each run freezes its source/type, model, publish mode, and content settings. It groups article jobs and reports complete, in-flight, failed, refused, review-held, and cancelled counts; progress; settled cost/tokens/calls; and CSV export.

Article pipeline stages:

1. Intent & Blueprint
2. Draft
3. Revision
4. Metadata
5. Enrichment
6. Validation & Publish

State/behavior rules:

- Main path: `PENDING` → `RUNNING` → `COMPLETED`.
- Other meaningful outcomes: `FAILED`, duplicate `REFUSED`, `REVIEW HELD`, calendar `PUBLISH HELD`, `CANCELLED`.
- A run can be 100% complete while containing failed/refused/held jobs. “Completed” means processing ended, not that every article published successfully.
- Server work continues when the browser closes. Views refresh to show current server state.
- Cancel stops pending work and lets the current stage finish; preserve already generated output and published posts.
- Automatic retry covers transient provider/database/overload errors. Restart failed requeues eligible `FAILED`/`CANCELLED` and duplicate-refused jobs after the run stops. Quota-waiting work may resume automatically.
- Public docs say an individual failed job cannot be retried from the run page; verify current UI.
- For uncertain Ghost publish outcomes, reconcile read-only against inventory/ledger before resending to avoid duplicates.
- Review-held articles show match evidence. Approve queues normal publish/draft processing; reject records refusal and retains draft evidence.

Sources: [Follow a run](https://ghost.bloggent.com/help/follow-a-run-in-progress), [Retry failed work](https://ghost.bloggent.com/help/retry-a-failed-task), [Duplicate refusal](https://ghost.bloggent.com/help/understand-a-duplicate-refusal), [Review and publish](https://ghost.bloggent.com/help/review-and-publish-an-article).

### 10. Articles, Authors, and Internal Links

**Articles**

- Search by title/keyword; filter by all/published/draft/failed/uncertain and by generation engine (LLM/fallback).
- Rows expose status, incoming/outgoing links, image count, uniqueness, and publish time.
- Editable metadata: title, unique lowercase hyphenated slug, description, excerpt, tags, featured image URL/alt text. Body edits go through Ghost.
- Exports: copy HTML, standalone HTML, Markdown, CSV inventory. Action menu can expose slug/URL/Ghost ID.
- Deleting an article in a live workspace also deletes its Ghost post; require explicit confirmation. If Ghost deletion fails, retain the app copy and report failure.
- Keep a Ghost publish ledger with attempts and outcomes.

**Authors/bylines**

- Up to 20 profiles per workspace. Fields include name, bio, expertise, optional avatar, explicit Ghost author ID, active/default status.
- Never invent a Ghost author ID. Applying a new default byline must not rewrite existing articles.

**Internal-link audit**

- Read-only scan of up to five published live posts first.
- Classify healthy, broken, irrelevant, over-budget, identity mismatch, and other actionable states.
- Apply proposed changes only after user types exact confirmation `APPLY`.
- Skip hand-edited Ghost posts rather than overwriting them.
- New content links only to relevant published posts on the same site.

Sources: [Article management](https://ghost.bloggent.com/help/edit-export-or-delete-an-article), [Bylines](https://ghost.bloggent.com/help/set-up-author-bylines), [Link audit](https://ghost.bloggent.com/help/audit-and-repair-internal-links).

### 11. Analytics

Show settled token usage, article output, stage duration/reliability, quality, LLM-vs-fallback, AI ideation, model use, linked articles, and link-graph truth states (planned/local/Ghost pending/confirmed/static/failed/broken).

Do not label these as visitor analytics, search rankings, SEO traffic, or measured search volume. Keep workspace-scoped metrics separate from platform-wide counters.

Source: [Analytics](https://ghost.bloggent.com/help/read-your-analytics).

### 12. Static Delivery and Hosting

Static Delivery is separate from Ghost article publishing. It creates an immutable snapshot from **published Ghost articles only**.

**Customization**

- Versioned templates; site name; logo/favicon URLs; HTTPS canonical origin; robots policy; header/footer menus; footer text; head HTML; body-end code; analytics snippets.
- Saving customization does not mutate an existing build or deployment.
- An empty public URL may allow preview/download but should mark the site noindex and block deployment.
- Custom snippets execute on every built page; label them trusted code and treat as security-sensitive.
- Ad system includes seven positions, custom HTML/JS or managed AdSense, `ads.txt`, and optional auto-rebuild. Any change requires another build/deploy.
- Auto-rebuild may deploy to the last host after new articles; require explicit opt-in.

**Build, preview, and deploy**

- Build is immutable. Record page count, size, duration, date, and one of `SUCCEEDED`, `SUCCEEDED WITH WARNINGS`, `SUCCEEDED PARTIAL SOURCE`, `FAILED`.
- Partial-source builds are preview/download-only; they cannot deploy.
- Preview disables custom scripts/ad integrations. ZIP download is supported. Images remain referenced by original Bing URLs rather than copied into the ZIP.
- Supported hosts: Cloudflare Pages, Vercel, GitHub Pages, and FTPS cPanel.
- Mask/encrypt saved hosting credentials. A successful provider test is required before deploy.
- Deployment is asynchronous. Distinguish `VERIFIED DEPLOYED` (public URL serves build), `SUCCEEDED` (host accepted upload but URL not confirmed), `FAILED`, and simulated/no-upload.
- Deployment replaces the files currently served at the selected target. Show the exact build, host, and public URL before confirmation; compare the candidate route set with the currently live sitemap/previous build and block or require explicit resolution for removals. This route-diff gate is an inferred safeguard, motivated by the tested candidate dropping 15 live article URLs.
- Allow redeployment of an older immutable build as rollback.

Sources: [Static customization](https://ghost.bloggent.com/help/customize-your-static-site), [Build and preview](https://ghost.bloggent.com/help/build-and-preview-your-static-site), [Hosting providers](https://ghost.bloggent.com/help/connect-a-hosting-provider), [Deploy](https://ghost.bloggent.com/help/deploy-your-static-site).

### 13. Billing, Limits, and Backup/Restore

**Observed public package pricing (BDT/year)**

| Package | Annual price | Workspace cap |
|---|---:|---:|
| Free | BDT 0 | 1 |
| Starter | BDT 20,000 | 5 |
| Growth | BDT 35,000 | 10 |
| Agency | BDT 50,000 | 50 |

Packages add workspace capacity for 365 days; they do not include AI provider spend. The public pricing page said paid ordering was unavailable because payment details had not been published. The current signed-in Billing screen instead shows manual-payment instructions and enabled Order buttons. UI presence does not prove the backend will accept an order; this conflict is unresolved, and no order was started.

When ordering is available, docs describe manual payment via bKash/Nagad/Rocket/bank, a server-confirmed promo quote valid for 24 hours, transaction reference, and human review. A pending order blocks another. Same-package renewals chain; a different package starts a full 365-day term on approval with no unused-time proration. Expiration preserves content while reducing capacity to the free cap.

**Backup/restore**

- Backup includes workspace/static settings, author profiles, plans, full article content, link graph, runs, and usage records.
- Exclude AI/Ghost secrets, passwords, and sessions.
- Export flow: create → checksum verify → download JSON → optional restore. A restore validates before writing, skips existing article/plan/author/link rows, does not delete or overwrite those rows, and replaces website name/static-site settings with backup values. Show a before/after settings preview and record the restore result. Restore does not publish to Ghost.
- Import flow: validate the selected backup JSON and apply it immediately; record an Import history row. Imported rows are marked as already added and do not expose a second Restore action. Never include Ghost/AI credentials, passwords, or sessions; require reconnection/reconfiguration after moving to a new workspace.
- The same-snapshot restore was runtime-tested; changed settings were not. Test settings replacement, idempotent row skipping, checksum failure, malformed/wrong-schema files, size limits, import into another workspace, and partial failure/rollback in a disposable fixture before release.
- Current public guide states up to 10 backups and 5 imports per 15 minutes per account, a 25 MB import limit, up to 30 Export backups per workspace, and no automatic backup schedule. Keep rate limits separate from retention limits and surface the exact error/retry time.

Sources: [Pricing](https://ghost.bloggent.com/pricing), [Usage and limits](https://ghost.bloggent.com/help/check-your-usage-and-limits), [Order/renew](https://ghost.bloggent.com/help/order-or-renew-a-package), [Order history](https://ghost.bloggent.com/help/track-or-cancel-an-order), [Backup/restore](https://ghost.bloggent.com/help/back-up-and-restore-a-workspace).

## Cross-Cutting State Models

### Account

`SIGNUP → EMAIL_UNVERIFIED → PENDING_APPROVAL → ACTIVE`; administrator may set `SUSPENDED`. Password reset is a separate tokenized flow; successful reset invalidates other sessions. Exact backend enum names are not verified.

### Connection

`NOT_CONNECTED`, `CONNECTED`, `DEGRADED`, `ERROR`. Testing should be read-only, and replacing credentials should validate before replacing a working secret.

### Run and Job

Run groups jobs and preserves an immutable settings snapshot. Job state should distinguish queued/running/success/error/refused/review-held/publish-held/cancelled; persist stage, attempts, timing, tokens/cost, provider, error reason, and Ghost publish ledger linkage.

### Build and Deployment

Build snapshot is immutable. Deployment attempt references one build and one tested host connection. Keep host-accepted separate from publicly verified. Preserve old builds for rollback.

### Calendar Entry

Keep `write_at` separate from `publish_at`, store timezone, and track whether generation, review, and publish have happened. Automation toggles are independent and off by default.

## Suggested Domain/Data Model

This is an **inferred implementation model**, not a recovered schema. Use IDs and tenant scoping consistently; preserve immutable history for billing, AI usage, runs, publish attempts, builds, and deployment attempts.

| Entity | Key relationships and implementation notes |
|---|---|
| Account | identity, verified email, approval/suspension, password hash, sessions, package/order state |
| Workspace | belongs to account; one-site boundary; configuration, status, created/updated timestamps |
| AIKey | account-owned encrypted secret, provider/capabilities, priority, enabled/cooling state, quota |
| UsageEvent | account/key/workspace/run/job links; reserve/settle/release; preserve after key deletion |
| GhostConnection | workspace-owned encrypted credential, URL, validation status, last test/error |
| GhostPostInventory | workspace + Ghost post ID, metadata/body snapshot, sync time, edit/sync provenance |
| ContentPlan | workspace, source research, topics/clusters, ordering, user edits, selected/skipped state |
| ResearchProject | workspace, prompt/options, stage results, evidence provenance, tokens, status, archive state |
| Calendar / CalendarEntry | workspace, plan, timezone, separate write/publish times, automation flags, entry lifecycle |
| Run / ArticleJob / JobStage | run snapshot, job input/outcome, per-stage attempts/timing/provider/token/cost/error |
| Article | workspace, job, Ghost identity/status, body/metadata, user-edit provenance, uniqueness evidence, brief/voice snapshot reference |
| ArticleBrief | article/job, audience, intent, outcome, required deliverables, constraints, evidence policy, immutable submitted version |
| VoiceProfile / VoiceSample | account or workspace scope, versioned voice settings, authorized sample metadata/content, consent and deletion state |
| ArticleImageSlot | article, featured/section purpose, section reference, status/policy, selected asset, alt text, retry history |
| ImageAsset / ImageReview | provider/source/license/creator/attribution, rights flags, retrieval/hash/file metadata, relevance review, rejection reason |
| PublishAttempt | article, idempotency/reconciliation state, request/outcome, Ghost ID, timestamps |
| AuthorProfile | workspace, explicit Ghost author ID, bio/expertise, active/default |
| LinkEdge / LinkAudit | source/target article, proposed/applied state, audit classification, evidence, user confirmation |
| StaticSettings | workspace, versioned template/site/robots/menu/snippet/ad configuration |
| StaticBuild | immutable settings/content snapshot, completeness, warnings, size, output hash |
| HostingConnection / Deployment | workspace, encrypted/tested host, build ID, upload/verification state, rollback lineage |
| Order | account, package, quote expiry, payment reference/status, human review, term dates |
| Backup | workspace, checksum, schema version, included data manifest, restore/import audit |

## Architecture Implications

**Inferred, not source-code verified:** the documented behavior implies a browser UI over an authenticated API, a persistent relational data model, a durable background queue/worker, and adapters for AI vendors, Ghost Admin API, and hosting providers.

Implementation constraints for a similar product:

- Run generation and deploys as durable jobs that survive browser closure and process restart.
- Make provider operations idempotent where possible. Persist intent before external side effects; reconcile ambiguous outcomes before retry.
- Separate domain states from vendor response payloads. Preserve useful vendor error details without exposing secrets.
- Scope every content/job/query operation by account and workspace authorization, not only by client-selected ID.
- Record frozen run settings and immutable build snapshots so retries and rollbacks are reproducible.
- Store usage reservations and settlements as an auditable ledger; avoid double charging on retry.
- Use explicit, independent permission/confirmation boundaries for live publishing, destructive delete, link repair, custom code, automation, and payment.

No framework, database, queue technology, exact API route, or internal schema was established by this audit.

## Safety, Privacy, and UX Requirements

- Start new workspaces in sandbox; recommend draft publishing until a user explicitly opts into live mode.
- Show the effective publish mode, target Ghost site, model, expected token spend, and automation state before queueing billable/live work.
- Treat title/body/metadata edits, post deletion, link repair, static deploy, and custom snippets as externally consequential actions.
- Require typed confirmation for high-impact link repair and exact-name confirmation for workspace deletion.
- Do not overwrite manually edited Ghost posts during automated repairs.
- Keep secrets encrypted/masked and never include them in exports/backups. Redact auth headers and secret values from logs.
- Make retry safe: idempotency key or read-only reconciliation before sending a publish/deploy again.
- Label uncertain, partial, simulated, and unverified states. Do not convert an HTTP/provider acknowledgement into “publicly live” without verifying the public result.
- Label AI estimates and interpretations; do not invent traffic or keyword metrics.
- Display platform plan spend and external AI provider spend separately.
- Backups must have checksums/schema version and a preview of the restore effects. Restore must not publish to Ghost.

## Acceptance Checklist for an Implementation Agent

### Authentication and tenancy

- [ ] Signup, verification, manual approval, suspension, sign-in, reset, and session revocation have explicit states and safe rate limits.
- [ ] Reset responses do not reveal account existence; reset token is one-use/expiring and invalidates other sessions.
- [ ] Cross-workspace reads/writes are denied server-side even if a client submits another workspace ID.
- [ ] Deletion is blocked during active work and does not delete provider-side posts/files.

### Content pipeline

- [ ] Keyword batch normalization, 100-topic maximum, >200-character warnings, duplicate preview, and frozen run settings work.
- [ ] At most two article jobs run concurrently per workspace.
- [ ] All six stages, retry attempts, costs/tokens, terminal outcomes, and CSV export are observable.
- [ ] Closing/reopening the browser does not lose run state; cancellation has documented current-stage semantics.
- [ ] Duplicate checks run before generation and before publish; held/refused work is reviewable.
- [ ] Ambiguous Ghost publish is reconciled before retry; duplicate public posts are prevented.

### Images and reuse rights

- [ ] Featured and inline image slots are independent, may remain empty, and retain explicit per-slot status and retry history.
- [ ] Candidate provenance records original source, creator, license/attribution, use permissions, retrieval time, provider, and asset hash; search thumbnails alone are never treated as rights evidence.
- [ ] Rights eligibility is checked before relevance ranking; unknown or disallowed rights, watermarks, invalid files, and unsafe URLs are rejected with visible reasons.
- [ ] Image fetches enforce redirect/SSRF protections, MIME/decoded-file validation, byte and pixel limits, and timeouts.
- [ ] A retry changes only its target image slot, preserves the old asset until replacement is eligible, and is idempotent; published-post replacement requires confirmation and safe reconciliation.
- [ ] `Remove image`, `Optional`, and `Required` are separate behaviors. Required-image holds offer retry or an explicitly recorded publish-without-image override.
- [ ] Review UI shows preview, rights/attribution, source, alt text, and a working replace/remove action.

### Writing voice and quality

- [ ] Versioned voice profiles support structured preferences and user-authorized samples; sample permissions, tenant isolation, preview, replacement, and deletion are enforced.
- [ ] Article briefs capture audience, intent, outcome, required concrete artifacts, evidence/claim constraints, and exclusions; submitted runs store immutable profile/brief snapshots.
- [ ] Planning produces explicit, reviewable acceptance criteria; hard requirements cannot be masked by high aggregate intent or coverage scores.
- [ ] Quality review flags missing deliverables, unsupported numbers/claims, repeated advice, generic filler, and voice drift with actionable evidence.
- [ ] Generated drafts do not invent citations, statistics, personal anecdotes, or author credentials; missing evidence is labeled for human review.
- [ ] User edits and approvals are preserved; live publication remains subject to its separate frozen mode and confirmation/review rules.

### Research, calendar, and automation

- [ ] Research persists 11-stage progress, evidence labels, edits, partial/failure states, retry, and archive/restore.
- [ ] Calendar stores timezone and separate write/publish timestamps; skipped/rescheduled entries are auditable.
- [ ] Write, publish/draft-save, and cluster-link automation are independent per-calendar switches, default off; the detail view accurately explains each active side effect.
- [ ] Test each automation toggle independently in a disposable workspace: write-only leaves content waiting; publish-only does not silently trigger generation; cluster linking edits only eligible same-calendar cluster posts; disable stops future actions without undoing prior effects.
- [ ] Test manual `Write now`/`Publish now`, local-time/DST scheduling, work already started, fill-from-plan repeat behavior, and live-vs-draft behavior; resolve the guide's draft-calendar setup inconsistency before release.
- [ ] Backup restore/import and app updates leave all automation disabled unless the user separately enabled it on that calendar.
- [ ] Token limits and request rate limits apply server-side, not only in UI validation.

### Ghost, links, and articles

- [ ] Connection test/sync are read-only; invalid replacement cannot erase a working connection.
- [ ] Sandbox inventory cannot silently leak into live mode.
- [ ] Metadata, exports, bylines, Ghost IDs, and article deletion behave as documented.
- [ ] Link audit is preview-first; typed `APPLY` gates changes; manually edited posts are skipped.

### Static delivery, billing, and recovery

- [ ] Partial-source builds cannot deploy; each build is immutable and downloadable.
- [ ] Credential test is required before host deploy; accepted upload is distinguished from verified public serving.
- [ ] Pre-deploy confirmation names the exact build, host, and public URL; it warns that deployment replaces currently served files.
- [ ] Compare candidate routes to the live sitemap/previous deployment, flag removals/additions, and block unsafe replacement until resolved; verify public routes after upload.
- [ ] Older successful build can be redeployed as rollback, and rollback completion is publicly verified.
- [ ] Package capacity and external AI spend are distinct; payment availability is checked before order creation.
- [ ] Backup checksum/schema validation, secret exclusion, size/rate limits, and non-publishing restore are tested.
- [ ] Restore skips existing content rows, previews website/static-setting replacement, and reports row counts; malformed/tampered imports fail before writes, external imports are applied once, and partial failures have a tested recovery path.
- [ ] Restore/import never publishes content or enables calendar automation; verify this with a calendar containing previously disabled automation.

### Ghost publishing

- [ ] A test Ghost site proves live mode publishes only after all configured gates pass; draft mode saves an unpublished post, and the selected mode is frozen at job submission.
- [ ] Draft review opens the correct Ghost post, permits body review/edit in Ghost, and public publication is confirmed from the public site before the app reports it as live.
- [ ] Retry after an ambiguous Ghost response reconciles the existing post before resending, preventing duplicates; sync inventory reflects the final status.
- [ ] Live publishing, draft save, scheduled publish, and draft-save calendar behavior are tested separately in a disposable Ghost workspace; production publishing is not a required audit action.

### Product-wide UX

- [ ] Overview is read-only and Golden Path completion requires evidence.
- [ ] Search/command launcher, workspace switcher, mobile navigation, activity state, and theme work across pages.
- [ ] Every destructive/billable/public action communicates exact side effect and target before execution.
- [ ] Loading, empty, permission, partial, retryable error, and terminal states are designed for every long-running feature.

## Known Gaps and Required Follow-Up

- The signed-in walkthrough covered all 20 page areas. Runtime tests now include generation, research, plan creation, featured-image retry, Ghost connection test/sync, backup/restore, static build/preview and ZIP route comparison, plus article metadata-editor validation.
- Direct public publication remains untested. The current article needs a substantive body edit, which Bloggent does not expose, and the image needs a rights-cleared replacement. The user asked to skip Ghost Admin sign-in; do not publish this weak, rights-unclear draft through another route.
- Static deployment remains untested. The verified cPanel host points at `https://gophd.com`. The candidate build omits 15 live sitemap URLs that currently return HTTP 200 and removes 47 HTML routes from the last deployed archive. Do not deploy `jvndt0`; rebuild only after restoring or otherwise preserving all required live routes.
- Backup restore was tested only by restoring a verified snapshot into the same unchanged workspace, which added zero rows. Invalid/tampered artifacts, external imports, changed-settings replacement, and restore rollback remain untested.
- The research run's query overlap was stale at execution time. A subsequent inventory sync completed, but the research stages were not rerun against the refreshed corpus.
- Calendar automation is present in current public guides; the earlier signed-in pass saw a stale planning-only notice but did not inspect a calendar's automation detail. Draft-calendar setup is inconsistent between guides and needs a signed-in check. Billing availability remains unresolved. Restore row/settings behavior is documented and same-snapshot restore is tested, but changed-settings replacement and external-import edge cases need fixture tests.
- No Ghost AI Writer source repository or private API schema was provided. The architecture, data model, and backend mechanics above remain inferred from behavior and docs.

## Sources

**Live product pages**

- [Product home](https://ghost.bloggent.com/)
- [Pricing](https://ghost.bloggent.com/pricing)
- [Help index](https://ghost.bloggent.com/help)
- [Signup](https://ghost.bloggent.com/signup)
- [Sign in](https://ghost.bloggent.com/login)
- [Password reset](https://ghost.bloggent.com/forgot-password)

**All 37 public help guides reviewed**

1. [Start here](https://ghost.bloggent.com/help/start-here)
2. [Glossary](https://ghost.bloggent.com/help/glossary)
3. [Create your account](https://ghost.bloggent.com/help/create-your-account)
4. [Sign in and reset your password](https://ghost.bloggent.com/help/sign-in-and-reset-your-password)
5. [Keep your account secure](https://ghost.bloggent.com/help/keep-your-account-secure)
6. [Create a website workspace](https://ghost.bloggent.com/help/create-a-website-workspace)
7. [Use the setup guide](https://ghost.bloggent.com/help/use-the-setup-guide)
8. [Switch, rename, or delete a workspace](https://ghost.bloggent.com/help/switch-rename-or-delete-a-workspace)
9. [Understand the overview dashboard](https://ghost.bloggent.com/help/understand-the-overview-dashboard)
10. [Connect your Ghost website](https://ghost.bloggent.com/help/connect-your-ghost-website)
11. [Check your Ghost connection](https://ghost.bloggent.com/help/check-your-ghost-connection)
12. [Add an AI key](https://ghost.bloggent.com/help/add-an-ai-key)
13. [Set daily token limits](https://ghost.bloggent.com/help/set-daily-token-limits)
14. [Choose your AI model and content defaults](https://ghost.bloggent.com/help/choose-your-ai-model-and-content-defaults)
15. [Set up author bylines](https://ghost.bloggent.com/help/set-up-author-bylines)
16. [Research your niche](https://ghost.bloggent.com/help/research-your-niche)
17. [Turn research into content plans](https://ghost.bloggent.com/help/turn-research-into-content-plans)
18. [Get AI keyword ideas](https://ghost.bloggent.com/help/get-ai-keyword-ideas)
19. [Plan a pillar and cluster](https://ghost.bloggent.com/help/plan-a-pillar-and-cluster)
20. [Schedule articles with a content calendar](https://ghost.bloggent.com/help/schedule-articles-with-a-content-calendar)
21. [Turn on calendar automation](https://ghost.bloggent.com/help/turn-on-calendar-automation)
22. [Create your first content run](https://ghost.bloggent.com/help/create-your-first-content-run)
23. [Follow a run in progress](https://ghost.bloggent.com/help/follow-a-run-in-progress)
24. [Review and publish an article](https://ghost.bloggent.com/help/review-and-publish-an-article)
25. [Understand a duplicate refusal](https://ghost.bloggent.com/help/understand-a-duplicate-refusal)
26. [Retry a failed task](https://ghost.bloggent.com/help/retry-a-failed-task)
27. [Edit, export, or delete an article](https://ghost.bloggent.com/help/edit-export-or-delete-an-article)
28. [Audit and repair internal links](https://ghost.bloggent.com/help/audit-and-repair-internal-links)
29. [Connect a hosting provider](https://ghost.bloggent.com/help/connect-a-hosting-provider)
30. [Customize your static site](https://ghost.bloggent.com/help/customize-your-static-site)
31. [Build and preview your static site](https://ghost.bloggent.com/help/build-and-preview-your-static-site)
32. [Deploy your static site](https://ghost.bloggent.com/help/deploy-your-static-site)
33. [Check your usage and limits](https://ghost.bloggent.com/help/check-your-usage-and-limits)
34. [Read your analytics](https://ghost.bloggent.com/help/read-your-analytics)
35. [Order or renew a package](https://ghost.bloggent.com/help/order-or-renew-a-package)
36. [Track or cancel an order](https://ghost.bloggent.com/help/track-or-cancel-an-order)
37. [Back up and restore a workspace](https://ghost.bloggent.com/help/back-up-and-restore-a-workspace)
