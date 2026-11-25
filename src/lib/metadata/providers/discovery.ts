import "server-only";
import { z } from "zod";
import type { ProductQuery } from "@/lib/product/validation";
import { tmdbRequest, tmdbDetails, ProviderFailure } from "./tmdb";
import { malRequest } from "./mal";
import {
  normalizeTmdb,
  AnimeProviderRequired,
  type TmdbMedia,
} from "./tmdb-normalize";
import { normalizeMal } from "./mal-normalize";
import { catalogError, invalidateCatalogResponses } from "../catalog-runtime";

export type DiscoveredTitle =
  ReturnType<typeof normalizeTmdb> | ReturnType<typeof normalizeMal>;
export type DiscoverySource = "tmdb.movie" | "tmdb.tv" | "myanimelist.anime";
export type DiscoveryPage = {
  items: DiscoveredTitle[];
  next: number | null;
  limited?: boolean;
};
export type DiscoveryQuery = ProductQuery & { genreName?: string;releaseFrom?:string;releaseTo?:string;discoveryMode?:'trending'|'recent'|'upcoming' };
const records = z.array(z.record(z.string(), z.unknown())).max(100);
const tmdbPage = z.object({
  page: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
  results: records,
});
const malPage = z.object({
  data: z.array(z.object({ node: z.record(z.string(), z.unknown()) })).max(100),
  paging: z.object({ next: z.string().optional() }).default({}),
});

export function applicableDiscoverySources(q: ProductQuery) {
  if (q.rating || q.status === "unavailable") return [];
  const sources: DiscoverySource[] = [];
  if ((!q.status || ["announced", "released"].includes(q.status)) && (!q.category || ["movie", "cartoon", "documentary"].includes(q.category)))
    sources.push("tmdb.movie");
  if (
    (!q.status || q.status !== "released") && (!q.category ||
    ["series", "cartoon", "drama", "documentary"].includes(q.category))
  )
    sources.push("tmdb.tv");
  // MAL exposes no reliable country/language discovery filter. Do not fabricate one.
  if (
    (!q.category || q.category === "anime") &&
    !q.country &&
    !q.language &&
    q.q.length !== 1
  )
    sources.push("myanimelist.anime");
  return sources;
}
export function matchesDiscoveryFilters(
  title: DiscoveredTitle,
  q: DiscoveryQuery,
) {
  return (
    (!q.category || title.kind === q.category) &&
    (!q.year || title.year === q.year) &&
    (!q.releaseFrom || (!!title.releaseDate && title.releaseDate>=q.releaseFrom)) &&
    (!q.releaseTo || (!!title.releaseDate && title.releaseDate<=q.releaseTo)) &&
    (!q.genreName ||
      title.genres.some(
        (g) => g.toLocaleLowerCase() === q.genreName!.toLocaleLowerCase(),
      )) &&
    (!q.country || title.countries.some((c) => c.code === q.country)) &&
    (!q.language || title.languages.some((l) => l.code === q.language)) &&
    (!q.status || title.status === q.status)
  );
}
async function tmdbDiscovery(
  media: TmdbMedia,
  page: number,
  q: DiscoveryQuery,
): Promise<DiscoveryPage> {
  z.number().int().min(1).max(500).parse(page);
  const rawGenres = await tmdbRequest(`genre/${media}/list`);
  const genres = z
    .object({
      genres: z.array(z.object({ id: z.number().int(), name: z.string() })),
    })
    .parse(rawGenres).genres;
  const params: Record<string, string> = {
    page: String(page),
    include_adult: "false",
    language: "en-US",
  };
  let path = `discover/${media}`;
  if (q.q) {
    path = `search/${media}`;
    params.query = q.q;
  }
  if (q.year)
    params[
      media === "movie"
        ? q.q
          ? "year"
          : "primary_release_year"
        : "first_air_date_year"
    ] = String(q.year);
  if (!q.q) {
    if(q.discoveryMode==='trending')path=`trending/${media}/day`;
    params.sort_by =
      q.sort === "year"
        ? media === "movie"
          ? "primary_release_date.desc"
          : "first_air_date.desc"
        : q.sort === "title"
          ? media === "movie"
            ? "original_title.asc"
            : "name.asc"
          : "popularity.desc";
    const wanted = new Set<number>();
    if (q.category === "cartoon") wanted.add(16);
    if (q.category === "documentary") wanted.add(99);
    if (q.category === "drama") {
      wanted.add(18);
      params.with_origin_country = "KR|CN|TW|TH";
    }
    if (q.genreName) {
      const genre = genres.find(
        (g) => g.name.toLocaleLowerCase() === q.genreName!.toLocaleLowerCase(),
      );
      if (!genre) return { items: [], next: null };
      wanted.add(genre.id);
    }
    if (wanted.size) params.with_genres = [...wanted].join(",");
    if (q.category === "movie" || q.category === "series")
      params.without_genres = "16,99";
    if (q.country) params.with_origin_country = q.country;
    if (q.language) params.with_original_language = q.language;
    if (media === "tv" && q.status) {
      params.with_status = (
        {
          announced: "1|5",
          airing: "0|2",
          ended: "3|4",
        } as Record<string, string>
      )[q.status];
    }
    if (media === "movie" && q.status) {
      const today = new Date().toISOString().slice(0, 10);
      params[q.status === "released" ? "primary_release_date.lte" : "primary_release_date.gte"] = today;
    }
    const dateField=media==='movie'?'primary_release_date':'first_air_date';
    if(q.releaseFrom)params[`${dateField}.gte`]=q.releaseFrom;
    if(q.releaseTo)params[`${dateField}.lte`]=q.releaseTo;
    if(q.discoveryMode==='recent') {const end=new Date(),start=new Date(Date.now()-30*86400000);params[`${dateField}.gte`]=start.toISOString().slice(0,10);params[`${dateField}.lte`]=end.toISOString().slice(0,10);}
    if(q.discoveryMode==='upcoming')params[`${dateField}.gte`]=new Date().toISOString().slice(0,10);
  }
  const raw = tmdbPage.parse(await tmdbRequest(path, params));
  if (raw.page !== page) {
    catalogError("tmdb", "pagination", "repeated_page");
    throw new ProviderFailure("invalid_payload");
  }
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const languages = new Intl.DisplayNames(["en"], { type: "language" });
  const items: DiscoveredTitle[] = [];
  for (const row of raw.results) {
    try {
      const genreIds = z.array(z.number().int()).parse(row.genre_ids ?? []);
      const origin = z
        .array(z.string().regex(/^[A-Z]{2}$/))
        .parse(row.origin_country ?? []);
      const language =
        typeof row.original_language === "string" &&
        /^[a-z]{2,3}$/.test(row.original_language)
          ? row.original_language
          : null;
      let normalized = normalizeTmdb(
        {
          ...row,
          genres: genres.filter((g) => genreIds.includes(g.id)),
          production_countries: origin.map((code) => ({
            iso_3166_1: code,
            name: names.of(code) || code,
          })),
          spoken_languages: language
            ? [
                {
                  iso_639_1: language,
                  english_name: languages.of(language) || language,
                },
              ]
            : [],
        },
        media,
      );
      // Summary search responses omit status and movie countries. Fetch actual
      // details only for these sparse filters; requests still share the queue,
      // cache and per-instance request budget.
      if (q.q && (q.status || (q.country && media === "movie"))) {
        normalized = await tmdbDetails(media, normalized.externalId);
      }
      if (media === "tv" && q.status && !q.q) normalized.status = q.status;
      // Search/movie lacks production countries. A country-filtered search needs
      // actual detail metadata, rather than guessing from the response language.
      if (q.country && media === "movie" && !q.q)
        normalized.countries = [
          { code: q.country, name: names.of(q.country) || q.country },
        ];
      if (
        matchesDiscoveryFilters(normalized, q)
      )
        items.push(normalized);
    } catch (error) {
      if (error instanceof AnimeProviderRequired) continue;
      if (error instanceof z.ZodError) {
        catalogError("tmdb", "normalization", "invalid_payload");
        continue;
      }
      throw error;
    }
  }
  return {
    items,
    next: page < Math.min(raw.total_pages, 500) ? page + 1 : null,
    limited: page >= 500 && raw.total_pages > 500,
  };
}
export const MAL_DISCOVERY_FIELDS =
  "alternative_titles,start_date,synopsis,media_type,status,genres,average_episode_duration,rating,studios,related_anime";
