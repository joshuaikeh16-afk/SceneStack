import "server-only";
import { activeClient } from "@/lib/product/runtime";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { DataAccessError, result } from "./errors";
import { providerEnabled } from "@/config/providers";
import { catalogRuntimeDiagnostics } from "@/lib/metadata/catalog-runtime";

export async function catalogDiagnostics() {
  const { client, bootstrap } = await activeClient();
  if (
    !bootstrap.roles.includes("super_admin")
  )
    throw new DataAccessError("FORBIDDEN", "Super Admin access required.");
  const categories = [
    "movie",
    "anime",
    "series",
    "cartoon",
    "drama",
    "documentary",
  ] as const;
  const counts: Record<string, number> = {};
  for (const category of categories) {
    const r = await client
      .from("titles")
      .select("id", { count: "exact", head: true })
      .eq("kind", category)
      .neq("status", "merged");
    if (r.error)
      throw new DataAccessError(
        "UNAVAILABLE",
        "Catalog counts are unavailable.",
      );
    counts[category] = r.count ?? 0;
  }
  const runtime = catalogRuntimeDiagnostics();
  const privileged = process.env.SUPABASE_SECRET_KEY
    ? createPrivilegedClient()
    : null;
  const registered = privileged
    ? await result(
        privileged.from("metadata_providers").select("id,key,enabled,approved"),
      )
    : [];
  const providers = [];
  for (const key of ["tmdb", "myanimelist"] as const) {
    const row = registered?.find((r) => r.key === key);
    const sync =
      row && privileged
        ? await result(
            privileged
              .from("provider_sync_state")
              .select("last_success_at,last_error_code,state,updated_at")
              .eq("provider_id", row.id)
              .order("updated_at", { ascending: false })
              .limit(10),
          )
        : [];
    const prefix = key === "tmdb" ? "TMDB" : "MAL";
    providers.push({
      key,
      environmentEnabled: providerEnabled(key),
      credentialConfigured: Boolean(
        key === "tmdb" ? process.env.TMDB_API_TOKEN : process.env.MAL_CLIENT_ID,
      ),
      publicReleaseApproved:
        process.env[`${prefix}_PUBLIC_RELEASE_APPROVED`] === "true",
      databaseEnabled: row?.enabled ?? false,
      databaseApproved: row?.approved ?? false,
      ...runtime.providers[key],
      persistedRecentSync: sync ?? [],
    });
  }
  const queue: Record<string, number> = {};
  if (privileged)
    for (const state of [
      "pending",
      "running",
      "failed",
      "completed",
    ] as const) {
      const r = await privileged
        .from("metadata_refresh_requests")
        .select("id", { count: "exact", head: true })
        .eq("state", state);
      if (!r.error) queue[state] = r.count ?? 0;
    }
  return {
    total: Object.values(counts).reduce((a, n) => a + n, 0),
    counts,
    providers,
    synchronization: queue,
    cache: runtime.cache,
    scope: runtime.scope,
  };
}
export type CatalogDiagnostics = Awaited<ReturnType<typeof catalogDiagnostics>>;
