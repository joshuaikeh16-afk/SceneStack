export const entertainmentKinds = [
  "anime",
  "movie",
  "series",
  "cartoon",
  "drama",
  "documentary",
] as const;
export type EntertainmentKind = (typeof entertainmentKinds)[number];
export type TitleReference = { provider: string; providerId: string };
export type Title = {
  reference: TitleReference;
  name: string;
  kind: EntertainmentKind;
  synopsis: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseYear: number | null;
  episodeCount: number | null;
};
