"use client";
import Link from "next/link";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useProduct, fetchData, unwrap } from "./providers";
import { clearDiscoveryHistory } from "@/app/actions/discovery";
import { CollectionCard } from "./collection-card";
import { InfiniteTitleFeed } from "./infinite-title-feed";
import type { CollectionView, TitleFeedPage } from "@/types/product";

export function ContinueExploring() {
  const { bootstrap, toast } = useProduct();
  const client = useQueryClient();
  const ready = !!bootstrap.userId && bootstrap.availability === "ready";
  const recentCollections = useQuery({
    queryKey: ["collections", bootstrap.userId, "recent"],
    queryFn: ({ signal }) =>
      fetchData<CollectionView[]>("recent-collections", {}, signal),
    enabled: ready,
  });
  const clearViewed = useMutation({
    mutationFn: async (userId: string) => {
      unwrap(await clearDiscoveryHistory("viewed"));
      return userId;
    },
    onSuccess: async (userId) => {
      const recent = { queryKey: ["continue", userId, "title-feed", "recent"] };
      await client.cancelQueries(recent);
      client.setQueriesData<InfiniteData<TitleFeedPage>>(recent, (data) =>
        data
          ? {
              pageParams: [null],
              pages: [
                {
                  availability: "ready",
                  titles: [],
                  offset: 0,
                  nextCursor: null,
                  previousCursor: null,
                },
              ],
            }
          : undefined,
      );
      toast("Recently viewed history cleared.");
    },
    onError: (error) => toast(error.message, true),
  });

  if (!ready) return null;
  return (
    <>
      <InfiniteTitleFeed
        source="recent"
        layout="rail"
        query={{ limit: 12 }}
        label="Recently viewed"
        heading={
          <div className="shelf-heading">
            <div>
              <p className="eyebrow">ONLY YOU</p>
              <h2>Recently viewed</h2>
            </div>
            <button
              type="button"
              className="text-link"
              disabled={clearViewed.isPending}
              onClick={() =>
                bootstrap.userId && clearViewed.mutate(bootstrap.userId)
              }
            >
              {clearViewed.isPending ? "Clearing history…" : "Clear history"}
            </button>
          </div>
        }
      />
      <InfiniteTitleFeed
        source="planned"
        layout="rail"
        query={{ limit: 12 }}
        label="On your horizon"
        heading={
          <div className="shelf-heading">
            <div>
              <p className="eyebrow">PLANNED</p>
              <h2>On your horizon</h2>
            </div>
            <Link href="/library">My Library →</Link>
          </div>
        }
      />
      {!!recentCollections.data?.length && (
        <section className="product-shelf">
          <div className="shelf-heading">
            <h2>Your recent collections</h2>
            <Link href="/library">My Library →</Link>
          </div>
          <div className="product-collection-grid">
            {recentCollections.data.map((collection) => (
              <CollectionCard key={collection.record.id} view={collection} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function FollowedCreatorsFeed() {
  const { bootstrap } = useProduct();
  const query = useInfiniteQuery({
    queryKey: ["feed", bootstrap.userId],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchData<CollectionView[]>("feed", { page: pageParam }, signal),
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length + 1 : undefined,
    enabled: !!bootstrap.userId && bootstrap.availability === "ready",
  });
  const rows = query.data?.pages.flat() ?? [];
  if (!rows.length) return null;
  return (
    <section className="product-shelf">
      <div className="shelf-heading">
        <div>
          <p className="eyebrow">FROM THE CREATORS YOU FOLLOW</p>
          <h2>A new world to step into.</h2>
        </div>
      </div>
      <div className="product-collection-grid">
        {rows.map((c) => (
          <CollectionCard key={c.record.id} view={c} feed />
        ))}
      </div>
      {query.hasNextPage && (
        <button
          className="button button-secondary load-more"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          More from creators
        </button>
      )}
    </section>
  );
}
