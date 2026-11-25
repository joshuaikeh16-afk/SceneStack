# SceneStack

**Your entertainment. Your universe.**

A private entertainment library and community collection platform for movies, anime, series, cartoons, dramas, and documentaries. Built with Next.js 16, React 19, strict TypeScript, Supabase, TanStack Query, Radix, and dnd-kit. Geist is self-hosted; editorial SVG landscapes are original artwork.

The application includes connected title actions, collection editing and social interactions, profiles, onboarding, notifications, recommendations, settings, account lifecycle controls, and contextual administration. Catalog discovery now combines cached titles with enabled server-side providers. The hosted catalog had 377 titles at the latest schema preflight and can grow through legitimate discovery. No fictional users, ratings, or activity are seeded into the application.

**Current release recommendation: NO-GO. The website has not been deployed.** The production build, types, lint, unit/database tests, and guest HTTP smoke checks pass locally. Hosted Supabase now matches migrations 001–031; the corrected Control Center upgrade and verifier passed enforced read-only checks against the installed schema. Follow the [Control Center deployment instructions](docs/control-center-deployment.md) for the verified SQL Editor bundle or CLI procedure. Provider permission is now operator-confirmed; see [catalog expansion](docs/catalog-expansion.md). Final domain/DNS and OAuth configuration and authenticated browser sign-off remain outstanding. The [earlier backend handoff](docs/vercel-release.md) records the personal/non-commercial setup.

The planned production home is **https://scenestack.media**, operated by **Ikeh Joshua**, an independent developer. Support/privacy: **scenestackcc@gmail.com**. Launch access is free and non-commercial, without advertisements or paid subscriptions. These details have environment overrides. Public-release permission for TMDB and MyAnimeList remains unconfirmed; both production gates default closed.

## Start locally

Use Node.js 22 (pinned in `.nvmrc` and `package.json` for Vercel).

```bash
npm ci
# If .env.local does not already exist, copy .env.example to it.
# Configure the public Supabase URL and publishable key without committing .env.local.
npm run dev
```

Open http://localhost:3000. Home and title discovery are public. Personal and community areas require Google sign-in. Missing configuration or migrations produces an explicit setup state. The project uses webpack for reproducible builds in environments that restrict Turbopack worker ports.

```bash
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run db:check-types
npm run build
npm run check:secrets
npm start
```

Tests use an isolated, in-memory PostgreSQL engine (PGlite) with Auth/Storage test stubs. They cannot connect to a hosted database. Test fixtures are never application seed data. DOM tests verify dialog behavior; they are not browser end-to-end tests.

On a resource-constrained machine, run one check at a time. `npm run test:light` runs seven focused test files sequentially with a 256 MB heap cap. `npm run check:source-secrets` scans source without build output. These do not replace full release checks. The complete unit/database suite passed sequentially with a 384 MB heap cap; TypeScript used 512 MB and the isolated build used 640 MB. Keep browsers and other heavy checks stopped while these run.

## Environment

| Variable                               | Use                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project origin                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public publishable key, embedded at build time                             |
| `SUPABASE_SECRET_KEY`                  | Optional server-only `sb_secret_…` key for trusted owner/worker operations |
| `SUPABASE_ACCESS_TOKEN`                | Local operator migrations/verification only; never add to Vercel           |
| `MAL_CLIENT_ID`                        | Server-only public anime metadata client identifier                        |
| `MAL_API_ENABLED`                      | Explicit anime provider enablement, false in the example                   |
| `MAL_LICENSE_CONFIRMED`                | Explicit operator authorization, false in the example                      |
| `TMDB_API_TOKEN`                       | Server-only TMDB read access token                                         |
| `TMDB_API_ENABLED`                     | Defaults false; explicit provider enablement                               |
| `TMDB_LICENSE_CONFIRMED`               | Defaults false; operator has reviewed license and attribution requirements |
| `SCENESTACK_ENABLE_ACCOUNT_PURGE`      | Defaults false; separate explicit gate for irreversible cleanup            |
| `TMDB_PUBLIC_RELEASE_APPROVED`        | Defaults false; independent public-release gate required in production |
| `MAL_PUBLIC_RELEASE_APPROVED`         | Defaults false; keep MyAnimeList disabled in production until permitted use is verified |
| `SCENESTACK_SITE_URL`                 | Canonical HTTPS origin; defaults to `https://scenestack.media` |
| `SCENESTACK_SUPPORT_EMAIL`            | Support/privacy; defaults to `scenestackcc@gmail.com` |
| `SCENESTACK_OPERATOR_NAME`            | Operator; defaults to `Ikeh Joshua` |
| `SCENESTACK_SEARCH_INDEXING`          | Defaults false; previews always remain noindex |

