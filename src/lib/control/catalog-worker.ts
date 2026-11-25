import "server-only";
import { z } from "zod";
import { providerEnabled, type CatalogProvider } from "@/config/providers";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { result, DataAccessError } from "@/lib/data/errors";
import type { Json, Row } from "@/types/database";
import {
  applicableDiscoverySources,
  discoverProviderPage,
  type DiscoverySource,
  type DiscoveredTitle,
} from "@/lib/metadata/providers/discovery";
import { productQuerySchema } from "@/lib/product/validation";
import { tmdbDetails } from "@/lib/metadata/providers/tmdb";
import { malDetails } from "@/lib/metadata/providers/mal";

const querySchema = z
  .object({
    category: z.enum([
      "movie",
      "anime",
      "series",
      "cartoon",
      "drama",
      "documentary",
    ]),
    yearStart: z.number().int().min(1888).max(2200),
    yearEnd: z.number().int().min(1888).max(2200),
    maxRecords: z.number().int().min(1).max(50000).default(5000),
    retryOf: z.uuid().optional(),
  })
  .refine((q) => q.yearStart <= q.yearEnd);
const checkpointSchema = z.object({
  year: z.number().int().min(1888).max(2201),
  month: z.number().int().min(1).max(12).default(1),
  source: z.number().int().min(0).max(2).default(0),
  page: z.number().int().min(0).max(40003).default(0),
  index: z.number().int().min(0).max(100).default(0),
  lastRef: z.uuid().nullable().default(null),
  lastFailure: z.uuid().nullable().default(null),
});
type Job = Row<"catalog_jobs">;
function enabledBulk(key: string): key is CatalogProvider {
  return (
    (key === "tmdb" || key === "myanimelist") &&
    providerEnabled(key) &&
    process.env[
      `${key === "tmdb" ? "TMDB" : "MAL"}_BULK_INGESTION_APPROVED`
    ] === "true"
  );
}
const safeCode = (error: unknown) =>
  error &&
  typeof error === "object" &&
  "code" in error &&
  /^[a-zA-Z0-9_]{1,80}$/.test(String(error.code))
    ? String(error.code)
    : "unavailable";
const trustedRow = (value: unknown) =>
  z
    .object({
      id: z.uuid(),
      provider_id: z.uuid(),
      lease_token: z.uuid(),
      checkpoint: z.unknown(),
      query: z.unknown(),
      kind: z.string(),
      processed: z.number(),
      state: z.string(),
    })
    .passthrough()
    .parse(value) as unknown as Job;
async function details(source: DiscoverySource, id: string) {
  return source === "myanimelist.anime"
    ? malDetails(id)
    : tmdbDetails(source === "tmdb.movie" ? "movie" : "tv", id);
}

