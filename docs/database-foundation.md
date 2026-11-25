# Database foundation and deployment guide

The configured hosted project now has all 24 reviewed migrations applied with explicit authorization. See the [release handoff](vercel-release.md) for the actual target and verification. This guide also documents the repeatable procedure for a new/staging environment. The PGlite harness recreates an **isolated memory database only**; it is not a hosted reset or a production substitute.

## Schema and access

Twenty-four ordered migrations define 56 public application tables and two non-exposed private tables. All 58 application tables have RLS. Managed `auth.users` is referenced by ID, with an additive profile initialization trigger and backfill; migrations do not insert, alter, or delete managed Auth rows. Storage uses two private buckets with file type, size, ownership, current-object, and visibility checks.

Catalog data uses stable UUIDs, provider mappings, alternative names and trigram/FTS search, normalized credits/genres/countries/languages, provenance, canonical redirects, and refresh queues. Catalog merges preserve old private references. Canonical personal state reads deduplicate those references; only a subsequent explicit owner action consolidates the owner's current record, with history retained.

Personal tables are owner-only. Super Admin, Moderator, Catalog Editor, and service-worker privileges do not automatically expose private libraries or preferences. Column grants prevent user-supplied ownership, status, permanent username, and role changes. Privileged functions pin an empty search path. Browser callers cannot bootstrap an owner, assign roles, complete provider sync, or claim an account purge.

Anonymous callers can browse catalog data, resolve canonical titles, and read anonymous community aggregates. The four non-exposed Storage policy helpers are also executable by anon solely so PostgreSQL can evaluate policies; each returns false without an active verified identity. Other private guards remain inaccessible. Public RPCs are explicitly allowlisted.

Collections have unique membership and deferrable unique positions, row locks for inserts/reordering, request IDs for idempotent create/import, independent imported copies, and creator-only interaction counts. Notifications are deduplicated, preference-aware, and checked against current block and collection access. Reports, moderation, role changes, and catalog edits are audited.

## Local validation

```bash
npm run db:validate
npm run db:check-types
npm run test:db
npm run db:inventory
```

The harness never reads `.env` and accepts no remote URL. It substitutes minimal Auth and Storage schemas, so the real Supabase Auth/Storage integration must still be tested in a disposable Supabase project.

For full local Supabase verification, install Docker and the current supported Supabase CLI, then use `npx supabase@3 start` in a disposable local development environment. These prerequisites were unavailable here. Do not substitute a hosted production project for local tests.

## Hosted migration procedure — manual and permission-gated

Nothing in build, dev, tests, or startup applies migrations. Before any hosted write:

1. Obtain explicit approval for the exact target project and migration set.
2. Take a restorable backup and inspect existing public tables, functions, extensions, triggers, policies, buckets, and migration history. Resolve name/history conflicts; do not mark unknown migrations as applied or drop user data.
3. Confirm the project has the normal Supabase roles, Auth/Storage schemas, and support for `pg_trgm`. The migration places that extension in `extensions` and grants schema usage for search. Inspect an existing extension's schema before applying.
4. Apply and verify the full set first in a disposable Supabase staging project with two ordinary accounts and one role-scoped administrator. Check Storage API operations with actual user JWTs.
5. Review the remote dry run using the CLI version's explicit remote target syntax. For Supabase CLI v3:

```bash
npx supabase@3 db push --dry-run --remote=<project-ref>
```

Only after reviewing its exact output and receiving approval for that target:

```bash
npx supabase@3 db push --remote=<project-ref>
```

