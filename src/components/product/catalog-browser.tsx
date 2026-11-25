"use client";
import Link from "next/link";
import { useRef, useState, useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, ArrowLeft, ArrowRight } from "lucide-react";
import { categories } from "@/config/categories";
import {
  productQuerySchema,
  productHref,
  type ProductQuery,
} from "@/lib/product/validation";
import { fetchData, useProduct } from "./providers";
import { SearchSuggestions } from "./search-suggestions";
import { ProductDialog } from "./dialog";
import { DataNotice, QuietEmpty } from "./availability";
import { InfiniteTitleFeed } from "./infinite-title-feed";
import { CollectionCard } from "./collection-card";
import { RequestTitleDialog } from "./submissions";
import type { CatalogResult, LookupData, TitleFeedPage } from "@/types/product";
export function CatalogBrowser({
  initial,
  initialQuery,
}: {
  initial: CatalogResult | TitleFeedPage;
  initialQuery: ProductQuery;
}) {
  const { bootstrap } = useProduct();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // An intercepted title owns the address bar while Discover stays mounted.
  const [lastSearch, setLastSearch] = useState(
    pathname === "/discover"
      ? search
      : (productHref(initialQuery).split("?")[1] ?? ""),
  );
  if (pathname === "/discover" && search !== lastSearch) setLastSearch(search);
  const q = useMemo(() => {
    const parsed = productQuerySchema.safeParse(
      Object.fromEntries(new URLSearchParams(lastSearch)),
    );
    return parsed.success ? parsed.data : initialQuery;
  }, [lastSearch, initialQuery]);
  const matchesInitial = productHref(q) === productHref(initialQuery);
  const [draft, setDraft] = useState(q.q),
    [filters, setFilters] = useState(false),
    [request, setRequest] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const handle = window.setTimeout(() => setDraft(q.q), 0);
    return () => window.clearTimeout(handle);
  }, [q.q]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const gated = q.tab !== "titles" && !bootstrap.userId;
  const lookups = useQuery({
    queryKey: ["lookups"],
    queryFn: ({ signal }) => fetchData<LookupData>("lookups", {}, signal),
    enabled: filters,
  });
  function update(patch: Partial<ProductQuery>) {
    if (window.location.pathname !== "/discover") return;
    // The native URL already contains earlier edits, including edits made
    // before React has committed the matching search-parameter update.
    const latest = productQuerySchema.safeParse(
      Object.fromEntries(new URLSearchParams(window.location.search)),
    );
    const next = {
      ...(latest.success ? latest.data : q),
      ...patch,
      page: patch.page ?? 1,
    };
    window.history.replaceState(null, "", productHref(next));
  }
  function clearFilters() {
    window.history.replaceState(null, "", productHref({ q: q.q }));
  }
  const active = [
    q.category,
    q.genre,
    q.year,
    q.country,
    q.language,
    q.rating,
    q.status,
  ].filter(Boolean).length;
  const filterFields = (
    <div className="filter-fields">
      <label>
        Genre
        <select
          value={q.genre ?? ""}
          onChange={(e) => update({ genre: e.target.value || undefined })}
        >
          <option value="">All genres</option>
          {lookups.data?.genres.map((g) => (
            <option value={g.id} key={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Release year
        <input
          type="number"
          min="1888"
          max="2200"
          key={q.year ?? "any-year"}
          defaultValue={q.year ?? ""}
          onBlur={(e) => {
            const year = Number(e.target.value);
            if (
              !e.target.value ||
              (Number.isInteger(year) && year >= 1888 && year <= 2200)
            )
              update({ year: e.target.value ? year : undefined });
          }}
          placeholder="Any year"
        />
      </label>
      <label>
        Country
        <select
          value={q.country ?? ""}
          onChange={(e) => update({ country: e.target.value || undefined })}
        >
          <option value="">All countries</option>
          {lookups.data?.countries.map((g) => (
            <option value={g.code} key={g.code}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Language
        <select
          value={q.language ?? ""}
          onChange={(e) => update({ language: e.target.value || undefined })}
        >
          <option value="">All languages</option>
          {lookups.data?.languages.map((g) => (
            <option value={g.code} key={g.code}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Community rating
        <select
          value={q.rating ?? ""}
          onChange={(e) =>
            update({
              rating: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Any rating</option>
          {[5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n}+ / 10
            </option>
          ))}
        </select>
      </label>
      <label>
        Release status
        <select
          value={q.status ?? ""}
          onChange={(e) =>
            update({
              status: (e.target.value || undefined) as ProductQuery["status"],
            })
          }
        >
          <option value="">Any status</option>
          {["announced", "airing", "released", "ended", "unavailable"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </label>
    </div>
  );
  return (
    <>
      <SearchSuggestions
        value={draft}
        onChange={(value) => {
          setDraft(value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => update({ q: value.trim() }), 350);
        }}
        onSearch={(value) => {
          if (timer.current) clearTimeout(timer.current);
          update({ q: value });
        }}
        onNavigate={() => {
          if (timer.current) clearTimeout(timer.current);
          setDraft(q.q);
        }}
      />
      <div className="product-tabs" aria-label="Discover categories">
        {(["titles", "collections", "people"] as const).map((tab) => (
          <button
            key={tab}
            aria-current={q.tab === tab ? "page" : undefined}
            onClick={() => update({ tab })}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      {q.tab === "titles" && (
        <>
          <div className="category-pills" aria-label="Entertainment category">
            <button
              aria-pressed={!q.category}
              className={!q.category ? "active" : ""}
              onClick={() => update({ category: undefined })}
            >
              All worlds
            </button>
            {categories.map((c) => (
              <button
                key={c.value}
                aria-pressed={q.category === c.value}
                className={q.category === c.value ? "active" : ""}
                onClick={() =>
                  update({
                    category: q.category === c.value ? undefined : c.value,
                  })
                }
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="catalog-toolbar">
            <button
              className={`button button-secondary ${active ? "has-filters" : ""}`}
              onClick={() => setFilters(true)}
            >
              <SlidersHorizontal size={16} />
              Filters {active > 0 && <span>{active}</span>}
            </button>
            {active > 0 && (
              <button className="text-link" onClick={clearFilters}>
                Clear filters
              </button>
            )}
            <label className="sort-control">
              Sort by
              <select
                value={q.sort}
                onChange={(e) =>
                  update({ sort: e.target.value as ProductQuery["sort"] })
                }
              >
                <option value="popular">Popularity</option>
                <option value="year">Newest releases</option>
                <option value="title">Title A–Z</option>
                <option value="added">Recently added</option>
              </select>
            </label>
          </div>
        </>
      )}
      {gated ? (
        <QuietEmpty
          title="Good taste is better shared."
          description="Sign in to explore published collections and meet their creators."
          action={{
            label: "Continue with Google",
            href: `/login?${new URLSearchParams({ next: productHref(q) })}`,
          }}
        />
      ) : q.tab === "titles" ? (
        <>
          <InfiniteTitleFeed
            source="catalog"
            query={q}
            initial={
              matchesInitial && "nextCursor" in initial ? initial : undefined
            }
            layout="grid"
            label="Discover titles"
          />
          {bootstrap.userId && (
            <div className="request-title-line">
              <span>Missing a story you love?</span>
              <button className="text-link" onClick={() => setRequest(true)}>
                Request a title
              </button>
            </div>
          )}
        </>
      ) : (
        <CommunityResults
          q={q}
          initial={matchesInitial && "hasMore" in initial ? initial : undefined}
          onPage={(page) => update({ page })}
        />
      )}
      <ProductDialog
        open={filters}
        onOpenChange={setFilters}
        title="Advanced filters"
        description="Refine by genre, year, country, language or community rating. Changes are reflected in the address."
        className="dialog-medium"
      >
        <div className="dialog-body">
          {lookups.isError && (
            <p className="form-error">
              Filter options are unavailable. You can still search by title.
            </p>
          )}
          {filterFields}
          <div className="dialog-actions">
            <button className="button button-secondary" onClick={clearFilters}>
              Reset
            </button>
            <button
              className="button button-primary"
              onClick={() => setFilters(false)}
            >
              Show stories
            </button>
          </div>
        </div>
      </ProductDialog>
      <RequestTitleDialog open={request} onOpenChange={setRequest} />
    </>
  );
}
function CommunityResults({
  q,
  initial,
  onPage,
}: {
  q: ProductQuery;
  initial?: CatalogResult;
  onPage: (page: number) => void;
}) {
  const { bootstrap } = useProduct();
  const query = useQuery({
    queryKey: ["catalog", bootstrap.userId, q],
    queryFn: ({ signal }) => fetchData<CatalogResult>("catalog", q, signal),
    initialData: initial,
  });
  if (query.isPending) return <LoadingGrid />;
  if (query.isError)
    return (
      <div className="inline-error">
        <p>{query.error.message}</p>
        <button
          className="button button-secondary"
          onClick={() => query.refetch()}
        >
          Try again
        </button>
      </div>
    );
  if (query.data.availability !== "ready")
    return <DataNotice state={query.data.availability} />;
  return (
    <>
      <p className="catalog-result-summary" role="status">
        {q.tab === "collections"
          ? `${query.data.collections?.length ?? 0} collections on this page`
          : `${query.data.people?.length ?? 0} creators on this page`}
        {query.isFetching && " · Updating…"}
      </p>
      {q.tab === "collections" ? (
        <div className="product-collection-grid">
          {query.data.collections?.map((c) => (
            <CollectionCard key={c.record.id} view={c} />
          ))}
          {!query.data.collections?.length && (
            <QuietEmpty
              title="A little quiet here."
              description="No published collections match your search."
            />
          )}
        </div>
      ) : (
        <div className="people-grid">
          {query.data.people?.map((p) => (
            <Link
              className="person-card"
              key={p.id}
              href={`/people/${p.username || p.id}`}
            >
              <span className="avatar">
                {p.display_name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h3>{p.display_name}</h3>
                {p.username && <span>@{p.username}</span>}
                <p>{p.bio}</p>
              </div>
            </Link>
          ))}
          {!query.data.people?.length && (
            <QuietEmpty
              title="No creators found."
              description="Try searching for a different name."
            />
          )}
        </div>
      )}
      <Pagination page={q.page} hasMore={query.data.hasMore} onPage={onPage} />
    </>
  );
}
export function Pagination({
  page,
  hasMore,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  onPage: (p: number) => void;
}) {
  return page > 1 || hasMore ? (
    <nav className="pagination" aria-label="Results pages">
      <button
        className="button button-secondary"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ArrowLeft size={16} />
        Previous
      </button>
      <span>Page {page}</span>
      <button
        className="button button-secondary"
        disabled={!hasMore}
        onClick={() => onPage(page + 1)}
      >
        Next
        <ArrowRight size={16} />
      </button>
    </nav>
  ) : null;
}
export function LoadingGrid() {
  return (
    <div
      className="product-title-grid"
      role="status"
      aria-label="Loading stories"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div className="loading-title" key={i}>
          <span />
          <span />
          <span className="skeleton-metadata" />
        </div>
      ))}
    </div>
  );
}
