import "server-only";
import { providerEnabled } from "@/config/providers";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { result } from "@/lib/data/errors";
import type { Json, Row } from "@/types/database";
import { tmdbDetails, ProviderFailure } from "./tmdb";
import { tmdbMediaSchema } from "./tmdb-normalize";
async function provider() {
  if (!providerEnabled("tmdb")) throw new Error("TMDB is disabled for this environment.");
  await access(join(process.cwd(), "public/providers/tmdb.svg")).catch(() => {
    throw new Error(
      "Install TMDB’s approved attribution logo at public/providers/tmdb.svg before enabling ingestion.",
    );
  });
  const client = createPrivilegedClient();
  const row = await result<Row<"metadata_providers">>(
    client
      .from("metadata_providers")
      .select("*")
      .eq("key", "tmdb")
      .eq("approved", true)
      .eq("enabled", true)
      .single(),
  );
  if (!row)
    throw new Error("TMDB is not approved and enabled in this database.");
  return { client, row };
}
/** Trusted operator utility. Not a Server Action, HTTP endpoint, or automatic seed. */
export async function importTmdbTitle(media: unknown, id: unknown) {
  const type = tmdbMediaSchema.parse(media),
    external = z
      .string()
      .regex(/^[1-9][0-9]{0,11}$/)
      .parse(id);
  const { client, row } = await provider();
  const payload = await tmdbDetails(type, external);
  return result(
    client.rpc("ingest_tmdb_title", {
      p_provider: row.id,
      p_payload: payload as unknown as Json,
    }),
  );
}
export async function processTmdbRefreshQueue(limit = 10) {
  z.number().int().min(1).max(50).parse(limit);
  const { client, row } = await provider();
  const requests = await result(
    client.rpc("claim_provider_refreshes", {
      p_provider: row.id,
      p_limit: limit,
    }),
  );
  let processed = 0,
    failed = 0;
  for (const request of requests ?? []) {
    try {
      const reference = await result<
        Pick<Row<"provider_title_ids">, "external_type" | "external_id">
      >(
        client
          .from("provider_title_ids")
          .select("external_type,external_id")
          .eq("title_id", request.title_id)
          .eq("provider_id", row.id)
          .limit(1)
          .single(),
      );
      if (!reference) throw new ProviderFailure("not_found");
      const payload = await tmdbDetails(
        tmdbMediaSchema.parse(reference.external_type),
        reference.external_id,
      );
      await result(
        client.rpc("ingest_tmdb_title", {
          p_provider: row.id,
          p_payload: payload as unknown as Json,
        }),
      );
      await result(
        client
          .from("metadata_refresh_requests")
          .update({ state: "completed", finished_at: new Date().toISOString() })
          .eq("id", request.id),
      );
      processed++;
    } catch (error) {
      await result(
        client.rpc("record_provider_sync", {
          p_provider: row.id,
          p_title: request.title_id,
          p_success: false,
          p_error_code:
            error instanceof ProviderFailure ? error.code : "invalid_payload",
        }),
      );
      await result(
        client
          .from("metadata_refresh_requests")
          .update({ state: "failed", finished_at: new Date().toISOString() })
          .eq("id", request.id),
      );
      failed++;
    }
  }
  return { processed, failed };
}
