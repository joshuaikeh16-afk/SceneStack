import Link from "next/link";
import {
  Clapperboard,
  Drama,
  Film,
  Globe2,
  Sparkles,
  TvMinimal,
  WandSparkles,
} from "lucide-react";
import { categories } from "@/config/categories";
import { discoverHref, type DiscoverQuery } from "@/lib/utils/discover";

const icons = {
  anime: Sparkles,
  movie: Film,
  series: TvMinimal,
  cartoon: WandSparkles,
  drama: Drama,
  documentary: Globe2,
};

export function CategorySelector({
  query = { q: "" },
  compact = false,
}: {
  query?: DiscoverQuery;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "category-chips" : "category-shortcuts"}
      role="group"
      aria-label="Entertainment categories"
    >
      {compact && (
        <Link
          href={discoverHref({ q: query.q })}
          className={`category-chip ${!query.category ? "selected" : ""}`}
          aria-current={!query.category ? "true" : undefined}
        >
          <Clapperboard size={16} aria-hidden="true" />
          All stories
        </Link>
      )}
      {categories.map(({ value, label, description }) => {
        const Icon = icons[value];
        const active = query.category === value;
        return (
          <Link
            href={discoverHref({ q: query.q, category: value })}
            key={value}
            className={
              compact
                ? `category-chip ${active ? "selected" : ""}`
                : "category-shortcut"
            }
            aria-current={active ? "true" : undefined}
          >
            <span className="category-icon">
              <Icon
                size={compact ? 16 : 21}
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </span>
            <span>
              <span className="category-name">{label}</span>
              {!compact && (
                <span className="category-description">{description}</span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
