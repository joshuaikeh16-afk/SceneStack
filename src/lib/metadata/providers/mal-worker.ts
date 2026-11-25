import "server-only";
import { providerEnabled } from "@/config/providers";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { result } from "@/lib/data/errors";
import type { Json, Row } from "@/types/database";
import { malDetails } from "./mal";
import { ProviderFailure } from "./tmdb";

async function provider() {
  if (!providerEnabled("myanimelist")) throw new Error("MyAnimeList is disabled for this environment.");
  const client = createPrivilegedClient();
  const row = await result<Row<"metadata_providers">>(
    client
      .from("metadata_providers")
      .select("*")
      .eq("key", "myanimelist")
      .eq("approved", true)
      .eq("enabled", true)
      .single(),
  );
  if (!row)
    throw new Error(
      "MyAnimeList is not approved and enabled in this database.",
    );
  return { client, row };
}
export async function importMalTitle(id: unknown) {
  const external = z
    .string()
    .regex(/^[1-9][0-9]{0,11}$/)
    .parse(id);
  const { client, row } = await provider();
  const payload = await malDetails(external);
  return result(
    client.rpc("ingest_mal_title", {
      p_provider: row.id,
      p_payload: payload as unknown as Json,
    }),
  );
}
export async function processMalRefreshQueue(limit = 10) {
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
  for (const item of requests ?? []) {
    try {
      const ref = await result<Pick<Row<"provider_title_ids">, "external_id">>(
        client
          .from("provider_title_ids")
          .select("external_id")
          .eq("title_id", item.title_id)
          .eq("provider_id", row.id)
          .eq("external_type", "anime")
          .single(),
      );
      if (!ref) throw new ProviderFailure("not_found");
      const payload = await malDetails(ref.external_id);
      await result(
        client.rpc("ingest_mal_title", {
          p_provider: row.id,
          p_payload: payload as unknown as Json,
        }),
      );
      await result(
        client
          .from("metadata_refresh_requests")
          .update({ state: "completed", finished_at: new Date().toISOString() })
          .eq("id", item.id),
      );
      processed++;
    } catch (e) {
      await result(
        client.rpc("record_provider_sync", {
          p_provider: row.id,
          p_title: item.title_id,
          p_success: false,
          p_error_code:
            e instanceof ProviderFailure ? e.code : "invalid_payload",
        }),
      );
      await result(
        client
          .from("metadata_refresh_requests")
          .update({ state: "failed", finished_at: new Date().toISOString() })
          .eq("id", item.id),
      );
      failed++;
    }
  }
  return { processed, failed };
}
