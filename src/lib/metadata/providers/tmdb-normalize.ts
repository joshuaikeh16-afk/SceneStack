import { z } from "zod";
const imagePath = z
  .string()
  .regex(/^\/[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/)
  .nullable()
  .optional();
const person = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  character: z.string().max(200).optional(),
  job: z.string().max(100).optional(),
});
const payloadSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().max(300).optional(),
  name: z.string().max(300).optional(),
  original_title: z.string().max(300).optional(),
  original_name: z.string().max(300).optional(),
  overview: z.string().max(20000).nullable().optional(),
  original_language: z.string().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  status: z.string().optional(),
  adult: z.boolean().optional(),
  popularity: z.number().nonnegative().optional(),
  runtime: z.number().int().nonnegative().nullable().optional(),
  episode_run_time: z.array(z.number().int().nonnegative()).optional(),
  production_companies: z
    .array(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(200),
      }),
    )
    .max(100)
    .optional(),
  poster_path: imagePath,
  backdrop_path: imagePath,
  genres: z
    .array(z.object({ id: z.number(), name: z.string().min(1).max(80) }))
    .max(100)
    .default([]),
  production_countries: z
    .array(
      z.object({
        iso_3166_1: z.string().regex(/^[A-Z]{2}$/),
        name: z.string(),
      }),
    )
    .default([]),
  spoken_languages: z
    .array(
      z.object({
        iso_639_1: z.string().regex(/^[a-z]{2,3}$/),
        english_name: z.string(),
      }),
    )
    .default([]),
  alternative_titles: z
    .object({
      titles: z.array(z.object({ title: z.string().max(300) })).optional(),
      results: z.array(z.object({ title: z.string().max(300) })).optional(),
    })
    .optional(),
  credits: z
    .object({
      cast: z.array(person).default([]),
      crew: z.array(person).default([]),
    })
    .optional(),
  videos: z
    .object({
      results: z.array(
        z.object({
          key: z.string(),
          site: z.string(),
          type: z.string(),
          official: z.boolean().optional(),
          name: z.string().max(120).optional(),
        }),
      ),
    })
    .optional(),
  recommendations: z
    .object({ results: z.array(z.object({ id: z.number().int().positive() })) })
    .optional(),
});
export const tmdbMediaSchema = z.enum(["movie", "tv"]);
export type TmdbMedia = z.infer<typeof tmdbMediaSchema>;
export class AnimeProviderRequired extends Error {
  constructor() {
    super("Japanese animation needs a separately approved anime provider.");
  }
}
export function tmdbArtwork(
  path: string | null | undefined,
  size: "w500" | "w1280",
) {
  return path && /^\/[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/.test(path)
    ? `https://image.tmdb.org/t/p/${size}${path}`
    : null;
}
export function normalizeTmdb(raw: unknown, media: TmdbMedia) {
  const p = payloadSchema.parse(raw);
  const animation = p.genres.some((g) => g.id === 16);
  if (
    animation &&
    (p.original_language === "ja" ||
      p.production_countries.some((c) => c.iso_3166_1 === "JP"))
  )
    throw new AnimeProviderRequired();
  const documentary = p.genres.some((g) => g.id === 99);
  const drama =
    media === "tv" &&
    p.genres.some((g) => g.id === 18) &&
    p.production_countries.some((c) =>
      ["KR", "CN", "TW", "TH"].includes(c.iso_3166_1),
    );
  const kind = documentary
    ? "documentary"
    : animation
      ? "cartoon"
      : drama
        ? "drama"
        : media === "movie"
          ? "movie"
          : "series";
  const date = media === "movie" ? p.release_date : p.first_air_date;
  const year =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) : null;
  const status =
    p.status === "Ended" || p.status === "Canceled"
      ? "ended"
      : media === "tv" &&
          ["Returning Series", "In Production"].includes(p.status || "")
        ? "airing"
        : p.status === "Released" ||
            (date && date <= new Date().toISOString().slice(0, 10))
          ? "released"
          : "announced";
  return {
    externalId: String(p.id),
    media,
    title:
      (media === "movie" ? p.title : p.name) ||
      p.original_title ||
      p.original_name ||
      "",
    originalTitle:
      (media === "movie" ? p.original_title : p.original_name) || null,
    kind,
    edition: media === "tv" ? "series" : "standalone",
    description: p.overview || "",
    releaseDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    runtime: (media === "movie" ? p.runtime : p.episode_run_time?.[0]) || null,
    companies: (p.production_companies ?? []).map((c) => ({
      id: String(c.id),
      name: c.name,
    })),
    year: year && year >= 1888 && year <= 2200 ? year : null,
    status,
    ageRating: p.adult ? "18" : null,
    popularity: p.popularity ?? null,
    poster: tmdbArtwork(p.poster_path, "w500"),
    backdrop: tmdbArtwork(p.backdrop_path, "w1280"),
    genres: p.genres.map((g) => g.name),
    countries: p.production_countries.map((c) => ({
      code: c.iso_3166_1,
      name: c.name,
    })),
    languages: p.spoken_languages.map((l) => ({
      code: l.iso_639_1,
      name: l.english_name,
    })),
    aliases: [
      ...new Set(
        [
          ...(p.alternative_titles?.titles ?? []),
          ...(p.alternative_titles?.results ?? []),
        ]
          .map((a) => a.title)
          .filter(Boolean),
      ),
    ].slice(0, 100),
    credits: [
      ...(p.credits?.cast ?? []).slice(0, 12).map((c) => ({
        id: String(c.id),
        name: c.name,
        department: "cast",
        role: c.character || "",
      })),
      ...(p.credits?.crew ?? [])
        .filter((c) =>
          ["Director", "Writer", "Screenplay", "Creator"].includes(c.job || ""),
        )
        .slice(0, 8)
        .map((c) => ({
          id: String(c.id),
          name: c.name,
          department:
            c.job === "Director"
              ? "director"
              : c.job === "Creator"
                ? "creator"
                : "writer",
          role: c.job || "",
        })),
    ],
    trailers: (p.videos?.results ?? [])
      .filter(
        (v) =>
          v.site === "YouTube" &&
          v.type === "Trailer" &&
          v.official &&
          /^[A-Za-z0-9_-]{6,30}$/.test(v.key),
      )
      .slice(0, 4)
      .map((v) => ({
        url: `https://www.youtube.com/watch?v=${v.key}`,
        label: v.name || "Official trailer",
      })),
    related: (p.recommendations?.results ?? [])
      .slice(0, 12)
      .map((t) => String(t.id)),
  };
}
