import "server-only";
import { access } from "node:fs/promises";
import { createPrivilegedClient } from "../src/lib/supabase/admin";
import { searchTmdb, tmdbDetails } from "../src/lib/metadata/providers/tmdb";
import { malDetails } from "../src/lib/metadata/providers/mal";
import type { Json } from "../src/types/database";

// Actual provider metadata only. This creates no users, votes, collections or activity.
const picks = [
  ["movie", "Inception", 2010, "movie"],
  ["movie", "Interstellar", 2014, "movie"],
  ["movie", "Dune: Part Two", 2024, "movie"],
  ["movie", "Parasite", 2019, "movie"],
  ["tv", "Breaking Bad", 2008, "series"],
  ["tv", "Stranger Things", 2016, "series"],
  ["tv", "Severance", 2022, "series"],
  ["tv", "The Last of Us", 2023, "series"],
  ["movie", "Spider-Man: Into the Spider-Verse", 2018, "cartoon"],
  ["movie", "Inside Out", 2015, "cartoon"],
  ["tv", "Arcane", 2021, "cartoon"],
  ["tv", "Avatar: The Last Airbender", 2005, "cartoon"],
  ["tv", "Squid Game", 2021, "drama"],
  ["tv", "Crash Landing on You", 2019, "drama"],
  ["tv", "Extraordinary Attorney Woo", 2022, "drama"],
  ["tv", "Guardian: The Lonely and Great God", 2016, "drama"],
  ["tv", "Planet Earth", 2006, "documentary"],
  ["tv", "Planet Earth II", 2016, "documentary"],
  ["tv", "Blue Planet II", 2017, "documentary"],
  ["tv", "Our Planet", 2019, "documentary"],
] as const;
const anime = ["1", "5114", "1535", "9253", "16498", "38000", "52991"];
async function main() {
  if (!process.argv.includes("--execute")) {
    console.log(
      "Dry run: 20 reviewed film/TV searches and 7 MAL anime IDs. Explicit execution registers the approved providers and stores real canonical metadata; it creates no social activity.",
    );
    console.table(
      picks.map(([media, title, year, kind]) => ({ media, title, year, kind })),
    );
    return;
  }
  for (const key of [
    "TMDB_LICENSE_CONFIRMED",
    "TMDB_API_ENABLED",
    "MAL_LICENSE_CONFIRMED",
    "MAL_API_ENABLED",
  ])
    if (process.env[key] !== "true")
      throw new Error("Provider authorization gates are incomplete.");
  await access("public/providers/tmdb.svg");
  const client = createPrivilegedClient();
  const providers = await client
    .from("metadata_providers")
    .upsert(
      [
        {
          key: "tmdb",
          name: "The Movie Database",
          approved: true,
          enabled: true,
          allow_offline_cache: false,
          terms_url: "https://www.themoviedb.org/api-terms-of-use",
          attribution:
            "This product uses the TMDB API but is not endorsed or certified by TMDB.",
        },
        {
          key: "myanimelist",
          name: "MyAnimeList",
          approved: true,
          enabled: true,
          allow_offline_cache: false,
          terms_url: "https://myanimelist.net/about/api_terms_of_use",
          attribution:
            "Anime metadata provided by MyAnimeList. https://myanimelist.net",
        },
      ],
      { onConflict: "key" },
    )
    .select("id,key");
  if (providers.error)
    throw new Error("Could not register approved providers.");
  const ids = new Map(providers.data.map((p) => [p.key, p.id]));
  let imported = 0,
    failed = 0;
  for (const [media, title, year, kind] of picks) {
    try {
      const found = (await searchTmdb(title, media)) as {
        results?: {
          id: number;
          title?: string;
          name?: string;
          release_date?: string;
          first_air_date?: string;
        }[];
      };
      const exact = found.results?.filter(
        (r) =>
          (r.title || r.name || "").toLocaleLowerCase() ===
            title.toLocaleLowerCase() &&
          (r.release_date || r.first_air_date || "").startsWith(String(year)),
      );
      if (exact?.length !== 1) throw new Error("Ambiguous provider match");
      const payload = await tmdbDetails(media, String(exact[0].id));
      if (payload.kind !== kind)
        throw new Error("Category requires editorial review");
      const result = await client.rpc("ingest_tmdb_title", {
        p_provider: ids.get("tmdb")!,
        p_payload: payload as unknown as Json,
      });
      if (result.error) throw new Error("Canonical ingest failed");
      console.log(`Imported ${kind}: ${payload.title}`);
      imported++;
    } catch {
      console.log(`Needs review: ${title} (${year})`);
      failed++;
    }
  }
  for (const id of anime) {
    try {
      const payload = await malDetails(id);
      const result = await client.rpc("ingest_mal_title", {
        p_provider: ids.get("myanimelist")!,
        p_payload: payload as unknown as Json,
      });
      if (result.error) throw new Error("Canonical ingest failed");
      console.log(`Imported anime: ${payload.title}`);
      imported++;
    } catch {
      console.log(`Needs review: MAL anime ${id}`);
      failed++;
    }
  }
  console.log(
    `Launch catalog: ${imported} cached; ${failed} require review. No external ratings imported. Offline metadata cache disabled.`,
  );
  if (failed) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Launch catalog setup failed. Check approved provider configuration; secrets and raw payloads are not logged.",
  );
  process.exitCode = 1;
});
