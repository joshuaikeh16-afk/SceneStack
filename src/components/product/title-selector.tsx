"use client";
import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, Check, Film } from "lucide-react";
import Image from "next/image";
import { categories } from "@/config/categories";
import { fetchData } from "./providers";
import type { TitleFeedPage } from "@/types/product";
import { DataNotice } from "./availability";
export function TitleSelector({
  selected,
  onChange,
  existing = [],
  collectionId,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  existing?: string[];
  collectionId?: string;
}) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const [category, setCategory] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["title-selector", search, category, collectionId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchData<TitleFeedPage & { includedIds?: string[] }>(
        collectionId ? "selectable-titles" : "title-feed",
        {
          q: search,
          category: category || undefined,
          cursor: pageParam ?? undefined,
          source: collectionId ? undefined : "catalog",
          limit: 24,
          collectionId,
        },
        signal,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    maxPages: 12,
  });
  const titles = [
    ...new Map(
      (query.data?.pages ?? []).flatMap((p) => p.titles).map((t) => [t.id, t]),
    ).values(),
  ];
  return (
    <div className="title-selector">
      <label className="compact-search">
        <Search size={17} />
        <input
          value={q}
          maxLength={120}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for a title"
          aria-label="Search titles to add"
        />
      </label>
      <label className="selector-category">
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All worlds</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {query.isPending && <p role="status">Finding stories…</p>}
      {query.isError && (
        <div className="form-error" role="alert">
          {query.error.message}
          <button
            className="text-link"
            onClick={() =>
              query.isFetchNextPageError
                ? query.fetchNextPage()
                : query.refetch()
            }
          >
            Retry
          </button>
        </div>
      )}
      {query.data && <DataNotice state={query.data.pages[0].availability} />}
      <div className="title-selector-grid">
        {titles.map((t) => {
          const added =
              existing.includes(t.id) ||
              query.data?.pages.some((p) => p.includedIds?.includes(t.id)),
            checked = selected.includes(t.id);
          return (
            <button
              type="button"
              key={t.id}
              className={`selectable-title ${checked ? "selected" : ""}`}
              disabled={added || (!checked && selected.length >= 100)}
              aria-pressed={checked || added}
              onClick={() =>
                onChange(
                  checked
                    ? selected.filter((id) => id !== t.id)
                    : [...selected, t.id],
                )
              }
            >
              <span className="selector-poster">
                {t.title.posterUrl ? (
                  <Image src={t.title.posterUrl} alt="" fill sizes="100px" />
                ) : (
                  <Film size={24} />
                )}
                <span className="selector-check">
                  {(checked || added) && <Check size={16} />}
                </span>
              </span>
              <strong>{t.title.name}</strong>
              <small>
                {added
                  ? "Already in collection"
                  : (t.title.releaseYear ?? "Year unavailable")}
              </small>
            </button>
          );
        })}
      </div>
      {query.data?.pages[0].availability === "ready" &&
        !titles.length &&
        !query.hasNextPage && (
          <p className="muted-copy">No matching stories. Try another title.</p>
        )}
      {query.hasNextPage && (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          Load more titles
        </button>
      )}
      <p className="selection-count">{selected.length} selected</p>
    </div>
  );
}