Never prefix a secret with `NEXT_PUBLIC_`. Rebuild after changing public variables. `.env.local` is ignored. Do not replace an existing environment file blindly.

## Set up Google sign-in

1. Create the Google OAuth web application and configure its consent screen/test users as appropriate.
2. Enable Google in Supabase Auth and enter the Google client ID and secret **in Supabase**, not the repository.
3. Use the Supabase-provided `https://<project-ref>.supabase.co/auth/v1/callback` as Google's authorized redirect URI.
4. In Supabase URL configuration, allow the SceneStack callback `http://localhost:3000/auth/callback`, including its validated query string. Use exact HTTPS origins for production and explicit preview URLs.
5. Use the same hostname throughout sign-in; PKCE depends on the initiating browser cookies.
6. Sign in, complete onboarding, and verify the intended return action. Sign out and check that personal endpoints reject the session.

See [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-login/auth-google) and [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).

## Product and architecture

The [mobile refinement](docs/mobile-refinement.md) uses clean poster-only cards, a real featured title, cinematic detail sheets and inline private rating. Title management and recommendation feedback live inside details.

Exactly four primary destinations: Home, Discover, My Library, Profile. Settings, notifications, collection editors, creator pages, and administration are contextual. Direct title pages also support intercepted modal navigation and browser Back.

- `src/components/product`: connected screens, dialogs, title controls, shared cache, upload previews.
- `src/app/actions`: validated, authenticated mutation entry points.
- `src/app/api/data`: no-store queries, with verification and database role checks.
- `src/lib/product`: normalized view models and batched query helpers.
- `src/lib/data`: server-only database/storage/account/administration services.
- `src/lib/metadata/providers`: TMDB and MyAnimeList normalization, server-only adapters, and explicit trusted workers.
- `supabase/migrations`: additive application schema, RLS, transactional functions, storage policies, and lifecycle rules.
- `src/types/database.ts`: generated from every local migration; do not edit by hand.

Tracking, ratings, title favorites, preferences, exports, and imported/private collections remain owner-only, including against application admins. Community scores have a minimum eligible cohort of five. External provider scores never become SceneStack scores. Private image downloads use the current user's JWT on every request, rather than public or long-lived signed URLs.

Follow notifications and collection notifications originate from real database events. Save follows the original collection; import makes an independent private copy. Unpublishing revokes original access and saved references. Account deletion hides the account immediately, allows 30-day recovery with a fresh OAuth authentication, and leaves irreversible cleanup behind a separate worker gate.

## Deployment and delivery

- [Vercel release handoff and verified backend state](docs/vercel-release.md)
- [Database foundation and migration deployment](docs/database-foundation.md)
- [Prompt 04 implementation, verification, limitations, and launch checklist](docs/prompt-04-delivery.md)
- [Addendum implementation and interaction QA](docs/prompt-04-addendum.md)
- [Generated database inventory](docs/database-inventory.md)

Do not push hosted migrations or deploy production without explicit authorization. Do not use a database reset to install this project on an existing environment. Review the target schema and migration history first.
