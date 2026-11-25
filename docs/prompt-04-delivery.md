# Prompt 04 delivery and verification

Current UI: the [mobile refinement](mobile-refinement.md) supersedes earlier card quick-action and nested rating-dialog requirements. Database and privacy contracts remain in force.

Delivery date: **23 November 2026**. Updated release state: all 24 hosted migrations are applied, 27 real titles imported from the authorized TMDB/MAL providers, and the explicitly chosen Google account is owner/Super Admin. Website deployment, browser OAuth/Storage and device QA remain pending. The [release handoff](vercel-release.md) supersedes the earlier local-only delivery status. No account purge or production website deployment was performed.

## 1. Implementation summary

The cinematic shell now connects to verified Supabase users and normalized PostgreSQL data through server-only services, authenticated Server Actions, no-store query endpoints, and database-enforced ownership and roles. Mutations have pending feedback, duplicate protection, validation, recoverable errors, and success feedback. Title controls share a user-scoped query cache with optimistic updates and rollback. Follow and collection-favorite interactions also update optimistically with rollback.

The visual system retains charcoal surfaces, amber accents, Geist and restrained italic editorial type, and original SVG landscapes. Mobile heroes and empty states are shorter. Grids, shelves, forms, collection rows, dialogs, and administrative views have explicit small-screen layouts. Dialogs sit above the fixed navigation, contain their own scrolling, and respect safe-area insets. Real data shelves appear only when populated; empty catalog and setup states do not invent activity.

## 2. Pages created or redesigned

| Page                             | Result                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                             | Editorial hero, category entry points, real catalog/Watching/recommendation/published collection shelves when available                                                         |
| Discover                         | Guest title browsing, debounced search, category/genre/year/country/language/community rating/release status filters, sorting, pagination; authenticated people and collections |
| Title `/titles/[id]`             | Canonical direct page plus intercepted modal; metadata, community aggregate, private actions, trailers, credits, related titles, correction submission                          |
| My Library                       | Real tracking and statuses, favorites, rated titles, owned/saved/imported collections, search, sorting, pagination                                                              |
| Collection `/collections/[id]`   | Owner editor and member presentation; titles, notes, ordering, uploads, publish/unpublish, share link, delete, social actions                                                   |
| Profile and `/people/[username]` | Real identity, avatar, bio, follow counts, published collections; edit/follow/block/report; own-only private summary                                                            |
| Onboarding                       | Persisted username/display-name draft, categories, genres, optional Planned starter titles, back/skip/complete                                                                  |
| Notifications                    | Header dialog and contextual page; unread count, one/all read, pagination, accessible destination links                                                                         |
| Settings                         | Account, profile editing, interests, notification/recommendation preferences, blocked accounts, JSON/CSV export, deletion, sign-out                                             |
| Account recovery                 | Hidden/inactive account handling and fresh-Google 30-day recovery flow                                                                                                          |
| Administration                   | Database-role-protected moderation, public member management, catalog, requests/corrections/duplicate review, provider status, public counts, audit, owner role controls        |
| Login / callback / Credits       | Existing Google PKCE flow retained, onboarding and intended-action return added, attribution page added                                                                         |

Exactly four primary navigation destinations remain: Home, Discover, My Library, Profile.

## 3. Components

New connected components under `src/components/product` include product/query providers, toast feedback, accessible dialogs and confirmations, catalog/library browsers, title actions and details, title-state batching, reusable poster controls, recommendation feedback, collection cards/picker/create/editor/title selector, upload previews, creator profiles/editing, onboarding, notifications, settings, recovery, reports/corrections/requests, and the admin console. Radix supplies modal focus/scroll behavior and keyboard menus; dnd-kit supplies pointer/touch/keyboard reorder handles, with explicit Move Up/Down alternatives.

## 4. Database integration

Twenty-four reviewed migrations define **58 RLS-protected application tables** (56 public and two private), **112 functions**, and **94 policies**, including Storage policies. Types are generated from all migrations and checked for drift. The generated inventory lists the exact objects.

