import type { EntertainmentKind } from "@/types/title";

export const categories: readonly {
  value: EntertainmentKind;
  label: string;
  description: string;
}[] = [
  { value: "anime", label: "Anime", description: "Beyond the ordinary" },
  { value: "movie", label: "Movies", description: "A different perspective" },
  { value: "series", label: "TV Series", description: "Stay a little longer" },
  { value: "cartoon", label: "Cartoons", description: "Room for wonder" },
  { value: "drama", label: "Dramas", description: "Feel every moment" },
  {
    value: "documentary",
    label: "Documentaries",
    description: "See the world anew",
  },
];

export function isCategory(value: unknown): value is EntertainmentKind {
  return categories.some((category) => category.value === value);
}
export function categoryLabel(value: EntertainmentKind) {
  return categories.find((category) => category.value === value)!.label;
}