async function malDiscovery(
  continuation: number,
  q: DiscoveryQuery,
): Promise<DiscoveryPage> {
  const seasonal = !!q.year && !q.q;
  z.number().int().min(0).max(seasonal ? 40003 : 10000).parse(continuation);
  const season = seasonal ? Math.floor(continuation / 10001) : 0;
  const offset = seasonal ? continuation % 10001 : continuation;
  if (season > 3) throw new ProviderFailure("invalid_payload");
  const params: Record<string, string> = {
    offset: String(offset),
    limit: seasonal ? "50" : "20",
    nsfw: "false",
    fields: MAL_DISCOVERY_FIELDS,
  };
  const path = q.q ? "anime" : seasonal ? `anime/season/${q.year}/${["winter", "spring", "summer", "fall"][season]}` : "anime/ranking";
  if (q.q) params.q = q.q;
  else if (seasonal) params.sort = "anime_num_list_users";
  else params.ranking_type = q.status === "airing" ? "airing" : q.status === "announced" ? "upcoming" : "bypopularity";
  const raw = malPage.parse(await malRequest(path, params));
  const items: DiscoveredTitle[] = [];
  for (const row of raw.data) {
    try {
      const title = normalizeMal(row.node);
      if (matchesDiscoveryFilters(title, q)) items.push(title);
    } catch (error) {
      if (!(error instanceof z.ZodError)) throw error;
      catalogError("myanimelist", "normalization", "invalid_payload");
    }
  }
  let next: number | null = null;
  if (raw.paging.next) {
    const url = new URL(raw.paging.next);
    const value = Number(url.searchParams.get("offset"));
    if (
      url.protocol !== "https:" ||
      url.hostname !== "api.myanimelist.net" ||
      url.pathname !== `/v2/${path}` ||
      !Number.isInteger(value) ||
      value <= offset
    ) {
      catalogError("myanimelist", "pagination", "invalid_next_offset");
      throw new ProviderFailure("invalid_payload");
    }
    if (value <= 10000) next = seasonal ? season * 10001 + value : value;
  }
  const limited = !!raw.paging.next && next === null;
  if (!raw.paging.next && seasonal && season < 3) next = (season + 1) * 10001;
  return { items, next, limited };
}
export async function discoverProviderPage(
  source: DiscoverySource,
  page: number,
  query: DiscoveryQuery,
) {
  try {
    return await (source === "myanimelist.anime"
      ? malDiscovery(page, query)
      : tmdbDiscovery(source === "tmdb.movie" ? "movie" : "tv", page, query));
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      (error instanceof ProviderFailure && error.code === "invalid_payload")
    ) {
      invalidateCatalogResponses(
        source.startsWith("tmdb") ? "tmdb" : "myanimelist",
      );
      throw new ProviderFailure("invalid_payload");
    }
    throw error;
  }
}