The foundation includes permanent usernames, lifecycle status, private tracking and history, tenth-point ratings, private favorites/preferences, normalized catalog metadata, collections and interaction references, follows/blocks, real notifications, moderation, roles, audit, and deletion/export records. New transactional RPCs cover idempotent creation/import, batch membership, complete collection ordering/sorting, canonical private state after merges, onboarding drafts, guest catalog search, library queries, private counts, and membership indicators. No managed Auth records were written by migrations.

## 5. Metadata providers

Implemented: server-only TMDB search/details adapter; strict normalization; posters/backdrops; genres/countries/languages; release information; alternative titles; credits; official trailers; existing canonical related-title links; timeout/retry handling; approved-provider checks; stable UUID mappings; transactional cache ingestion; preservation of editorial overrides; sanitized sync state and errors.

TMDB and MyAnimeList credentials passed live authentication; providers are approved/enabled for the operator-confirmed personal/non-commercial use. The official TMDB logo and required notice are on Credits. The launch catalog has 20 actual film/TV works and seven anime, with canonical UUIDs and no external-rating substitution. Offline metadata copying remains disabled.

A separate server-only MyAnimeList adapter handles anime; Japanese animation remains refused by the TMDB path. AniList is not used. No scraping or paid AI is used. Provider popularity can sort titles; provider scores never become SceneStack ratings.

## 6. Connected user journeys

The implemented flows connect real mutation entry points to database reads:

- Standalone movie/documentary → Add to Watched → Completed/Watched; episodic categories → Watching. Status menus include Planned, Watching, Completed, On Hold, Dropped. Confirmed removal retains rating/favorite.
- Private heart toggle and 1.0–10.0 rating in increments of 0.1; owner library reads persist the results. Shared cache updates all visible instances of the same title and rolls back on errors.
- Create a private-default collection with counters, spoiler flag, automatic collage or previewed custom upload; creation request IDs prevent duplicates. Optional media finalization failures preserve the private collection and explain retry behavior.
- Add titles to one or multiple collections, with current membership indicators and duplicate prevention. Create from the picker preserves the selected title. Owner pages expose title search/category filters, multi-selection, notes, reorder handles, keyboard moves, automatic sort, cover editing, visibility confirmation, sharing, and confirmed deletion.
- Favorite a published collection, save the original, or import an independent private copy. Unpublishing removes original access/saves/favorites while imported copies survive. Creator attribution is retained where permitted and anonymized on source-owner deletion.
- Follow/unfollow updates state and count, persists, and triggers an eligible notification. Blocking removes both follow directions and prevents profile/collection interactions. Reports go to moderation.
- First Google sign-in enters persisted onboarding. Intended title actions survive Google plus onboarding with a bounded, nonce-matched session intent; ordinary protected destinations remain allowlisted. Returned users do not repeat onboarding.
- Preferences, exports, deletion request and recovery have real server/database paths. Irreversible cleanup remains explicitly gated and unscheduled.

These paths are implemented and their database behavior is locally tested. They have **not** been verified as live authenticated browser journeys against the hosted project.

## 7. Screenshots and responsive QA

No screenshots were captured. Computer-use inventory returned **no browsers or tabs**. No browser was available for layout, actual navigation history, touch interactions, or live OAuth verification.

The CSS includes layouts for the requested widths; the following device matrix still requires manual visual/interaction sign-off: **320×700, 390×844, 430×932, 768×1024, 1366×768, 1440×900, 1920×1080**. Inspect modal backdrop/title/controls, sticky headers, bottom navigation clearance, safe areas, keyboard focus, long titles/notes, empty/loading/error states, image failures, and drag/touch alternatives at every relevant breakpoint. Source inspection and DOM tests are not screenshots or device testing.

## 8. Automated verification

- ESLint with zero warnings: passed.
- Next route type generation and strict TypeScript: passed.
- Unit/component/DOM suite: **27 scenarios across twelve files**, passed.
- Isolated PostgreSQL suite: **50 scenarios across four files**, passed.
- Migration validation and generated-type consistency: passed.
- Production webpack build: passed; repeated after the final callback and UI changes.
- Publishable-source and client bundle secret scan: passed.
- Trusted worker dry run and explicit approved live catalog imports: passed.
- Guest HTTP route/security smoke checks: 50 routes/assets passed; all six live categories, canonical details and denied offline snapshots also passed.

