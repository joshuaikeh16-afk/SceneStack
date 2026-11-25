import type { ReactNode } from "react";
import { TitleCard, type TitleCardData } from "./title-card";
import { PosterSkeleton } from "@/components/ui/loading-skeleton";

export function TitlePosterGrid({
  items,
  loading = false,
  emptyState,
}: {
  items: readonly TitleCardData[];
  loading?: boolean;
  emptyState: ReactNode;
}) {
  if (loading)
    return (
      <div className="poster-grid" role="status">
        <span className="sr-only">Loading titles…</span>
        {Array.from({ length: 6 }, (_, index) => (
          <PosterSkeleton key={index} />
        ))}
      </div>
    );
  if (!items.length) return emptyState;
  return (
    <div className="poster-grid">
      {items.map((item) => (
        <TitleCard
          key={`${item.title.reference.provider}:${item.title.reference.providerId}`}
          {...item}
        />
      ))}
    </div>
  );
}
