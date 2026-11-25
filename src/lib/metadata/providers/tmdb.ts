import "server-only";
import { providerEnabled } from "@/config/providers";
import { providerRetryDelay } from "./retry-delay";
import { z } from "zod";
import { cachedCatalogRequest } from "../catalog-runtime";
import {
  normalizeTmdb,
  tmdbMediaSchema,
  type TmdbMedia,
} from "./tmdb-normalize";
export class ProviderFailure extends Error {
  constructor(
    public code:
      | "timeout"
      | "rate_limited"
      | "unavailable"
      | "invalid_payload"
      | "not_found",
  ) {
    super(
      "The metadata provider is unavailable. Cached information has been kept.",
    );
  }
}
function token() {
  if (!providerEnabled("tmdb") || !process.env.TMDB_API_TOKEN)
    throw new Error(
      "TMDB requires an operator-approved license, attribution assets, and a server-only token before use.",
    );
  return process.env.TMDB_API_TOKEN;
}
export async function tmdbRequest(
  path: string,
  query: Record<string, string> = {},
) {
  const access = token();
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return cachedCatalogRequest(
    "tmdb",
    path.startsWith("search/")
      ? "search"
      : path.startsWith("discover/")
        ? "discovery"
        : "metadata",
    url.pathname + url.search,
    async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        let response: Response;
        try {
          response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${access}`,
              accept: "application/json",
            },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(12000),
          });
        } catch (error) {
          if (attempt < 2) continue;
          throw new ProviderFailure(
            error instanceof Error &&
              ["TimeoutError", "AbortError"].includes(error.name)
              ? "timeout"
              : "unavailable",
          );
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
export async function searchTmdb(query: string, media: TmdbMedia, page = 1) {
  const q = z.string().trim().min(1).max(120).parse(query);
  tmdbMediaSchema.parse(media);
  z.number().int().min(1).max(500).parse(page);
  return tmdbRequest(`search/${media}`, {
    query: q,
    page: String(page),
    include_adult: "false",
  });
}
export async function tmdbDetails(media: TmdbMedia, id: string) {
  tmdbMediaSchema.parse(media);
  z.string()
    .regex(/^[1-9][0-9]{0,11}$/)
    .parse(id);
  try {
    return normalizeTmdb(
      await tmdbRequest(`${media}/${id}`, {
        append_to_response: "credits,videos,alternative_titles,recommendations",
      }),
      media,
    );
  } catch (error) {
    if (error instanceof ProviderFailure) throw error;
    if (error instanceof z.ZodError)
      throw new ProviderFailure("invalid_payload");
    throw error;
  }
}