The standard runner reports test files as top-level tests in this environment. Scenario totals count the individual registered tests. PostgreSQL tests cover ordinary-user/admin/service isolation, auth metadata spoofing, immutable usernames, fractional rating constraints and anonymous cohorts, collection transactions/independent copies, block/follow/notifications, Storage RLS, recovery/purge gates, catalog redirects and deduplicated ratings, provider approval/cache rollback, canonical personal state, and private picker membership counts. The DOM test exercises accessible dialog naming, focus trapping, Escape, focus restoration, and scroll/pointer unlock.

The prompt's browser tests A–I are **not claimed passed end-to-end**. Their persistence/authorization portions are covered by SQL and validation tests; the dialog portion has DOM coverage; real Google sign-in, refresh behavior in a browser, touch layout and screenshots remain manual.

## 9. Security checks

Verified locally: all application tables have RLS; definer search paths are pinned; anon RPCs are allowlisted; ownership/status/role spoofing is denied; admins/service workers cannot read private personal tables through application grants; Storage paths/types/sizes are constrained; blocked/private/unpublished content is inaccessible; community rating thresholds/deduplication hold; provider credentials are server-only; CSV cells resist spreadsheet formulas; exports are owner-scoped; purge remains dry-run by default and fresh OAuth is required for recovery. Query responses are private/no-store. OAuth callback redirects use allowlisted relative Locations, and Proxy uses Next’s supported redirect handling. Arbitrary forwarded-host input is not used.

These do not replace a hosted Supabase policy audit or a production security review.

## 10. Known limitations

The hosted schema, Auth/Storage integration, real provider responses, browser history interception, mobile visual behavior and authenticated cache rollback have not been tested in a real browser. The local PGlite Auth/Storage stubs do not reproduce every hosted service behavior. Upload plus row finalization spans Storage and PostgreSQL; failed finalization can leave owner-only orphan files. The approved TMDB logo is installed. No worker scheduler or production hosting configuration is activated.

## 11. Manual setup

Backend setup, owner bootstrap, private bucket verification, provider authorization/attribution, and the real launch catalog are complete. Choose the Vercel production origin and configure exact Google/Supabase callback URLs. Configure trusted scheduled jobs only after staging tests. Instructions and explicit operator commands are in [the database setup guide](database-foundation.md).

## 12. Migration deployment

All 24 migrations were applied to the explicitly approved SceneStack project after schema/history inspection and a reviewed dry run. The original Auth account was preserved. For another environment, inspect its schema/history and backup, test in disposable staging and review an explicitly targeted dry run before applying. Never reset an existing project to make the migration set fit. See [the exact deployment procedure](database-foundation.md#hosted-migration-procedure--manual-and-permission-gated).

## 13. Before public launch

Obtain website deployment authorization; use a separate staging environment for browser sign-off; verify live Google Auth/Storage and production callback origins; run browser tests A–I plus the full viewport matrix; test export/deletion/recovery and controlled worker cleanup; verify backups, monitoring, provider retry operations, owner recovery, hosting environment/callback configuration, and final bundle/security checks. SceneStack is **not claimed production-ready**.

## Master Prompt 04 addendum

The connected product now includes shared quick actions with explicit tracking badges; opt-in private search history and keyboard suggestions; advanced metadata and verified relationship labels; responsive one/two/three/four-poster collages; context-preserving collection creation; debounced version-checked autosave and in-memory draft recovery; collection view filters and explicit saved ordering; bulk library management with partial-failure reporting; private Recently Viewed and Continue Exploring; spoiler consent gates that withhold previews and notes; profile covers and featured collections; a followed-creators feed; and an installable manifest/offline shell with licensed public-only metadata caching.

See [the addendum verification matrix](prompt-04-addendum.md) for coverage, operational setup, and browser-only checks that remain unverified. The DOM workflow test runs the actual client components/cache and mocks only network/action transport; its results do not constitute live Supabase or Google end-to-end testing.
