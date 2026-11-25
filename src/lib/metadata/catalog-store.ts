import "server-only";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { providerEnabled, type CatalogProvider } from "@/config/providers";
import { DataAccessError, result } from "@/lib/data/errors";
import type { Json } from "@/types/database";
import type { DiscoveredTitle } from "./providers/discovery";
import { catalogError, reserveCatalogImport } from "./catalog-runtime";
import { tmdbDetails } from "./providers/tmdb";
import { malDetails } from "./providers/mal";
import { tmdbMediaSchema } from "./providers/tmdb-normalize";

type ProviderRecord = {
  id: string;
  key: string;
  approved: boolean;
  enabled: boolean;
};
let registry: { expires: number; records: ProviderRecord[] } | undefined;
export async function catalogProviderRecords() {
  if (registry && registry.expires > Date.now()) return registry.records;
  const client = createPrivilegedClient();
  const rows = await result(
    client.from("metadata_providers").select("id,key,approved,enabled"),
  );
  registry = { expires: Date.now() + 30_000, records: rows ?? [] };
  return registry.records;
}
export async function requireCatalogProvider(provider: CatalogProvider) {
  if (!providerEnabled(provider))
    throw new DataAccessError(
      "FORBIDDEN",
      "This catalog provider is disabled for this environment.",
    );
  const row = (await catalogProviderRecords()).find(
    (r) => r.key === provider && r.approved && r.enabled,
  );
  if (!row)
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "This catalog provider is not approved and enabled in the database.",
    );
  return row;
}
const inflight = new Map<string, Promise<string>>();
export async function persistDiscoveredTitles(
  provider: CatalogProvider,
  titles: DiscoveredTitle[],
  cutoff: string,
  search: boolean,
) {
  if (titles.length > 24)
    throw new DataAccessError(
      "INVALID_INPUT",
      "Catalog imports must be bounded to one page.",
    );
  if (!titles.length) return [];
  const row = await requireCatalogProvider(provider);
  const client = createPrivilegedClient();
  const refs = await result(
    client
      .from("provider_title_ids")
      .select("title_id,external_id,external_type")
      .eq("provider_id", row.id)
      .in(
        "external_id",
        titles.map((t) => t.externalId),
      ),
  );
  const existingIds = (refs ?? []).map((r) => r.title_id);
  const existing = existingIds.length
    ? await result(
        client.from("titles").select("id,created_at").in("id", existingIds),
      )
    : [];
  const ids: string[] = [];
  for (const title of titles) {
    const ref = refs?.find(
      (r) =>
        r.external_id === title.externalId && r.external_type === title.media,
    );
    if (ref) {
      // Titles present before this browsing snapshot are delivered by the local
      // stream. Search can discover an alias not yet present in that cache.
      if (
        search ||
        (existing ?? []).some(
          (r) => r.id === ref.title_id && r.created_at > cutoff,
        )
      )
        ids.push(ref.title_id);
      continue;
    }
    const key = `${provider}:${title.media}:${title.externalId}`;
    let task = inflight.get(key);
    if (!task) {
      task = (async () => {
        reserveCatalogImport(provider);
        const id = await result(
          client.rpc(
            provider === "tmdb" ? "ingest_tmdb_title" : "ingest_mal_title",
            { p_provider: row.id, p_payload: title as unknown as Json },
          ),
        );
        if (!id)
          throw new DataAccessError(
            "UNAVAILABLE",
            "The discovered title could not be saved. Please retry.",
          );
        return id;
      })();
      inflight.set(key, task);
    }
    try {
      ids.push(await task);
    } catch (error) {
      catalogError(
        provider,
        "canonicalization",
        error instanceof DataAccessError ? error.code : "unavailable",
      );
      throw error;
    } finally {
      inflight.delete(key);
    }
  }
  return [...new Set(ids)];
}
const hydrated = new Map<string, number>();
const hydrating = new Map<string, Promise<void>>();
// List responses are intentionally small. Fetch complete credits/aliases/media
// only when a canonical detail page is opened, retaining the summary on failure.
export async function hydrateDiscoveredTitle(id: string) {
  if (
    !process.env.SUPABASE_SECRET_KEY ||
    (!providerEnabled("tmdb") && !providerEnabled("myanimelist"))
  )
    return;
  if ((hydrated.get(id) ?? 0) > Date.now()) return;
  if (hydrating.has(id)) return hydrating.get(id);
  const task = (async () => {
    const client = createPrivilegedClient();
    const refs = await result(
      client
        .from("provider_title_ids")
        .select("provider_id,external_type,external_id")
        .eq("title_id", id)
        .limit(3),
    );
    const providers = await catalogProviderRecords();
    for (const ref of refs ?? []) {
      const p = providers.find(
        (p) => p.id === ref.provider_id && p.approved && p.enabled,
      );
      if (
        !p ||
        (p.key !== "tmdb" && p.key !== "myanimelist") ||
        !providerEnabled(p.key)
      )
        continue;
      try {
        const payload =
          p.key === "tmdb"
            ? await tmdbDetails(
                tmdbMediaSchema.parse(ref.external_type),
                ref.external_id,
              )
            : await malDetails(ref.external_id);
        await result(
          client.rpc(
            p.key === "tmdb" ? "ingest_tmdb_title" : "ingest_mal_title",
            { p_provider: p.id, p_payload: payload as unknown as Json },
          ),
        );
      } catch (error) {
        catalogError(
          p.key,
          "details",
          error instanceof DataAccessError ? error.code : "unavailable",
        );
      }
    }
    if (hydrated.size >= 128) hydrated.delete(hydrated.keys().next().value!);
    hydrated.set(id, Date.now() + 300_000);
  })();
  hydrating.set(id, task);
  try {
    await task;
  } finally {
    hydrating.delete(id);
  }
}
