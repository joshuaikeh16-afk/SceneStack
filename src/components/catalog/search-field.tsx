import { Search, X } from "lucide-react";
import Link from "next/link";
import { discoverHref, type DiscoverQuery } from "@/lib/utils/discover";

export function SearchField({ query }: { query: DiscoverQuery }) {
  return (
    <form className="search-form" action="/discover" role="search">
      <label className="sr-only" htmlFor="discover-search">
        Search entertainment titles
      </label>
      <Search size={22} strokeWidth={1.6} aria-hidden="true" />
      <input
        id="discover-search"
        name="q"
        type="search"
        defaultValue={query.q}
        key={query.q}
        placeholder="A title, a world, a new obsession…"
        maxLength={120}
        autoComplete="off"
        aria-describedby="catalog-availability"
      />
      {query.category && (
        <input type="hidden" name="category" value={query.category} />
      )}
      {query.q && (
        <Link
          className="icon-button"
          href={discoverHref({ category: query.category })}
          aria-label="Clear search"
        >
          <X size={18} />
        </Link>
      )}
      <button type="submit" className="button button-primary search-submit">
        Search
      </button>
    </form>
  );
}
