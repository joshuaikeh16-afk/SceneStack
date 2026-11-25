import { Orbit, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { categoryLabel } from "@/config/categories";
import type { DiscoverQuery } from "@/lib/utils/discover";
export function CatalogEmpty({ query }: { query: DiscoverQuery }) {
  const selected = query.q || query.category;
  return (
    <div className="catalog-empty">
      <div className="empty-poster-composition" aria-hidden="true">
        <span />
        <span />
        <span />
        <div>
          {selected ? (
            <SearchX size={29} strokeWidth={1.3} />
          ) : (
            <Orbit size={32} strokeWidth={1.2} />
          )}
        </div>
      </div>
      <div className="catalog-empty-copy">
        <span className="overline">THE DISCOVERY CHAPTER IS NEXT</span>
        <h2>
          Your next great find
          <br />
          is still ahead.
        </h2>
        <p>
          {selected ? (
            <>
              Your{" "}
              {query.category
                ? `${categoryLabel(query.category).toLowerCase()} selection`
                : "search"}
              {query.q && (
                <>
                  {" "}
                  for <strong>“{query.q}”</strong>
                </>
              )}{" "}
              is saved in this URL.{" "}
            </>
          ) : (
            "You bring the curiosity. We’re preparing the catalog. "
          )}
          Real search results will appear when an approved metadata provider is
          connected.
        </p>
        <span className="inline-note">
          No sample titles. No made-up ratings. Just a fresh start.
        </span>
        {selected && (
          <ButtonLink href="/discover" variant="secondary">
            Clear search & category
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
