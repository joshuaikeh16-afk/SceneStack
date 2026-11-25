"use client";
import {
  hashKey,
  useInfiniteQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  productQuerySchema,
  type ProductQuery,
} from "@/lib/product/validation";
import type { TitleFeedPage, TitleFeedSource } from "@/types/product";
import { DataNotice, QuietEmpty } from "./availability";
import { DataRequestError, fetchData, useProduct } from "./providers";
import { feedRequests } from "./feed-requests";
import { FeedTrack } from "./feed-track";
import { TitleCard } from "./product-title-card";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  source: TitleFeedSource;
  layout: "rail" | "grid";
  label: string;
  query?: Partial<ProductQuery>;
  initial?: TitleFeedPage;
  heading?: ReactNode;
};

const families = {
  catalog: "catalog",
  recent: "continue",
  watching: "library",
  planned: "library",
  recommendations: "recommendations",
} as const;
const positions = new WeakMap<object, number>();
const PosterCard = memo(TitleCard);

export function InfiniteTitleFeed(props: Props) {
  const { bootstrap } = useProduct();
  const { source, layout } = props;
  const scope = source === "catalog" ? "public" : bootstrap.userId;
  const query = productQuerySchema.parse({
    limit: layout === "rail" ? 12 : 24,
    ...props.query,
  });
  const queryKey = [
    families[source],
    scope,
    "title-feed",
    source,
    layout,
    query,
  ];
  if (!scope) return null;
  return (
    <Feed
      key={hashKey(queryKey)}
      {...props}
      query={query}
      queryKey={queryKey}
    />
  );
}

