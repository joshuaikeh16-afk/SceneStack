# Catalog expansion — operator permission confirmed

On 25 November 2026 the operator confirmed provider permission after discussion of both TMDB and MyAnimeList public release and bulk use. Both existing hosted provider registrations now have approved/enabled/bulk_approved=true. Original owner, RLS and schema remain unchanged. Two permission audit events and six bounded launch jobs were created atomically; repeating the SQL does not duplicate jobs.

Local server gates for both providers and SCENESTACK_JOBS_ENABLED are enabled in .env.local. A server-only CRON_SECRET was configured without printing it. Existing credentials were retained. Environment examples remain disabled by default.

Live read-only verification passed two distinct pages for movies, anime, series, cartoons (movie and TV), dramas and documentaries (movie and TV). Movie search found 8 uncached results; anime search found 20. Report: .release/confirmed-provider-verification.json. The initial hosted canonical count was 377. A six-cycle import started successfully with real canonical inserts and durable checkpoints; logs: .release/catalog-launch-worker.log. The final summary will be saved to .release/catalog-job-run.json when that finite run finishes.

After that initial run completes, continue in a separate terminal from the repository root:

```bash
npm run catalog:jobs -- --execute --cycles=120 --interval-ms=15000 --target=50000
```

Each execution is finite, uses a 256 MB Node heap cap, and performs up to 120 cycles with at least 15 seconds between cycles. It stops early if the catalog reaches the target or no job is currently claimable. Paused/backoff jobs retain checkpoints; inspect Control Center diagnostics before rerunning after failures. Ctrl+C allows the current bounded batch to finish. Logs report job IDs and counts, never credentials. No full provider catalog is loaded in memory or sent to the browser. Existing worker defaults are 10 records per provider per cycle. Reaching 50,000 unique stored titles requires continued runs; the initial batch is not a 50,000-title completion claim. Job caps count processed records, so duplicates affect net growth. The CLI target is checked between cycles, not as a global database storage constraint.

For Vercel, copy the existing server credentials securely and set TMDB_API_ENABLED, TMDB_LICENSE_CONFIRMED, TMDB_PUBLIC_RELEASE_APPROVED, TMDB_BULK_INGESTION_APPROVED, MAL_API_ENABLED, MAL_LICENSE_CONFIRMED, MAL_PUBLIC_RELEASE_APPROVED, MAL_BULK_INGESTION_APPROVED and SCENESTACK_JOBS_ENABLED to true. Configure a random server-only CRON_SECRET of at least 32 characters. Local .env.local changes do not configure Vercel. Restart the existing local dev server to apply changed environment values.

No Vercel scheduler or public deployment was performed. For unattended hosting, configure an authorized scheduler to call GET /api/jobs/catalog with Authorization: Bearer <CRON_SECRET> at the interval supported by the hosting plan. One call processes a small bounded cycle. Keep credentials out of URLs and client code. A scheduler that runs only once a day will not reach the catalog target quickly. Provider attribution remains in /credits; no manga, manhwa or manhua ingestion was introduced.

Local TypeScript, focused ESLint and the isolated SQL permission/idempotence/RLS-preservation test passed. No production build or browser QA was repeated for this permission/configuration change and accompanying small explanatory copy updates.
