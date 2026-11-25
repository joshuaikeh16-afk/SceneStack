export function PosterSkeleton() {
  return (
    <div className="poster-skeleton" aria-hidden="true">
      <div className="skeleton skeleton-poster" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div
      className="page-container loading-page"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading SceneStack…</span>
      <div className="skeleton skeleton-eyebrow" />
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-search" />
      <div className="poster-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <PosterSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
