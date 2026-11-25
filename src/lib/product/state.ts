import type { TitleState } from "@/types/product";
import type { Title } from "@/types/title";
export const statusLabels = {
  planned: "Planned",
  watching: "Watching",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
} as const;
export function defaultTracking(title: Pick<Title, "kind">, edition?: string) {
  return edition === "standalone" ||
    title.kind === "movie" ||
    (title.kind === "documentary" &&
      !["series", "season"].includes(edition ?? ""))
    ? "completed"
    : "watching";
}
export function trackingLabel(
  state: TitleState | null | undefined,
  title: Pick<Title, "kind">,
  edition?: string,
) {
  const watched = defaultTracking(title, edition) === "completed";
  if (!state?.tracking) return watched ? "Add to Watched" : "Add to Watching";
  return state.tracking === "completed" && watched
    ? "Watched"
    : statusLabels[state.tracking];
}
export const blankTitleState = (titleId: string): TitleState => ({
  titleId,
  tracking: null,
  favorite: false,
  rating: null,
});
