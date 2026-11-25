**Current configuration update (25 November 2026):** Operator confirmed both provider permissions; use the [catalog expansion instructions](catalog-expansion.md). The disabled-provider values in this earlier handoff are superseded by that runbook.

# SceneStack release handoff

**25 November update:** Public-release permissions remain unconfirmed for both providers. Final domain/DNS and production Google OAuth are not verified for `https://scenestack.media`. The latest local build, types, lint, unit/database suites, secret scan and guest HTTP checks pass. The seven Control Center migrations are not hosted yet; follow the [tested deployment procedure](control-center-deployment.md). Authenticated browser sign-off remains outstanding. This earlier handoff's provider approvals apply only to its stated personal/non-commercial setup.

Prepared 23 November 2026. **The backend is installed; the website has not been deployed to Vercel.** The user authorized hosted migrations and Vercel preparation, and confirmed personal/non-commercial provider use. No production website deployment was authorized or performed.

## Completed

- Applied all 24 migrations to the configured SceneStack project `zyghuvjvelozjprdfula` with Supabase CLI 3.3.0 after reviewing its dry run and empty application schema. No reset, migration repair, role seed, or fictional social data was used.
- Preserved the existing verified Google account; initialized its profile. With explicit approval, assigned that account as platform owner and first Super Admin through the audited bootstrap RPC.
- Compared the hosted schema against the isolated reviewed migrations: all 58 tables, column definitions/access, 112 function signatures/bodies/role permissions, 94 policy definitions and effective table grants match. Verified private avatar (3 MiB) / collection-cover (8 MiB) buckets with JPEG, PNG, and WebP restrictions.
- Verified both provider credentials with live, read-only API calls. Registered TMDB and MyAnimeList as approved/enabled for the stated use. Installed TMDB’s unmodified official logo and attribution.
- Imported 27 real canonical titles: 4 movies, 4 series, 4 cartoons, 4 dramas, 4 documentaries and 7 anime. Metadata, artwork and studio/credit information come from providers. No users, libraries, votes, collections, followers or notifications were invented.
- Left provider offline-copy permissions disabled. No irreversible account cleanup or scheduled jobs were enabled.
- Added Vercel configuration, Node 22 engine pin, secret exclusions and GitHub CI. Removed server credentials accidentally entered in the committable environment example; `.env.local` retains the working values and is ignored.
- Collection covers upload directly to private Supabase Storage using the verified user's session and existing RLS, followed by an authenticated server check of ownership, stored size, MIME and file signature. This supports the existing 8 MiB limit without paid large-body function features. Private image responses stream through the authenticated no-store asset endpoint. Profile image requests remain within 3 MiB.

The project initially had one Auth account and zero public application objects, Storage buckets or stored files. The free project reported no downloadable backup/PITR. No managed Auth row or existing stored file was changed. The counts-only preflight inventory is in ignored `.release/pre-migration-inventory.json`. Configure restorable database and Storage backups before collecting production user data; Storage objects are separate from database backups.

## Vercel setup

Use this repository’s root, Next.js framework preset and Node 22. `vercel.json` supplies `npm ci` and `npm run build`; keep Next.js’s detected output directory. This application needs a server runtime and cannot be hosted as a static export.

Add these variables in the intended Vercel environment before its build. Enter values directly through Vercel’s secure environment settings; never upload `.env.local`, commit credentials, or put secrets in `vercel.json`.

| Variable                               | Purpose                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Existing configured project origin                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing public publishable key; embedded at build time                   |
| `SUPABASE_SECRET_KEY`                  | Server-only trusted owner administration                                  |
| `TMDB_API_TOKEN`                       | Server-only metadata access, if running the approved provider integration |
| `TMDB_API_ENABLED=false`               | Keep disabled pending public-release permission review                     |
| `TMDB_LICENSE_CONFIRMED=false`         | Do not infer permission from credentials                                  |
| `TMDB_PUBLIC_RELEASE_APPROVED=false`   | Independent production redistribution gate                                |
| `MAL_CLIENT_ID`                        | Server-only public anime metadata client identifier                       |
| `MAL_API_ENABLED=false`                | MyAnimeList remains disabled for public release                            |
| `MAL_LICENSE_CONFIRMED=false`          | Permitted public usage has not been confirmed                             |
| `MAL_PUBLIC_RELEASE_APPROVED=false`    | Independent production redistribution gate                                |
| `SCENESTACK_SITE_URL`                  | `https://scenestack.media`                                                 |
| `SCENESTACK_SUPPORT_EMAIL`             | `scenestackcc@gmail.com`                                                   |
| `SCENESTACK_OPERATOR_NAME`             | `Ikeh Joshua`                                                             |
| `SCENESTACK_SEARCH_INDEXING=false`     | Keep noindex until sign-off                                               |

