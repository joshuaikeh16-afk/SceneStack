# SceneStack production readiness

Updated 25 November 2026. **Release recommendation: NO-GO.** The current production build, strict types, lint, all 16 unit/component test files, all seven database test files, secret scan and 58 guest HTTP checks pass locally. The public carousel has eight-viewport browser measurements from the earlier P0 pass; authenticated Control Center journeys remain unverified. Hosted Supabase now matches 001–031. The corrected rerunnable SQL Editor bundle and standalone verifier passed enforced read-only hosted checks. Use the [current Control Center deployment guide](control-center-deployment.md) and its tested SQL Editor bundle. Provider permission is now operator-confirmed; see [catalog expansion](catalog-expansion.md). Final domain/DNS and OAuth and authenticated sign-off remain release blockers. This repair made no permanent hosted changes; no public deployment was performed.

The detailed refinement notes and verification table below are the earlier redesign snapshot. Their pending build/component/browser entries are superseded by the current verification above and the deployment guide.

## Changes implemented

- Added a shared cinematic dark system across navigation, Home, Discover, Library, collections, profiles, title details, sign-in, settings, notifications, and dialogs. Refined spacing, typography, charcoal surfaces, artwork, and restrained amber accents.
- Replaced desktop navigation with an inset floating panel and mobile navigation with a floating dock. Preserved exactly Home, Discover, My Library, and Profile. Added contextual settings access, safe-area clearance, opaque/reduced-transparency fallbacks, and modal visibility management. Corrected legacy tablet and dock conflicts.
- Added a manually controlled carousel of up to five actual catalog titles with tracking, details, pagination, navigation, and artwork error handling. No autoplay. Added compact categories and drama/animation shelves. Empty personal sections remain omitted.
- Retained the existing TanStack infinite feeds for independent Home rails and vertical Discover results: canonical deduplication, cancellation, bounded caches, keyset paging, request throttling/backoff, retry, and scroll anchoring. Added desktop rail controls without rerendering on every scroll tick. Cursors can continue across provider-filtered pages.
- Preserved ordinary cards containing only poster, title, and metadata. Title interactions remain in details and the hero. Added failed-artwork fallbacks, title-scoped action state, and a modal-specific retry surface. Backend failures reach error handling instead of being silently treated as missing titles.
- Added URL-backed Library filters/sorting/pagination and validated sign-in return destinations. Selection resets with its result set. Standalone editions use Watched; episodic editions use Watching.
- Added collection poster-grid browsing with notes and a separate owner arrangement/notes view. Preserved drag/keyboard ordering, publishing, covers, notes, spoiler gates, favorites, saves, independent imports, and sharing. Removed the empty-cover slogan. Collections remain private by default.
- Refined cohesive profile and account surfaces. Preserved member-visible profiles/published collections and owner-only tracking, favorites, ratings, and private collections. No private-account feature was added.
- Added configurable domain/operator/contact details and public `/privacy`, `/terms`, and `/contact` pages. Policies describe the actual 30-day account recovery window and separate irreversible cleanup process. Review against final production practices remains necessary.
- Added canonical title metadata, a generated Open Graph image, preview-safe robots/sitemap configuration, and noindex account/community routes. Bumped service-worker caches to discard older public metadata copies.
- Added independent production provider gates. Credentials/local ingestion flags alone cannot authorize public use. Application title responses filter disabled providers through bounded provenance reads; artwork is also gated. Workers check flags before claiming refresh work. Existing database records were preserved.
- Made full test scripts sequential. Added `test:light` and `check:source-secrets` for resource-constrained local verification.

## Routes reviewed

Source review and shared refinement covered `/`, `/discover`, `/library`, `/profile`, `/people/[username]`, `/collections/[id]`, `/settings`, `/notifications`, `/login`, `/auth/callback`, `/onboarding`, `/admin`, `/account/recovery`, `/titles/[id]`, intercepted title dialogs, loading/error/404 states, data APIs, public-title APIs, private assets, and server actions.

