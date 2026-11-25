import "server-only";
import { cache } from "react";
import { providerEnabled } from "@/config/providers";
import { createClient } from "@/lib/supabase/server";
import { result } from "@/lib/data/errors";

const allowedProviders = cache(async () => {
  const client = await createClient();
  if (process.env.NODE_ENV !== "production") return null;
  if (!client) return new Set<string>();
  const providers = await result(
    client.from("metadata_providers").select("id,key"),
  );
  return new Set(
    (providers ?? [])
      .filter(
        (p) =>
          (p.key === "tmdb" || p.key === "myanimelist") &&
          providerEnabled(p.key),
      )
      .map((p) => p.id),
  );
});

// Bound every provenance read to the current page, including canonical merges.
export async function restrictedTitleIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const allowed = await allowedProviders();
  if (allowed === null) return new Set<string>();
  const client = await createClient();
  if (!client) return new Set(ids);
  const rows = await result(
    client
      .from("provider_title_ids")
      .select("title_id,provider_id")
      .in("title_id", ids),
  );
  // Attribution RLS hides unapproved registry rows. Unknown references must fail
  // closed as well, without granting guests access to protected provider flags.
  return new Set(
    (rows ?? [])
      .filter((row) => !allowed.has(row.provider_id))
      .map((row) => row.title_id),
  );
}
