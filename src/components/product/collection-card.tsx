"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Heart } from "lucide-react";
import { interactCollection } from "@/app/actions/collections";
import { useProduct, unwrap, useInvalidateProduct } from "./providers";
import { Lock, Globe } from "lucide-react";
import { CollectionCollage } from "./collection-collage";
import type { CollectionView } from "@/types/product";
export function assetUrl(kind: "avatar" | "collection-cover", path: string) {
  return `/api/assets/${kind === "avatar" ? "scenestack-avatars" : "scenestack-collection-covers"}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
export function CollectionCard({
  view,
  feed = false,
}: {
  view: CollectionView;
  feed?: boolean;
}) {
  const { toast, online } = useProduct();
  const invalidate = useInvalidateProduct();
  const [favorite, setFavorite] = useState(view.favorite),
    [pending, setPending] = useState(false);
  const c = view.record;
  return (
    <article className="real-collection-card">
      <Link
        href={`/collections/${c.id}`}
        className="collection-cover"
        aria-label={`Open ${c.title}`}
      >
        {c.cover_path ? (
          <Image
            unoptimized
            src={assetUrl("collection-cover", c.cover_path)}
            alt=""
            fill
            sizes="(max-width:600px) 90vw, 350px"
          />
        ) : (
          <CollectionCollage posters={view.posters} />
        )}
        <span className="collection-visibility">
          {c.visibility === "private" ? (
            <Lock size={12} />
          ) : (
            <Globe size={12} />
          )}{" "}
          {c.visibility === "private" ? "Private" : "Published"}
        </span>
      </Link>
      <div className="collection-card-copy">
        <Link href={`/collections/${c.id}`}>
          <h3>{c.title}</h3>
        </Link>
        <p>
          {c.spoiler_warning
            ? "Spoiler protection · Reveal the collection to read more."
            : c.description ||
              `${view.count} ${view.count === 1 ? "title" : "titles"} · A universe of its own`}
        </p>
        <div className="collection-card-meta">
          <Link href={`/people/${view.creator?.username || c.owner_id}`}>
            {view.creator?.display_name || "Member"}
          </Link>
          <span>{view.count} titles</span>
        </div>
        {feed && (
          <div className="feed-card-footer">
            <time dateTime={c.published_at ?? undefined}>
              {c.published_at
                ? new Date(c.published_at).toLocaleDateString("en-GB", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })
                : "Publication date unavailable"}
            </time>
            <button
              aria-label={
                favorite ? "Unfavorite collection" : "Favorite collection"
              }
              aria-pressed={favorite}
              disabled={pending || !online}
              onClick={async () => {
                const before = favorite;
                setFavorite(!before);
                setPending(true);
                try {
                  unwrap(
                    await interactCollection({
                      id: c.id,
                      kind: "favorite",
                      enabled: !before,
                    }),
                  );
                  await invalidate();
                  toast(
                    before
                      ? "Collection unfavorited."
                      : "Collection favorited.",
                  );
                } catch (e) {
                  setFavorite(before);
                  toast(
                    e instanceof Error ? e.message : "Please try again.",
                    true,
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              <Heart size={16} fill={favorite ? "currentColor" : "none"} />
            </button>
          </div>
        )}
        {view.sourceCreator && (
          <small>
            Imported from @
            {view.sourceCreator.username || view.sourceCreator.display_name}
          </small>
        )}
        {view.sourceDeleted && <small>Imported from a former member</small>}
      </div>
    </article>
  );
}