New routes: `/privacy`, `/terms`, `/contact`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml`. Source review does not establish browser or authenticated end-to-end success.

## Verification

| Check | Result |
| --- | --- |
| TypeScript | Passed in one process with a 384 MB heap cap, using existing generated route types. |
| ESLint | Passed with zero warnings, using a single 256 MB capped process. |
| Focused tests | `npm run test:light` passed seven test files sequentially in about three seconds. Includes cursor pagination, provider backoff, production flags/provenance, tracking labels, redirect validation, clean cards, collages, offline cache restrictions, and preview indexing. |
| Isolated database tests | All four database test files passed before implementation. No migrations changed afterward. |
| Migration validation/types | All 24 migrations validated in isolated PostgreSQL; generated database types matched. |
| Hosted schema/permissions | Read-only comparison passed: 58 application tables, all compared columns, 112 function signatures/bodies/permissions, 94 policies, and effective table grants matched local migrations. |
| Source credential scan | Passed for configured secret literals and server credentials in the committable environment example. |
| Client bundle scan | Pending: the unsuccessful build did not produce `.next/static`. Default full verification still requires build output; source-only mode explicitly reports its narrower scope. |
| Full component suite | Pending: the large interaction test exceeded the 256 MB safety cap and stopped. The cap was not raised after the user requested light work. New carousel assertions are present but not signed off. |
| Production build | Unresolved: the attempt failed while parsing TypeScript `--showConfig` output. Standalone config parsing and TypeScript subsequently passed. The full build was not restarted after the resource constraint. |
| HTTP smoke | No final pass. An earlier development run failed a dynamic-title 404 assertion on a streamed HTTP 200. The harness now uses an HTML-limited crawler user agent for status assertions; the updated full checks still need a completed build/server run. |

## Browser and viewport status

Computer-use inventory returned no available browsers or native app surfaces. No screenshots or real-browser visual, touch, or keyboard passes were performed. **320, 360, 375, 390, 414, 768, 1024, 1440, and 1920 pixels all remain unverified in a browser.**

Check every major route for document overflow, dock clearance, poster alignment, text wrapping, action visibility, modal focus/Back behavior, retained rail position, filters, paging/retry, reduced motion/transparency, and loading/empty/error states. Verify Open Graph PNG rendering, PWA installation/offline use, and actual private image uploads on devices.

## Database and API status

Hosted schema integrity was verified without writes. Existing server adapters, tracking/rating mutations, collection transactions, RLS, social features, and account lifecycle infrastructure are retained. Isolated SQL tests do not prove production Google-session journeys.

The earlier handoff records 27 imported real provider titles and credential checks for personal/non-commercial use. This does **not** establish public-release permission. No fresh production catalog/provider API success is claimed here. Both public-release permissions remain unconfirmed.

Application provider switches do not modify existing Supabase provider registrations or direct database access policies. Review already-imported provider data and hosted exposure before public deployment. No records were deleted or reapproved.

## Production configuration

Confirmed operator: **Ikeh Joshua, independent developer**. Planned domain: **https://scenestack.media**. Support/privacy: **scenestackcc@gmail.com**. Registrar: **Hostinger**. Hosting: **Vercel**. Launch model: **free and non-commercial, without advertisements or paid subscriptions**. Domain purchase and DNS are pending.

Use the root Next.js project on Vercel, Node 22, and a server runtime. Configure these in Vercel before building:

| Variable | Value/handling |
| --- | --- |
| `SCENESTACK_SITE_URL` | `https://scenestack.media` |
| `SCENESTACK_SUPPORT_EMAIL` | `scenestackcc@gmail.com` |
| `SCENESTACK_OPERATOR_NAME` | `Ikeh Joshua` |
| `SCENESTACK_SEARCH_INDEXING` | `false` pending sign-off; previews remain noindex. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Intended project's public configuration. |
| `SUPABASE_SECRET_KEY` | Server-only, where trusted operations require it. |
| `TMDB_API_TOKEN` | Server-only read access token. |
| `TMDB_API_ENABLED`, `TMDB_LICENSE_CONFIRMED`, `TMDB_PUBLIC_RELEASE_APPROVED` | Keep false in production pending permission review. All three must be true for production use. |
| `MAL_CLIENT_ID` | Server-only anime metadata client ID. |
| `MAL_API_ENABLED`, `MAL_LICENSE_CONFIRMED`, `MAL_PUBLIC_RELEASE_APPROVED` | Keep false in production until permitted usage is verified. All three are required. |
| `SCENESTACK_ENABLE_ACCOUNT_PURGE` | Leave unset/false. |

Do not upload `.env.local` or add local operator `SUPABASE_ACCESS_TOKEN` to Vercel. `TMDB_API_KEY` and `MAL_CLIENT_SECRET` are not required by these adapters. Local credential values were not changed.

After domain purchase, use the DNS records returned by the intended Vercel project. Configure Supabase Site URL to the canonical HTTPS origin and explicitly allow its `/auth/callback` including validated `next` queries. Google's redirect remains Supabase's `/auth/v1/callback`, not the frontend callback. Verify login, intended return, and sign-out on the final hostname. Use a separate staging Supabase project for untrusted previews.

The approved TMDB logo and required notice remain on Credits. Its [official FAQ](https://developer.themoviedb.org/docs/faq) describes non-commercial use/attribution but does not verify SceneStack's approval status. Review MyAnimeList's applicable terms and [API documentation](https://myanimelist.net/apiconfig/references/api/v2) before enabling it.

## Remaining bugs and launch blockers

1. Resolve/reproduce the production build configuration-parser failure on a suitable machine or CI. Require a successful build and subsequent bundle secret scan.
2. Confirm public-release provider permissions; keep both production gates closed meanwhile. MyAnimeList must remain disabled. Review existing hosted provider data before public access.
3. Complete domain purchase, Vercel DNS binding, HTTPS, and production Google OAuth configuration.
4. Pass the full component suite, production HTTP smoke suite, all nine viewport passes, touch/keyboard journeys, and actual Open Graph rendering. UI regressions remain possible without these checks.
5. Verify authenticated tracking/rating persistence, actual Storage uploads, collection create/edit/publish/save/import, follows/notifications, profile privacy, admin access, and deletion/recovery on staging and then the intended domain. Do not use irreversible deletion for sign-off.
6. Review policy text, actual processing/retention practices, and restorable database/Storage backups before collecting public user data.

The working tree was already entirely untracked at the start. Existing source and migration work was preserved. No commit, push, public deployment, or destructive database action was performed. Build and preview servers are stopped.
