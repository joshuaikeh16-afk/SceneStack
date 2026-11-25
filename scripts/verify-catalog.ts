import "server-only";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { providerEnabled } from "../src/config/providers";
import { productQuerySchema } from "../src/lib/product/validation";
import {
  applicableDiscoverySources,
  discoverProviderPage,
} from "../src/lib/metadata/providers/discovery";
import { createPrivilegedClient } from "../src/lib/supabase/admin";
import { persistDiscoveredTitles } from "../src/lib/metadata/catalog-store";

async function main() {
  const client = createPrivilegedClient();
  const report: unknown[] = [];
  const persist = process.argv.includes("--persist");
  let stored = 0;
  for (const category of [
    "movie",
    "anime",
    "series",
    "cartoon",
    "drama",
    "documentary",
  ] as const) {
    const query = productQuerySchema.parse({ category });
    for (const source of applicableDiscoverySources(query)) {
      const provider = source.startsWith("tmdb") ? "tmdb" : "myanimelist";
      if (!providerEnabled(provider)) {
        report.push({ category, source, status: "disabled" });
        continue;
      }
      const first = await discoverProviderPage(
        source,
        provider === "tmdb" ? 1 : 0,
        query,
      );
      assert.ok(
        first.next !== null,
        `${source}/${category}: expected another live page`,
      );
      const second = await discoverProviderPage(source, first.next!, query);
      const firstIds = new Set(
        first.items.map((t) => `${t.media}:${t.externalId}`),
      );
      const fresh = second.items.filter(
        (t) => !firstIds.has(`${t.media}:${t.externalId}`),
      );
      assert.ok(
        fresh.length,
        `${source}/${category}: second page needs distinct real titles`,
      );
      report.push({
        category,
        source,
        status: "live",
        firstCount: first.items.length,
        secondCount: second.items.length,
        distinctOnSecondPage: fresh.length,
        firstExamples: first.items
          .slice(0, 2)
          .map((t) => ({ id: t.externalId, title: t.title })),
      });
      if (persist) {
        const sample = [...first.items.slice(0, 1), ...fresh.slice(0, 1)];
        const cutoff = new Date(0).toISOString();
        const ids = await persistDiscoveredTitles(
          provider,
          sample,
          cutoff,
          true,
        );
        const again = await persistDiscoveredTitles(
          provider,
          sample,
          cutoff,
          true,
        );
        assert.deepEqual(
          ids,
          again,
          "Canonical UUIDs must survive repeated provider retrieval",
        );
        stored += ids.length;
      }
    }
  }
  for (const [provider, category, candidates] of [
    ["tmdb", "movie", ["The Matrix", "Perfect Days", "Coherence", "Paterson"]],
    [
      "myanimelist",
      "anime",
      ["Samurai Champloo", "Planetes", "Kaiba", "Dennou Coil"],
    ],
  ] as const) {
    if (!providerEnabled(provider)) continue;
    const source = provider === "tmdb" ? "tmdb.movie" : "myanimelist.anime";
    const registration = await client
      .from("metadata_providers")
      .select("id")
      .eq("key", provider)
      .single();
    if (registration.error)
      throw new Error("Provider registration could not be verified.");
    let verified = false;
    for (const q of candidates) {
      const page = await discoverProviderPage(
        source,
        provider === "tmdb" ? 1 : 0,
        productQuerySchema.parse({ category, q }),
      );
      assert.ok(
        page.items.length,
        "Live global search must return actual matches",
      );
      const refs = await client
        .from("provider_title_ids")
        .select("external_id,external_type")
        .eq("provider_id", registration.data.id)
        .in(
          "external_id",
          page.items.map((t) => t.externalId),
        );
      if (refs.error)
        throw new Error("Could not verify search against the canonical cache.");
      const uncached = page.items.filter(
        (item) =>
          !refs.data.some(
            (ref) =>
              ref.external_id === item.externalId &&
              ref.external_type === item.media,
          ),
      );
      if (!uncached.length) continue;
      report.push({
        provider,
        search: q,
        matches: page.items.length,
        outsideLocalCache: uncached.length,
      });
      verified = true;
      break;
    }
    assert.ok(
      verified,
      `${provider}: all bounded search examples are cached; add another example to verify external discovery.`,
    );
  }
  const output = JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      mode: persist
        ? "bounded canonical persistence verification"
        : "read-only provider verification",
      storedSamples: stored,
      checks: report,
    },
    null,
    2,
  );
  const reportPath = process.argv
    .find((arg) => arg.startsWith("--report="))
    ?.slice("--report=".length);
  if (reportPath) await writeFile(reportPath, output + "\n");
  console.log(output);
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Catalog verification failed.",
  );
  process.exitCode = 1;
});
