# Control Center database deployment and corrected verification

**Update:** The operator subsequently confirmed public-release and bulk-use permission. Both hosted bulk gates are now enabled and six resumable jobs are queued; see [catalog expansion](catalog-expansion.md) for measured results and continuation. Earlier pending-permission statements below describe the state before that confirmation.

Verified 25 November 2026 against **SceneStack — `zyghuvjvelozjprdfula`**, PostgreSQL 17.12. The latest hosted inspection finds **all migrations 001–031 installed**, no unknown migration versions, and no differences in the compared schema, function bodies/signatures, RLS policies, grants, constraints, indexes or triggers. The original active owner remains the sole Super Admin; no moderators are assigned. Do not bootstrap or regrant the owner.

Both corrected SQL files passed against the actual hosted database with Management API **read-only enforcement**. The completed-installation upgrade path performs verification without replaying DDL, inserting history or changing data/roles. No permanent hosted changes were made by this repair. Authenticated application browser access still needs verification.

## Why the original snapshot failed

The previous bundle created `control_preservation_before` at line 27 using `CREATE TEMPORARY TABLE ... ON COMMIT DROP AS SELECT pg_temp.control_preservation() snapshot`. Its final, separate `DO` block referenced that relation. It was a session-local temporary table, not a CTE. The source migrations' outer BEGIN/COMMIT statements were removed when assembling the bundle; inspection found no intervening top-level COMMIT in the intended complete script.