// One invocation processes at most one provider page or 20 metadata records per
// provider. No loop downloads a catalog; durable continuation belongs to SQL.
export async function runCatalogCycle({
  platformTasks = true,
}: { platformTasks?: boolean } = {}) {
  const cycleStarted = Date.now();
  const client = createPrivilegedClient();
  const registered = await result(
    client
      .from("metadata_providers")
      .select("id,key,approved,enabled,bulk_approved"),
  );
  const allowed = (registered ?? []).filter(
    (row) =>
      row.approved && row.enabled && row.bulk_approved && enabledBulk(row.key),
  );
  const blocked = (registered ?? [])
    .filter((row) => !allowed.some((value) => value.id === row.id))
    .map((row) => row.key);
  const settings = await result<Pick<Row<"platform_settings">, "settings">>(
    client
      .from("platform_settings")
      .select("settings")
      .eq("singleton", true)
      .single(),
  );
  const config =
    settings?.settings &&
    typeof settings.settings === "object" &&
    !Array.isArray(settings.settings)
      ? settings.settings
      : {};
  const batch = z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .catch(10)
    .parse(config.ingestionBatchSize);
  // Queue only providers that passed both database and environment permission gates.
  if (allowed.length)
    await result(
      client.rpc("enqueue_due_catalog_jobs", {
        p_providers: allowed.map((row) => row.id),
      }),
    );
  const outcomes: unknown[] = [];
  for (const provider of allowed) {
    if (Date.now() - cycleStarted > 30000) break;
    const raw = await result(
      client.rpc("claim_catalog_job", { p_provider: provider.id }),
    );
    if (!raw) continue;
    const job = trustedRow(raw),
      lease = job.lease_token!;
    const started = Date.now();
    try {
      const q = querySchema.parse(job.query);
      const checkpoint = checkpointSchema.parse({
        ...{ year: q.yearStart },
        ...(job.checkpoint &&
        typeof job.checkpoint === "object" &&
        !Array.isArray(job.checkpoint)
          ? job.checkpoint
          : {}),
      });
      let handled = 0,
        done = false;
      const ingest = async (
        source: DiscoverySource,
        payload: DiscoveredTitle,
        full = false,
      ) => {
        return result(
          client.rpc("ingest_catalog_job_title", {
            p_job: job.id,
            p_lease: lease,
            p_source: source,
            p_payload: payload as unknown as Json,
            p_full: full,
          }),
        );
      };
      const recordFailure = async (
        source: DiscoverySource,
        external: string,
        error: unknown,
      ) => {
        // Transport/rate/lease failures stop the batch; item validation failures
        // receive a recoverable record and do not block the remaining page.
        const code = safeCode(error);
        if (
          [
            "RATE_LIMITED",
            "rate_limited",
            "timeout",
            "unavailable",
            "CONFLICT",
            "FORBIDDEN",
            "SETUP_REQUIRED",
          ].includes(code)
        )
          throw error;
        await result(
          client.rpc("record_catalog_job_failure", {
            p_job: job.id,
            p_lease: lease,
            p_source: source,
            p_external: external,
            p_code: code,
          }),
        );
      };
      if (q.retryOf) {
        let read = client
          .from("catalog_job_failures")
          .select("id,source,external_id")
          .eq("job_id", q.retryOf)
          .is("resolved_at", null)
          .order("id")
          .limit(batch);
        if (checkpoint.lastFailure)
          read = read.gt("id", checkpoint.lastFailure);
        const failures = await result(read);
        for (const failure of failures ?? []) {
          if (Date.now() - started > 30000) break;
          const source = z
            .enum(["tmdb.movie", "tmdb.tv", "myanimelist.anime"])
            .parse(failure.source);
          try {
            await result(
              client.rpc("reserve_provider_budget", {
                p_provider: provider.id,
                p_units: 3,
              }),
            );
            const payload = await details(source, failure.external_id);
            await ingest(source, payload, true);
            await result(
              client
                .from("catalog_job_failures")
                .update({ resolved_at: new Date().toISOString() })
                .eq("id", failure.id),
            );
          } catch (error) {
            await recordFailure(source, failure.external_id, error);
          }
          checkpoint.lastFailure = failure.id;
          handled++;
        }
        done =
          (failures?.length ?? 0) < batch &&
          handled === (failures?.length ?? 0);
      } else if (job.kind === "refresh") {
        let read = client
          .from("provider_title_ids")
          .select(
            "id,external_id,external_type,titles!inner(kind,release_year)",
          )
          .eq("provider_id", provider.id)
          .eq("titles.kind", q.category)
          .gte("titles.release_year", q.yearStart)
          .lte("titles.release_year", q.yearEnd)
          .order("id")
          .limit(batch);
        if (checkpoint.lastRef) read = read.gt("id", checkpoint.lastRef);
        const references = await result(read);
        for (const reference of references ?? []) {
          if (Date.now() - started > 30000) break;
          const source: DiscoverySource =
            provider.key === "myanimelist"
              ? "myanimelist.anime"
              : reference.external_type === "movie"
                ? "tmdb.movie"
                : "tmdb.tv";
          try {
            await result(
              client.rpc("reserve_provider_budget", {
                p_provider: provider.id,
                p_units: 3,
              }),
            );
            await ingest(
              source,
              await details(source, reference.external_id),
              true,
            );
          } catch (error) {
            await recordFailure(source, reference.external_id, error);
          }
          checkpoint.lastRef = reference.id;
          handled++;
        }
        done =
          (references?.length ?? 0) < batch &&
          handled === (references?.length ?? 0);
      } else {
        const nativeQuery = productQuerySchema.parse({
          category: q.category,
          year: checkpoint.year,
        });
        const sources = applicableDiscoverySources(nativeQuery).filter(
          (source) =>
            source.startsWith(
              provider.key === "tmdb" ? "tmdb." : "myanimelist.",
            ),
        );
        if (!sources.length)
          throw new DataAccessError(
            "INVALID_INPUT",
            "This provider does not supply the selected category.",
          );
        const source = sources[checkpoint.source] ?? sources[0];
        const partitioned =
          provider.key === "tmdb" &&
          ["initial", "historical"].includes(job.kind);
        const firstDay = `${checkpoint.year}-${String(checkpoint.month).padStart(2, "0")}-01`;
        const lastDay = new Date(Date.UTC(checkpoint.year, checkpoint.month, 0))
          .toISOString()
          .slice(0, 10);
        await result(
          client.rpc("reserve_provider_budget", {
            p_provider: provider.id,
            p_units: 6,
          }),
        );
        const page = await discoverProviderPage(
          source,
          checkpoint.page || (source === "myanimelist.anime" ? 0 : 1),
          {
            ...nativeQuery,
            releaseFrom: partitioned ? firstDay : undefined,
            releaseTo: partitioned ? lastDay : undefined,
            discoveryMode: ["trending", "recent", "upcoming"].includes(job.kind)
              ? (job.kind as "trending" | "recent" | "upcoming")
              : undefined,
          },
        );
        for (let index = checkpoint.index; index < page.items.length; index++) {
          if (handled >= batch || Date.now() - started > 30000) break;
          const item = page.items[index];
          try {
            await ingest(source, item);
          } catch (error) {
            await recordFailure(source, item.externalId, error);
          }
          checkpoint.index = index + 1;
          handled++;
          if (job.processed + handled >= q.maxRecords) {
            done = true;
            break;
          }
        }
        if (!done && checkpoint.index >= page.items.length) {
          if (page.limited)
            throw Object.assign(
              new Error("This partition reached the provider page limit."),
              { code: "partition_limit" },
            );
          checkpoint.index = 0;
          if (page.next !== null) checkpoint.page = page.next;
          else {
            checkpoint.page = 0;
            checkpoint.source++;
            if (checkpoint.source >= sources.length) {
              checkpoint.source = 0;
              if (partitioned && checkpoint.month < 12) checkpoint.month++;
              else {
                checkpoint.month = 1;
                checkpoint.year++;
              }
            }
            done = checkpoint.year > q.yearEnd;
          }
        }
      }
      await result(
        client.rpc("finish_catalog_batch", {
          p_id: job.id,
          p_lease: lease,
          p_checkpoint: checkpoint as unknown as Json,
          p_counts: {},
          p_done: done,
          p_error: null,
        }),
      );
      outcomes.push({ jobId: job.id, handled, completed: done });
    } catch (error) {
      const code = safeCode(error);
      try {
        await result(
          client.rpc("finish_catalog_batch", {
            p_id: job.id,
            p_lease: lease,
            p_checkpoint: job.checkpoint,
            p_counts: {},
            p_done: false,
            p_error: code,
          }),
        );
      } catch {
        /* Paused/cancelled/expired leases are already authoritative. */
      }
      outcomes.push({ jobId: job.id, error: code });
    }
  }
  if (platformTasks) await result(client.rpc("capture_platform_metrics"));
  const delivered = platformTasks
    ? await result(client.rpc("deliver_control_announcements", { p_limit: 50 }))
    : 0;
  return {
    processedJobs: outcomes.length,
    outcomes,
    blockedProviders: blocked,
    announcementDeliveries: delivered ?? 0,
  };
}
