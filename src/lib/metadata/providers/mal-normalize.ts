import { z } from "zod";

const named = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
});
const schema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(300),
  main_picture: z
    .object({ large: z.string().optional(), medium: z.string().optional() })
    .nullish(),
  alternative_titles: z
    .object({
      en: z.string().max(300).nullish(),
      ja: z.string().max(300).nullish(),
      synonyms: z.array(z.string().max(300)).max(100).nullish(),
    })
    .nullish(),
  start_date: z.string().nullish(),
  synopsis: z.string().max(20000).nullish(),
  media_type: z.string().nullish(),
  status: z.string().nullish(),
  average_episode_duration: z.number().int().nonnegative().nullish(),
  rating: z.string().nullish(),
  genres: z.array(named).max(100).default([]),
  studios: z.array(named).max(100).default([]),
  related_anime: z
    .array(z.object({ node: z.object({ id: z.number().int().positive() }) }))
    .max(100)
    .default([]),
});
export function malArtwork(value: string | null | undefined) {
  return value &&
    /^https:\/\/cdn\.myanimelist\.net\/images\/anime\/[0-9]+\/[0-9]+\.(?:jpg|png|webp)$/.test(
      value,
    )
    ? value
    : null;
}
/** Public catalog fields only. Provider scores and user lists are never imported. */
export function normalizeMal(raw: unknown) {
  const p = schema.parse(raw);
  const fullDate =
    p.start_date && /^\d{4}-\d{2}-\d{2}$/.test(p.start_date)
      ? p.start_date
      : null;
  const year =
    p.start_date && /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(p.start_date)
      ? Number(p.start_date.slice(0, 4))
      : null;
  const runtime = p.average_episode_duration
    ? Math.round(p.average_episode_duration / 60)
    : null;
  return {
    externalId: String(p.id),
    media: "anime",
    kind: "anime",
    title: p.title,
    originalTitle: p.alternative_titles?.ja || null,
    edition: ["movie", "music"].includes(p.media_type || "")
      ? "standalone"
      : "series",
    description: p.synopsis || "",
    releaseDate: fullDate,
    year: year && year >= 1888 && year <= 2200 ? year : null,
    runtime: runtime && runtime <= 3000 ? runtime : null,
    status:
      p.status === "currently_airing"
        ? "airing"
        : p.status === "finished_airing"
          ? "ended"
          : "announced",
    ageRating:
      (
        {
          g: "G",
          pg: "PG",
          pg_13: "13",
          r: "17",
          "r+": "18",
          rx: "18",
        } as Record<string, string>
      )[p.rating || ""] || null,
    popularity: null,
    poster:
      malArtwork(p.main_picture?.large) || malArtwork(p.main_picture?.medium),
    backdrop: null,
    genres: p.genres.map((g) => g.name),
    countries: [],
    languages: [],
    aliases: [
      ...new Set(
        [
          p.alternative_titles?.en,
          p.alternative_titles?.ja,
          ...(p.alternative_titles?.synonyms || []),
        ].filter((v): v is string => !!v),
      ),
    ].slice(0, 100),
    companies: p.studios.map((s) => ({ id: String(s.id), name: s.name })),
    credits: [],
    trailers: [],
    related: p.related_anime.slice(0, 12).map((r) => String(r.node.id)),
  };
}