A temporary table with `ON COMMIT DROP` is dropped at transaction commit and cannot be used by a later verification transaction or another session. See [PostgreSQL temporary-table lifetime](https://www.postgresql.org/docs/17/sql-createtable.html). A local regression reproduces the exact 42P01 error after commit; a hosted temporary-only transaction probe also confirmed the relation works within one transaction and was rolled back.

The reported error establishes that the snapshot relation was unavailable to that verification execution. SQL Editor execution history is not observable here, so an automatic commit, selected fragment or changed connection cannot be identified as the proven trigger. The hosted migration history and matching installed schema show that the seven migrations are now committed. The error does not establish that your database still needs them.

The corrected bundle eliminates the fragile dependency: one `DO` statement stores before/after fingerprints in local JSONB variables. It contains no temporary preservation table, helper function or separate verification transaction. Fingerprint comparisons, owner checks, history registration and missing migrations remain atomic. A failure rolls back all changes made by that statement; preservation checks have not been bypassed.

## SQL Editor execution instructions

1. Open project **`zyghuvjvelozjprdfula` → SQL Editor → New query**, using database role **postgres**. If a previous explicit transaction is still aborted, run `ROLLBACK;` separately first.
2. Copy the **entire current** [control-center-upgrade.sql](../supabase/deployment/control-center-upgrade.sql) into the query and run it. It is a complete single SQL statement. Do not combine it with the old bundle or run selected inner migration bodies.
3. On your already-installed database, expect **Success. No rows returned**. If notices are shown, expect `Control Center 025–031 already installed: schema, RLS, grants, owner and team constraints verified. No migrations replayed.` This result is normal because DO returns no result rows.
4. Run the entire [control-center-verify.sql](../supabase/deployment/control-center-verify.sql) in a separate query. It is self-contained and repeatable. Its opening assertions verify schema/RLS/grants, the original owner and team capacity; the following queries show migration history, permissions and record counts. Some interfaces show only the final result set: select individual numbered read-only queries when inspecting their output.
5. Sign in to SceneStack with the **existing owner's Google account**. Open `/api/control/identity`, then `/admin`. Expect `role: "super_admin"` from the authenticated endpoint. SQL Editor has no application JWT, so calling `control_identity()` there can correctly return NULL.

For an exactly matching tracked prefix from 024 through 030, the same script applies only the missing suffix in dependency order. It rejects gaps, unknown versions, schema drift and untracked partial objects. It locks migration history and seven existing data tables before capturing preservation fingerprints. Changes to original profile fields, titles, collections, tracking, ratings, favorites or collection items abort the entire statement. New profile verification fields are excluded from the original-profile fingerprint. The original active owner, sole-Super-Admin index and serialized five occupied/reserved moderator-seat constraints remain enforced.

A complete matching installation is safe to rerun, including in a new read-only transaction with an empty initial search path. Schema deparsing uses a fixed search path so SQL Editor connection defaults do not change the comparison. A lock timeout or drift error means stop and inspect the complete error; never remove the checks or mark unapplied migrations as successful.

## Exact source order

| Order | SQL file                                                                                                          | Purpose                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [202611250025_control_center_team.sql](../supabase/migrations/202611250025_control_center_team.sql)               | Owner preservation, two assignable roles, serialized five-seat moderator capacity, invitations, access suspension/removal, audit fields.     |
| 2     | [202611250026_control_cases_enforcement.sql](../supabase/migrations/202611250026_control_cases_enforcement.sql)   | Existing submission backfill, private case conversations, reports, support, appeals, notifications, enforcement and feature restrictions.    |
| 3     | [202611250027_control_operations.sql](../supabase/migrations/202611250027_control_operations.sql)                 | Settings, publication records, metadata revisions/locks, durable catalog jobs, schedules and conservative provider budgets.                  |
| 4     | [202611250028_control_catalog_management.sql](../supabase/migrations/202611250028_control_catalog_management.sql) | Metadata editing/rollback, correction field decisions, canonical merge/split, public collection moderation and sensitive profile operations. |
| 5     | [202611250029_control_workspaces.sql](../supabase/migrations/202611250029_control_workspaces.sql)                 | Authorized dashboard queries, administrative search, user investigations, measured diagnostics and review-only content flags.                |
| 6     | [202611250030_control_completion.sql](../supabase/migrations/202611250030_control_completion.sql)                 | Private staff notes, account restoration, appeal resolution, failed-item retry, essential data rights and bounded announcement delivery.     |
| 7     | [202611250031_catalog_batch_integrity.sql](../supabase/migrations/202611250031_catalog_batch_integrity.sql)       | Lease-checked, idempotent per-title ingestion progress and safe failure audit records.                                                       |

Dependencies require this order. The original 001–024 files remain unchanged. The old `catalog_editor` enum label remains for stored-function compatibility, but a database check prevents assigning it; the effective product roles are Super Admin and Moderator.

## CLI status and reproducibility

No CLI migration execution is needed for this project: versions 001–031 are installed. A fresh read-only preflight can be run with `node --max-old-space-size=256 scripts/control-center-preflight.mjs`. `npm run db:preview` must show no pending migrations. Do not reset, repair history or replay source files.

The bundle generator is `node --max-old-space-size=256 scripts/build-control-upgrade.mjs`; it requires a clean hosted preflight and generates stage fingerprints from isolated source migrations. `control-center-manifest.json` records source hashes, schema fingerprints and the complete bundle SHA256. `node --max-old-space-size=192 scripts/verify-control-upgrade.mjs` validates both files using enforced read-only hosted requests and saves a secret-free report under `.release/`.

## Bulk catalog permission

`bulk_approved` was introduced by migration 027 with a default of false. It is a SceneStack operator confirmation, not a provider API response, subscription tier or catalog-size limit. Existing `approved`/`enabled` values do not establish permission for the intended public release or large-scale persistent ingestion.

The worker requires both database flags and server environment gates, including the relevant `TMDB_BULK_INGESTION_APPROVED` or `MAL_BULK_INGESTION_APPROVED`. Production also requires the provider's API/license/public-release gates. These remain closed according to the operator's instruction until permitted use is verified. TMDB's official FAQ generally permits non-commercial API use with required attribution; this does not by itself document the operator's review of the planned bulk storage. See [TMDB FAQ](https://developer.themoviedb.org/docs/faq). MyAnimeList remains disabled for production pending verification.

Catalog jobs support a maximum of 50,000 records per job, bounded batches and durable checkpoints. This is not a guarantee of 50,000 distinct eligible titles: category overlap, source availability and deduplication affect totals. Global discovery/search can retrieve uncached titles from enabled permitted sources without preloading 50,000 records. Bulk jobs additionally need the scheduled worker configured and monitored; merely changing a flag does not import titles.

## Configuration and remaining checks

Local verification passed: strict TypeScript, ESLint, 16 unit/component test files, seven isolated database test files, the production build, client/source secret scanning, and 58 guest HTTP route/asset checks. The SQL Editor bundle was executed in isolated PostgreSQL over the populated 024 baseline, preserved existing owner/library records, registered all seven versions, and loaded every administration workspace query. Team tests cover the sole owner, five occupied/reserved seats, expired/cancelled invitations, and immediate access revocation. Additional repair tests cover temporary-table lifetime, full upgrade preservation, forced-failure rollback of DDL/data/history, tracked-prefix resumption, read-only reruns, non-contiguous history and RLS drift rejection. Both corrected scripts also passed read-only against hosted PostgreSQL 17.12. Authenticated browser journeys remain unverified.

- Local `NEXT_PUBLIC_SUPABASE_URL`, publishable key, server secret key, and local operator token are configured. The URL targets the project inspected above. Supabase Auth health, Google provider settings, and server-key database access returned HTTP 200; Google sign-in is enabled. No secret values were printed or changed.
- `/admin` requires an Auth-verified Google session and a fresh database role check. Missing/expired cookies require normal sign-in; an ordinary member must receive access denied. Do not use editable Google user metadata or a client-side role to authorize administration.
- A stale API schema can cause `PGRST202` after successful SQL deployment. The bundle requests a reload; if needed, run `NOTIFY pgrst, 'reload schema';` and retry after a few seconds. See [Supabase's schema reload instructions](https://supabase.com/kb/troubleshooting/refresh-postgrest-schema).
- If using Vercel, its environment must point to this same Supabase project and include the intended public keys/server secret. Restart/redeploy the application after changing its environment variables. A local `.env.local` file does not configure Vercel.
- `SCENESTACK_JOBS_ENABLED` and `CRON_SECRET` are unset locally. That disables scheduled jobs; it does **not** prevent the administration workspace from loading. No scheduler has been installed by this work.
- TMDB/MyAnimeList public-release and bulk-use permissions remain unconfirmed. Their production permission gates must remain closed. Missing provider permissions do **not** prevent administrative access, and this upgrade does not grant approval or bulk-import a catalog.
- Domain purchase/DNS, the final production OAuth callback, and authenticated browser verification remain separate launch steps. Database deployment alone is not public-release sign-off.

The deployment artifacts contain no API secrets, replacement owner grants, user seeds, or fabricated catalog records. The current Control Center implementation remains subject to its application and authenticated browser checks; this document does not claim all overhaul features have passed production QA.