`SUPABASE_ACCESS_TOKEN` is a local operator credential and must **not** be added to Vercel. `TMDB_API_KEY` is unnecessary because the adapter uses the read access token. `MAL_CLIENT_SECRET` is unnecessary: SceneStack uses public MAL catalog endpoints and Google sign-in. Leave `SCENESTACK_ENABLE_ACCOUNT_PURGE` unset/false. Do not reuse production database credentials in untrusted pull-request previews; use a separate staging Supabase project and its own public keys for preview builds.

No Vercel project, token, or project ID is configured in this checkout. The planned domain is now `https://scenestack.media`; purchase and DNS are pending. Source has not been committed or pushed by this session. After code review and the remaining browser sign-off, publish the source to the intended Git repository or use Vercel’s CLI from this checkout, configure the environment, and obtain production deployment authorization. Build/start never applies database migrations or imports catalog data.

## Google callback after choosing the domain

Google is already enabled in Supabase. Its Site URL and allowlist currently use localhost. Before public login, set the Site URL to the exact chosen HTTPS production origin and add that origin’s `/auth/callback` (including the app’s validated `next` query) to the Supabase redirect allowlist. Add only specific preview/development origins that you intend to use. Avoid a global `*.vercel.app` allowlist.

Google’s authorized redirect remains the Supabase-provided `https://<project-ref>.supabase.co/auth/v1/callback`. Do not substitute the SceneStack frontend callback in the Google console. Keep Google’s client secret in Supabase Auth, never in frontend source. Use one hostname throughout PKCE login.

The existing owner must complete onboarding if still prompted. Administration appears contextually based on database roles; it is not a fifth primary navigation item. Owner identity is never inferred from an email, OAuth metadata, or the next visitor.

## Verification and final sign-off

Local lint, strict types, unit/DOM tests, isolated SQL tests, migration validation/type drift and production builds passed. The production-dependency audit reported zero known vulnerabilities. A final CLI preview confirms the hosted database is up to date with no pending migrations. The suites contain 27 unit/component/DOM scenarios and 50 SQL scenarios. The production HTTP smoke checks passed 50 routes/assets. Live app checks loaded every category, canonical title pages, real artwork references, no invented community ratings, and provider-denied public offline snapshots.

No browser surface is available in this session. Live Google login/return, actual private uploads, touch/keyboard layouts, two-tab conflict behavior, PWA installation/offline navigation and screenshots remain unverified. Execute the device and A–I journey matrices in the delivery/addendum reports against the intended deployment before public traffic. Transport-mocked upload tests prove the file avoids the server-action body; they do not prove a real Storage upload in a browser.

Useful operator commands (all read-only or dry-run by default):

```bash
npm run db:preview
node scripts/verify-hosted-db.mjs
npm run catalog:worker
node --conditions=react-server --env-file=.env.local --import tsx scripts/launch-catalog.ts
npm run check:secrets
```

The launch catalog utility’s explicit `--execute` mode registers the approved providers and imports reviewed actual works idempotently. It does not create social activity. Individual refresh/import execution is also explicit; see the database guide. History-retention, refresh and account-lifecycle schedules are not installed. Keep irreversible cleanup disabled until its staging sign-off.

References: [Vercel Next.js hosting](https://vercel.com/docs/frameworks/full-stack/nextjs), [environment variables](https://vercel.com/docs/environment-variables), [function request/response limits](https://vercel.com/docs/functions/limitations), [Supabase CLI](https://supabase.com/docs/reference/cli/introduction), [TMDB attribution](https://www.themoviedb.org/about/logos-attribution), [MAL API reference](https://myanimelist.net/apiconfig/references/api/v2).

The latest [mobile refinement](mobile-refinement.md) moves title controls into cinematic detail surfaces and updates the browser sign-off matrix.
