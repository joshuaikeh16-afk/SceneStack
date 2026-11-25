import { isCategory } from "@/config/categories";
import type { EntertainmentKind } from "@/types/title";

export type DiscoverQuery = { q: string; category?: EntertainmentKind };
export type SearchParams = Record<string, string | string[] | undefined>;

export function parseDiscoverQuery(params: SearchParams): DiscoverQuery {
  return {
    q:
      typeof params.q === "string"
        ? params.q
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .trim()
            .slice(0, 120)
        : "",
    category: isCategory(params.category) ? params.category : undefined,
  };
}

export function discoverHref(query: Partial<DiscoverQuery> = {}) {
  const params = new URLSearchParams();
  if (isCategory(query.category)) params.set("category", query.category);
  if (query.q?.trim()) params.set("q", query.q.trim().slice(0, 120));
  return `/discover${params.size ? `?${params}` : ""}`;
}
