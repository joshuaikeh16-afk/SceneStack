"use client";
import Link from "next/link";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useProduct, fetchData, unwrap } from "./providers";
import { readNotifications } from "@/app/actions/profile";
import { ProductDialog } from "./dialog";
import type { NotificationView } from "@/types/product";
export function Notifications({ page = false }: { page?: boolean }) {
  const { bootstrap, toast, online } = useProduct();
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false);
  const client = useQueryClient();
  const key = ["notifications", bootstrap.userId];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchData<{
        items: NotificationView[];
        unread: number;
        hasMore: boolean;
      }>("notifications", { page: pageParam }, signal),
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length + 1 : undefined,
    enabled: !!bootstrap.userId && bootstrap.availability === "ready",
    refetchInterval: 60000,
  });
  const unread = query.data?.pages[0]?.unread ?? 0;
  async function mark(ids: string[] = [], all = false) {
    if (!navigator.onLine) return;
    setPending(true);
    try {
      unwrap(await readNotifications({ ids, all }));
      await client.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Please try again.", true);
    } finally {
      setPending(false);
    }
  }
  const content = (
    <div className="notification-content">
      <div className="notification-toolbar">
        <span>{unread} unread</span>
        <button
          className="text-link"
          disabled={pending || !unread || !online}
          onClick={() => mark([], true)}
        >
          <CheckCheck size={15} />
          Mark all read
        </button>
      </div>
      {bootstrap.availability !== "ready" ? (
        <p className="muted-copy">
          Notifications will be available after the database is connected.
        </p>
      ) : query.isPending ? (
        <p role="status">Loading your updates…</p>
      ) : query.isError ? (
        <div className="inline-error">
          <p>{query.error.message}</p>
          <button onClick={() => query.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          <ul className="notification-list">
            {query.data?.pages
              .flatMap((p) => p.items)
              .map((n) => {
                const actor = n.actor?.display_name || "A member";
                const message =
                  n.kind === "new_follower"
                    ? `${actor} followed you.`
                    : n.kind === "collection_favorite"
                      ? `${actor} favorited ${n.collectionTitle || "your collection"}.`
                      : `${actor} published ${n.collectionTitle || "a collection"}.`;
                const href =
                  n.collection_id && n.collectionTitle
                    ? `/collections/${n.collection_id}`
                    : n.actor
                      ? `/people/${n.actor.username || n.actor.id}`
                      : null;
                return (
                  <li key={n.id} className={!n.read_at ? "unread" : ""}>
                    <div>
                      {href ? (
                        <Link
                          href={href}
                          onClick={() => {
                            setOpen(false);
                            void mark([n.id]);
                          }}
                        >
                          {message}
                        </Link>
                      ) : (
                        <p>{message}</p>
                      )}
                      <time dateTime={n.created_at}>
                        {new Date(n.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </time>
                    </div>
                    {!n.read_at && (
                      <button
                        className="notification-dot"
                        aria-label={`Mark notification from ${actor} as read`}
                        disabled={pending || !online}
                        onClick={() => mark([n.id])}
                      />
                    )}
                  </li>
                );
              })}
          </ul>
          {!query.data?.pages[0].items.length && (
            <div className="notification-empty">
              <Bell size={26} />
              <h3>Your quiet corner.</h3>
              <p>
                Real updates from creators and collections will arrive here.
              </p>
            </div>
          )}
          {query.hasNextPage && (
            <button
              className="button button-secondary"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              Older updates
            </button>
          )}
        </>
      )}
      <Link
        className="text-link notification-settings"
        href="/settings#notifications"
        onClick={() => setOpen(false)}
      >
        Notification preferences →
      </Link>
    </div>
  );
  return page ? (
    content
  ) : (
    <>
      <button
        className="icon-button notification-trigger"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bell size={19} />
        {unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
      </button>
      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        title="A little from your universe."
        className="dialog-medium"
      >
        {content}
      </ProductDialog>
    </>
  );
}
