"use client";
import { useState, useMemo, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { libraryQuerySchema } from "@/lib/product/validation";
import { statusLabels } from "@/lib/product/state";
import { useProduct, fetchData } from "./providers";
import { DataNotice, QuietEmpty } from "./availability";
import { TitleStates } from "./title-state";
import { TitleCard } from "@/components/product/product-title-card";
import { CollectionCard } from "./collection-card";
import { CreateCollectionDialog } from "./create-collection";
import { Pagination, LoadingGrid } from "./catalog-browser";
import { BulkLibraryToolbar } from "./bulk-library";
import type { LibraryResult, TitleView } from "@/types/product";
const sections = [
  { id: "tracking", label: "Titles" },
  { id: "favorites", label: "Favorites" },
  { id: "collections", label: "My Collections" },
  { id: "saved", label: "Saved Collections" },
  { id: "imported", label: "Imported" },
  { id: "ratings", label: "Rated" },
] as const;
export function ConnectedLibrary() {
  const { bootstrap } = useProduct();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [lastSearch, setLastSearch] = useState(
    pathname === "/library" ? search : "",
  );
  if (pathname === "/library" && search !== lastSearch) setLastSearch(search);
  const q = useMemo(() => {
    const parsed = libraryQuerySchema.safeParse(
      Object.fromEntries(new URLSearchParams(lastSearch)),
    );
    return parsed.success ? parsed.data : libraryQuerySchema.parse({});
  }, [lastSearch]);
  function setQ(update: (old: typeof q) => typeof q) {
    if (window.location.pathname !== "/library") return;
    const parsed = libraryQuerySchema.safeParse(
      Object.fromEntries(new URLSearchParams(window.location.search)),
    );
    const next = update(parsed.success ? parsed.data : q);
    const params = new URLSearchParams();
    const defaults = libraryQuerySchema.parse({});
    for (const [key, value] of Object.entries(next))
      if (value !== defaults[key as keyof typeof defaults])
        params.set(key, String(value));
    window.history.replaceState(
      null,
      "",
      `/library${params.size ? `?${params}` : ""}`,
    );
  }
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<TitleView[]>([]);
  useEffect(() => {
    // Bulk selection belongs to its current result set, never a previous filter.
    const frame = requestAnimationFrame(() => {
      setSelected([]);
      setSelectionMode(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [lastSearch]);
  const [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: ["library", bootstrap.userId, q],
    queryFn: ({ signal }) => fetchData<LibraryResult>("library", q, signal),
    enabled: bootstrap.availability === "ready",
  });
  const collections = ["collections", "saved", "imported"].includes(q.section);
  return (
    <>
      <div className="library-top-actions">
        <p className="privacy-caption">
          Private by default. Make room for what you love.
        </p>
        <button
          className="button button-primary"
          onClick={() => setCreating(true)}
          disabled={bootstrap.availability !== "ready"}
        >
          <Plus size={17} />
          Create collection
        </button>
      </div>
      <div className="product-tabs library-tabs" aria-label="Library sections">
        {sections.map((s) => (
          <button
            key={s.id}
            aria-current={q.section === s.id ? "page" : undefined}
            onClick={() => setQ((old) => ({ ...old, section: s.id, page: 1 }))}
          >
            {s.label}
          </button>
        ))}
      </div>
      {q.section === "tracking" && (
        <div
          className="category-pills status-pills"
          aria-label="Tracking status"
        >
          <button
            className={q.status === "all" ? "active" : ""}
            aria-pressed={q.status === "all"}
            onClick={() => setQ((old) => ({ ...old, status: "all", page: 1 }))}
          >
            All titles
          </button>
          {Object.entries(statusLabels).map(([value, label]) => (
            <button
              className={q.status === value ? "active" : ""}
              aria-pressed={q.status === value}
              key={value}
              onClick={() =>
                setQ((old) => ({
                  ...old,
                  status: value as typeof q.status,
                  page: 1,
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {!collections && (
        <div className="library-selection-controls">
          <button
            className="text-link"
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) setSelected([]);
            }}
          >
            {selectionMode ? "Done selecting" : "Select titles"}
          </button>
          {selectionMode && query.data?.titles.length !== 0 && (
            <button
              className="text-link"
              onClick={() =>
                setSelected((old) =>
                  [
                    ...old,
                    ...(query.data?.titles ?? []).filter(
                      (t) => !old.some((s) => s.id === t.id),
                    ),
                  ].slice(0, 100),
                )
              }
            >
              Select this page
            </button>
          )}
        </div>
      )}
      <BulkLibraryToolbar selected={selected} onChange={setSelected} />
      <div className="library-tools">
        <label className="compact-search">
          <Search size={17} />
          <input
            value={q.q}
            placeholder="Find something in your library"
            aria-label="Search your library"
            maxLength={120}
            onChange={(e) =>
              setQ((old) => ({ ...old, q: e.target.value, page: 1 }))
            }
          />
        </label>
        <label className="sort-control">
          Sort
          <select
            value={q.sort}
            onChange={(e) =>
              setQ((old) => ({
                ...old,
                sort: e.target.value as typeof q.sort,
                page: 1,
              }))
            }
          >
            <option value="updated">Recently updated</option>
            <option value="title">Title</option>
            <option value="year">Release year</option>
            <option value="rating">My rating</option>
          </select>
        </label>
      </div>
      <DataNotice state={bootstrap.availability} />
      {bootstrap.availability === "ready" &&
        (query.isPending ? (
          <LoadingGrid />
        ) : query.isError ? (
          <div className="inline-error">
            <p>{query.error.message}</p>
            <button onClick={() => query.refetch()}>Try again</button>
          </div>
        ) : (
          query.data && (
            <>
              <DataNotice state={query.data.availability} />
              {query.data.availability === "ready" && (
                <>
                  {collections ? (
                    <>
                      <p className="section-explainer">
                        {q.section === "saved"
                          ? "Saved collections follow the original. Changes and unpublishing are reflected here."
                          : q.section === "imported"
                            ? "Your independent, private copies. Edit them however you like."
                            : "Create a collection for a mood, a moment, a whole universe."}
                      </p>
                      <div className="product-collection-grid">
                        {query.data.collections.map((c) => (
                          <CollectionCard key={c.record.id} view={c} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <TitleStates
                      ids={query.data.titles.map((t) => t.id)}
                      initial={query.data.states}
                    >
                      <div className="product-title-grid">
                        {query.data.titles.map((t) => (
                          <div
                            className={`selectable-library-title ${selected.some((s) => s.id === t.id) ? "selected" : ""}`}
                            key={t.id}
                          >
                            {selectionMode && (
                              <label className="library-selection-checkbox">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${t.title.name}`}
                                  checked={selected.some((s) => s.id === t.id)}
                                  disabled={
                                    !selected.some((s) => s.id === t.id) &&
                                    selected.length >= 100
                                  }
                                  onChange={(e) =>
                                    setSelected((old) =>
                                      e.target.checked
                                        ? [...old, t]
                                        : old.filter((s) => s.id !== t.id),
                                    )
                                  }
                                />
                              </label>
                            )}{" "}
                            <TitleCard
                              title={t.title}
                              communityRating={t.communityRating}
                              view={t}
                            />
                          </div>
                        ))}
                      </div>
                    </TitleStates>
                  )}
                  {(collections
                    ? !query.data.collections.length
                    : !query.data.titles.length) && (
                    <QuietEmpty
                      title={
                        q.q
                          ? "No matches in your universe."
                          : q.section === "tracking"
                            ? "The first story is yours to choose."
                            : "A little space for something good."
                      }
                      description={
                        q.q
                          ? "Try another title or clear your filters."
                          : q.section === "ratings"
                            ? "Your private ratings will appear here after you rate a title."
                            : q.section === "favorites"
                              ? "Favorite a title to keep it close. Only you can see this list."
                              : q.section === "saved"
                                ? "Save a published collection to return to its original, always up to date."
                                : q.section === "imported"
                                  ? "Import a published collection to make an independent copy of your own."
                                  : "Browse a world of stories, then add the ones that feel like you."
                      }
                      action={{ label: "Explore Discover", href: "/discover" }}
                    />
                  )}
                  <Pagination
                    page={q.page}
                    hasMore={query.data.hasMore}
                    onPage={(page) => setQ((old) => ({ ...old, page }))}
                  />
                </>
              )}
            </>
          )
        ))}
      <CreateCollectionDialog
        key={creating ? "open" : "closed"}
        open={creating}
        onOpenChange={setCreating}
      />
    </>
  );
}