Use the CLI's secure authentication/credential flow. Never paste credentials into committed scripts. Confirm syntax against the installed CLI's `--help`; do not run destructive reset/repair commands to resolve a mismatch. CLI v3 defaults to local commands and uses an explicit remote selector; see the [official CLI reference](https://supabase.com/docs/reference/cli/introduction).

6. Validate the applied RLS/grants, exact private bucket restrictions, profile backfill, new-user initialization, all public RPCs, and API schema reload. Regenerate remote types and compare them to local types before deployment.
7. Run the manual A–I browser matrix in the delivery report. Keep production traffic disabled until it passes. A forward correction migration is preferable to a data-destructive rollback.

## Secure owner initialization

Choose the verified Auth UUID of the real platform owner. In a trusted operator environment using the server-only secret, invoke `bootstrap_platform_owner(owner_uuid)` once. This establishes the immutable owner identity and the first Super Admin role. Do not infer ownership from an email, domain, OAuth metadata, or the first website visitor.

Subsequent `manage_admin_role(actor_uuid,target_uuid,role,grant)` and ownership transfers are service-only functions that independently verify the existing platform owner. The application derives `actor_uuid` from a freshly verified user and passes it only from server code. The contextual role form is not an alternative bootstrap method. Do not put a secret in browser code or SQL examples committed with credentials.

## TMDB activation

The TMDB and MyAnimeList providers were authorized for personal/non-commercial use and populated in the configured project. The following gates still apply when setting up another environment.

1. Review the [TMDB license and attribution requirements](https://developer.themoviedb.org/docs/faq), including commercial use where applicable.
2. Obtain a real server token and an unmodified [approved TMDB logo](https://www.themoviedb.org/about/logos-attribution). Save the logo at `public/providers/tmdb.svg`; the worker checks for it and Credits displays it.
3. Configure the server token and explicitly set both `TMDB_API_ENABLED=true` and `TMDB_LICENSE_CONFIRMED=true` only after review.
4. In the trusted operator environment, register the provider with key `tmdb`, the correct terms/attribution text, and explicit `approved=true, enabled=true`. This is an operator write, not a seed automatically run by the app. The ingest RPC checks this approval again.
5. Review the worker's target environment and dry run:

```bash
node --conditions=react-server --env-file=.env.local --import tsx scripts/catalog-worker.ts
```

After explicit permission to populate that database, import an operator-reviewed provider ID or process queued refresh requests:

```bash
node --conditions=react-server --env-file=.env.local --import tsx scripts/catalog-worker.ts --import movie <tmdb-id> --execute
node --conditions=react-server --env-file=.env.local --import tsx scripts/catalog-worker.ts --queue --execute
```

Explicit imports were executed for the approved launch catalog; queue processing and irreversible jobs were not run. The adapter supports search, appended details/credits/videos/aliases/recommendations, bounded retries, timeouts, and allowlisted media URLs. The transactional cache prevents duplicate provider mappings and protects editorial field overrides. Failed refreshes retain the existing cache and record sanitized failure codes. Related recommendations are linked only when their canonical titles already exist. There is no scraping, external-rating substitution, or automatic import of unreviewed search results.

Japanese animation is refused by the TMDB ingestion path. The separate MyAnimeList adapter and `ingest_mal_title` service-only RPC now handle anime with stable IDs, studio metadata, strict artwork validation and editorial protections. The approved launch includes seven real anime works. MAL public requests use `X-MAL-CLIENT-ID`; no MAL OAuth secret, user list or provider score is imported. Set `MAL_API_ENABLED=true`, `MAL_LICENSE_CONFIRMED=true`, and `MAL_CLIENT_ID` in the trusted worker environment, and register the approved/enabled provider key `myanimelist`. Use `npm run catalog:worker -- --import anime <mal-id> --execute`, or `--queue --mal --execute`. AniList is not used. No paid AI service is required.

## Account lifecycle jobs

`src/lib/data/jobs.ts` provides trusted suspension release and account purge utilities. No scheduler is installed. Account purge defaults to dry run and additionally requires `execute:true`, `SCENESTACK_ENABLE_ACCOUNT_PURGE=true`, an elapsed 30-day recovery deadline, and the database claim. Cleanup uses Supabase Storage/Auth APIs, not SQL deletion of managed Auth tables. Do not enable it until the full storage removal, Auth deletion, owner exclusion, retry, and recovery behavior is verified in staging.

Recovery requires an OAuth AMR timestamp after the deletion request and within five minutes; a refreshed JWT `iat` alone is insufficient. Verify the real provider's AMR claims during staging tests. Storage uploads followed by metadata updates span two services; failed finalization can leave owner-only orphan files that require an operator-reviewed cleanup policy. Existing registered media is retained on failure.

## Addendum data and operations

Recent searches are opt-in and limited to eight submitted queries. Recently viewed stores up to 40 canonical title IDs and timestamps. Both are owner-only, denied to application admins and direct service-role reads, included only in the owner’s export, and cleared on opt-out. Configure a trusted daily call to `expireDiscoveryHistory()` for 30/90-day expiry; reads exclude expired entries and new writes prune the owner’s old rows. No maintenance scheduler has been activated here.

Profile cover files share the private avatar bucket’s 3 MiB restrictions and current-object/block checks. Featured collections must be owned, published, and available; unpublishing/removal clears the feature. No arbitrary profile HTML is rendered.

Collections now carry versions and publication timestamps. Version-checked text, note, reorder, and explicit saved-sort operations reject concurrent stale writes. Query-only sorting/filtering leaves the stored order unchanged. Text autosaves are debounced; cover/spoiler changes require explicit Save Changes. Unfinished drafts, including selected files, are held only in the current user’s in-memory cache and cleared on account change or explicit discard. They are never written to persistent browser storage or the offline cache. Closing/reloading the browser can still discard memory after its native warning; verify these interactions in supported browsers.

Provider queues now lease eligible work with `FOR UPDATE SKIP LOCKED`, respect retry deadlines, recover expired leases, and avoid retrying old failures ahead of a newer pending request. Public freshness exposes only last-success time and a stale flag. Catalog relationships are displayed only after explicit editor verification; similarity recommendations do not automatically establish franchise/sequel relationships or merge works.

The PWA caches static offline assets and at most 20 public title metadata snapshots, never authenticated app HTML, RSC responses, private APIs, account images, or mutations. Public snapshots require `metadata_providers.allow_offline_cache=true` for every supplying provider, with the provider approved and enabled. Review the actual license’s offline rights before setting that operator-only flag. Snapshots expire after seven days and are cleared on sign-out/account switch. Actual installation, navigation fallback, and service-worker updates still require real browser/HTTPS verification.

## Vercel upload transport

Collection covers use authenticated direct Storage upload followed by server validation of the stored object. This keeps 8 MiB covers out of Vercel’s default function request-body limit. Private asset responses stream with current-user authorization and no-store headers; avatar/profile-cover requests remain under 3 MiB. See the release handoff for the remaining real-browser upload checks.