function Feed({
  source,
  layout,
  label,
  heading,
  query,
  initial,
  queryKey,
}: Props & {
  query: ProductQuery;
  queryKey: QueryKey;
}) {
  const client = useQueryClient();
  const region = useRef<HTMLDivElement>(null);
  const track = useRef<FeedTrack>(null);
  const emptySentinel = useRef<HTMLDivElement>(null);
  const rail = layout === "rail";
  const [inView, setInView] = useState(!rail || !!initial);
  useEffect(() => {
    if (inView || !region.current) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { rootMargin: "450px 0px" },
    );
    observer.observe(region.current);
    return () => observer.disconnect();
  }, [inView]);

  const feed = useInfiniteQuery({
    queryKey,
    enabled: inView,
    initialPageParam: null as string | null,
    initialData: initial ? { pages: [initial], pageParams: [null] } : undefined,
    queryFn: ({ pageParam, signal }) =>
      feedRequests(client).run(signal, async () => {
        const page = await fetchData<TitleFeedPage>(
          "title-feed",
          {
            ...query,
            source,
            cursor: pageParam ?? undefined,
          },
          signal,
        );
        if (page.availability !== "ready" && pageParam)
          throw new Error("These titles couldn’t be loaded. Please try again.");
        return page;
      }),
    getNextPageParam: (last, _pages, _param, params) =>
      last.nextCursor && !params.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
    getPreviousPageParam: (first, _pages, _param, params) =>
      first.previousCursor && !params.includes(first.previousCursor)
        ? first.previousCursor
        : undefined,
    maxPages: 12,
    staleTime: 3 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const pages = feed.data?.pages;
  const titles = useMemo(() => {
    const seen = new Set<string>();
    return (pages || []).flatMap((page) =>
      page.titles.filter((title) => {
        if (seen.has(title.id)) return false;
        seen.add(title.id);
        return true;
      }),
    );
  }, [pages]);
  const ids = useMemo(() => titles.map((title) => title.id), [titles]);
  const lastPage = pages?.at(-1);
  const pageIssues = lastPage?.issues ?? [];
  const stalledPages = useMemo(() => {
    const known = new Set<string>();
    let stalled = 0;
    for (const page of pages ?? []) {
      const fresh = page.titles.some((title) => !known.has(title.id));
      stalled = fresh ? 0 : stalled + 1;
      for (const title of page.titles) known.add(title.id);
    }
    return stalled;
  }, [pages]);
  const [resumeAt, setResumeAt] = useState(0);
  const autoPaused = stalledPages - resumeAt >= 3;
  const identity = hashKey(queryKey);
  useEffect(() => {
    // Bound the number of inactive search/filter combinations as well as the
    // number of pages per combination. Query collection also releases its scroll mark.
    const dormant = client
      .getQueryCache()
      .findAll({
        type: "inactive",
        predicate: (q) => q.queryKey[2] === "title-feed",
      })
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
    for (const entry of dormant.slice(16)) client.getQueryCache().remove(entry);
  }, [identity, client]);

  const ready = !!titles.length;
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const element = track.current?.track.current;
    if (!rail || !element) return;
    const measure = () => {
      const start = element.scrollLeft < 4;
      const end =
        element.scrollLeft + element.clientWidth >= element.scrollWidth - 4;
      setEdges((old) =>
        old.start === start && old.end === end ? old : { start, end },
      );
    };
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [rail, titles, feed.isFetching]);
  function move(direction: -1 | 1) {
    const element = track.current?.track.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.85,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  useLayoutEffect(() => {
    const element = track.current?.track.current;
    const entry = client.getQueryCache().get(identity);
    if (!ready || !element || !entry) return;
    const target = rail ? element : window;
    const saved = positions.get(entry);
    if (saved !== undefined) {
      if (rail) element.scrollTo({ left: saved, behavior: "instant" });
      else if (window.scrollY !== saved)
        window.scrollTo({ top: saved, behavior: "instant" });
    }
    const save = () => {
      if (!document.body.dataset.modalCount)
        positions.set(entry, rail ? element.scrollLeft : window.scrollY);
    };
    target.addEventListener("scroll", save, { passive: true });
    element.addEventListener("click", save, true);
    return () => {
      target.removeEventListener("scroll", save);
      element.removeEventListener("click", save, true);
    };
  }, [identity, client, rail, ready]);

  const {
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetching,
    isError,
  } = feed;
  useEffect(() => {
    const element = track.current?.track.current;
    if (
      (!element && !emptySentinel.current) ||
      isFetching ||
      isError ||
      pageIssues.length ||
      autoPaused ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    // The first and last posters are the sentinels. They occupy normal card
    // slots, so adding a sentinel never creates a blank column or grid row.
    const first = element?.querySelector("[data-title-id]");
    const last =
      element?.querySelector("[data-title-id]:last-of-type") ??
      emptySentinel.current;
    if (!last || (!hasNextPage && !hasPreviousPage)) return;
    let live = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!live || document.body.dataset.modalCount) return;
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (hasNextPage && visible.some((entry) => entry.target === last))
          void fetchNextPage({ cancelRefetch: false });
        else if (
          hasPreviousPage &&
          visible.some((entry) => entry.target === first)
        )
          void fetchPreviousPage({ cancelRefetch: false });
      },
      {
        root: rail && element ? element : null,
        rootMargin: rail ? "0px 180px" : "340px 0px",
      },
    );
    const observe = () => {
      observer.disconnect();
      if (document.body.dataset.modalCount) return;
      if (hasNextPage) observer.observe(last);
      if (hasPreviousPage && first) observer.observe(first);
    };
    observe();
    const dialogs = new MutationObserver(observe);
    dialogs.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-modal-count"],
    });
    return () => {
      live = false;
      dialogs.disconnect();
      observer.disconnect();
    };
  }, [
    titles,
    rail,
    isError,
    isFetching,
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    pageIssues.length,
    autoPaused,
  ]);

  const availability = pages?.[0]?.availability;
  const empty =
    !ready &&
    availability === "ready" &&
    !isFetching &&
    !isError &&
    !hasNextPage;
  if (rail && empty) return null;
  const retry = () => {
    setResumeAt(stalledPages);
    if (feed.error instanceof DataRequestError && feed.error.status === 400) {
      void client.resetQueries({ queryKey, exact: true });
      return;
    }
    if (pageIssues.length || feed.isFetchNextPageError)
      void fetchNextPage({ cancelRefetch: false });
    else if (feed.isFetchPreviousPageError)
      void fetchPreviousPage({ cancelRefetch: false });
    else void feed.refetch({ cancelRefetch: false });
  };
  const initialLoading = !pages && !isError;
  const failed = isError || (!!availability && availability !== "ready");
  const content = (
    <>
      {rail ? (
        <div className="rail-heading">
          {heading}
          <div
            className="rail-controls"
            role="group"
            aria-label={`${label} scroll controls`}
          >
            <button
              className="icon-button"
              type="button"
              aria-label={`Scroll ${label} left`}
              disabled={edges.start}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={`Scroll ${label} right`}
              disabled={edges.end}
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : (
        heading
      )}
      {hasPreviousPage && (
        <button
          className="text-link feed-previous"
          disabled={isFetching || failed}
          onClick={() => void fetchPreviousPage({ cancelRefetch: false })}
        >
          Load earlier titles
        </button>
      )}
      {(ready || initialLoading) && (
        <FeedTrack ref={track} layout={layout} label={label} ids={ids}>
          {feed.isFetchingPreviousPage && <Skeletons count={rail ? 3 : 6} />}
          {titles.map((view) => (
            <PosterCard key={view.id} view={view} title={view.title} />
          ))}
          {(initialLoading || feed.isFetchingNextPage) && (
            <Skeletons count={initialLoading ? query.limit : rail ? 3 : 6} />
          )}
        </FeedTrack>
      )}
      {availability && availability !== "ready" && (
        <DataNotice state={availability} compact={rail} />
      )}
      {!ready && hasNextPage && (
        <div
          ref={emptySentinel}
          className="feed-empty-sentinel"
          aria-hidden="true"
        />
      )}
      {pageIssues.length > 0 && (
        <div className="feed-error" role="alert">
          <span>{pageIssues.map((issue) => issue.message).join(" ")}</span>
          <button
            className="button button-secondary"
            disabled={isFetching}
            onClick={retry}
          >
            Retry
          </button>
        </div>
      )}
      {failed && (
        <Retry
          key={feed.errorUpdatedAt}
          error={feed.error}
          retry={retry}
          busy={isFetching}
        />
      )}
      {!rail && empty && (
        <QuietEmpty
          title="No matching titles"
          description="Try another search or adjust your filters."
        />
      )}
      <div role="status" aria-live="polite" className="feed-status">
        {(initialLoading || isFetching) && (
          <span className="sr-only">
            {ready ? "Loading more titles" : "Loading titles"}
          </span>
        )}
        {!rail &&
          ready &&
          !hasNextPage &&
          !failed &&
          !isFetching &&
          (lastPage?.catalog?.terminal === "cache_only"
            ? "Only cached matches are available. External discovery is disabled or unavailable for these filters."
            : lastPage?.catalog?.terminal === "pagination_limit"
              ? "The provider’s accessible page limit has been reached. Try a search or narrower filters."
              : "You’ve reached the end of these results.")}
        {autoPaused &&
          hasNextPage &&
          !failed &&
          "These pages had no new matches. Load more to continue searching."}
      </div>
      {hasNextPage && !failed && (
        <button
          type="button"
          className="text-link feed-more"
          disabled={isFetching}
          onClick={() => {
            setResumeAt(stalledPages);
            void fetchNextPage({ cancelRefetch: false });
          }}
        >
          Load more titles
        </button>
      )}
    </>
  );
  return rail ? (
    <section ref={region} className="product-shelf infinite-feed feed-rail">
      {content}
    </section>
  ) : (
    <div ref={region} className="infinite-feed feed-grid">
      {content}
    </div>
  );
}

function Skeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="loading-title" aria-hidden="true">
      <span />
      <span />
      <span className="skeleton-metadata" />
    </div>
  ));
}

function Retry({
  error,
  retry,
  busy,
}: {
  error: Error | null;
  retry: () => void;
  busy: boolean;
}) {
  const retryAt = error instanceof DataRequestError ? error.retryAt : 0;
  const [waiting, setWaiting] = useState(() => retryAt > Date.now());
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(
      () => setWaiting(false),
      Math.max(0, retryAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [retryAt, waiting]);
  return (
    <div className="feed-error" role="alert">
      <span>
        {waiting
          ? "Requests are paused briefly. Retry will be available shortly."
          : error?.message || "Try loading these titles again."}
      </span>
      <button
        className="button button-secondary"
        disabled={waiting || busy}
        onClick={retry}
      >
        {error instanceof DataRequestError && error.status === 400
          ? "Restart results"
          : "Retry"}
      </button>
    </div>
  );
}
