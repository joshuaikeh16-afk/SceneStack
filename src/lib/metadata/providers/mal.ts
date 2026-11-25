import "server-only";
import { providerEnabled } from "@/config/providers";
import { providerRetryDelay } from "./retry-delay";
import { z } from "zod";
import { normalizeMal } from "./mal-normalize";
import { ProviderFailure } from "./tmdb";
import { cachedCatalogRequest } from "../catalog-runtime";

export async function malRequest(path: string, query: Record<string, string>) {
  const client = process.env.MAL_CLIENT_ID;
  if (!client || !providerEnabled("myanimelist"))
    throw new Error(
      "MyAnimeList requires an explicitly approved provider and server client ID.",
    );
  const url = new URL(`https://api.myanimelist.net/v2/${path}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return cachedCatalogRequest(
    "myanimelist",
    path === "anime"
      ? "search"
      : path === "anime/ranking"
        ? "ranking"
        : "metadata",
    url.pathname + url.search,
    async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        let response: Response;
        try {
          response = await fetch(url, {
            headers: { "X-MAL-CLIENT-ID": client, accept: "application/json" },
            redirect: "error",
            cache: "no-store",
            signal: AbortSignal.timeout(12000),
          });
        } catch {
          if (attempt < 2) continue;
          throw new ProviderFailure("unavailable");
        }
        if (response.ok) {
          try {
            return (await response.json()) as unknown;
          } catch {
            throw new ProviderFailure("invalid_payload");
          }
        }
        if (response.status === 404) throw new ProviderFailure("not_found");
        if (response.status === 429 || response.status >= 500) {
          const delay = providerRetryDelay(
            response.headers.get("retry-after"),
            attempt,
          );
          if (attempt < 2 && delay !== null) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw new ProviderFailure(
            response.status === 429 ? "rate_limited" : "unavailable",
          );
        }
        throw new ProviderFailure("unavailable");
      }
      throw new ProviderFailure("unavailable");
    },
  );
}
export async function malDetails(id: string) {
  z.string()
    .regex(/^[1-9][0-9]{0,11}$/)
    .parse(id);
  try {
    return normalizeMal(
      await malRequest(`anime/${id}`, {
        fields:
          "alternative_titles,start_date,synopsis,media_type,status,genres,average_episode_duration,rating,studios,related_anime",
      }),
    );
  } catch (e) {
    if (e instanceof z.ZodError) throw new ProviderFailure("invalid_payload");
    throw e;
  }
}
export async function searchMal(query: string, offset = 0) {
  const q = z.string().trim().min(2).max(120).parse(query);
  z.number().int().min(0).max(10000).parse(offset);
  return malRequest("anime", {
    q,
    offset: String(offset),
    limit: "20",
    nsfw: "false",
  });
}
