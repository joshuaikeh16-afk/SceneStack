"use client";
import Image from "next/image";
import { assetUrl } from "./collection-card";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Plus, Lock, Globe, Check } from "lucide-react";
import { ProductDialog } from "./dialog";
import { CreateCollectionDialog } from "./create-collection";
import {
  fetchData,
  unwrap,
  useProduct,
  useInvalidateProduct,
} from "./providers";
import { addTitlesToCollections } from "@/app/actions/collections";
import type { CollectionView } from "@/types/product";
export function CollectionPicker({
  open,
  onOpenChange,
  titleIds,
  titleName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titleIds: string[];
  titleName?: string;
}) {
  const { bootstrap, toast, online } = useProduct();
  const invalidate = useInvalidateProduct();
  const [selected, setSelected] = useState<string[]>([]),
    [creating, setCreating] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["collections", bootstrap.userId, "picker", titleIds.join(",")],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchData<CollectionView[]>(
        "own-collections",
        { page: pageParam, ids: titleIds.join(",") },
        signal,
      ),
    getNextPageParam: (last, pages) =>
      last.length === 50 ? pages.length + 1 : undefined,
    enabled: open && !!bootstrap.userId && bootstrap.availability === "ready",
  });
  return (
    <>
      <ProductDialog
        open={open && !creating}
        onOpenChange={(v) => {
          if (!pending) onOpenChange(v);
        }}
        title="Add to a collection"
        description={
          titleName
            ? `Find a home for ${titleName}.`
            : `Add ${titleIds.length} titles to your collections.`
        }
        className="dialog-medium"
      >
        <div className="dialog-body">
          <button
            className="collection-picker-new"
            onClick={() => setCreating(true)}
          >
            <Plus size={21} />
            <span>Create a new collection</span>
          </button>
          {query.isPending && <p role="status">Loading your collections…</p>}
          {query.isError && (
            <div className="inline-error">
              <p>{query.error.message}</p>
              <button onClick={() => query.refetch()}>Try again</button>
            </div>
          )}
          <div className="collection-picker-list">
            {query.data?.pages.flat().map((v) => (
              <label key={v.record.id}>
                <input
                  type="checkbox"
                  disabled={
                    v.selectedTitleCount === titleIds.length ||
                    (!selected.includes(v.record.id) && selected.length >= 50)
                  }
                  checked={selected.includes(v.record.id)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, v.record.id]
                        : old.filter((id) => id !== v.record.id),
                    )
                  }
                />
                <span className="picker-collection-icon">
                  {v.record.cover_path || v.posters[0] ? (
                    <Image
                      unoptimized={!!v.record.cover_path}
                      src={
                        v.record.cover_path
                          ? assetUrl("collection-cover", v.record.cover_path)
                          : v.posters[0]!
                      }
                      alt=""
                      fill
                      sizes="42px"
                    />
                  ) : v.record.visibility === "private" ? (
                    <Lock size={19} />
                  ) : (
                    <Globe size={19} />
                  )}
                </span>
                <span>
                  <strong>{v.record.title}</strong>
                  <small>
                    {v.selectedTitleCount === titleIds.length
                      ? "Already added · "
                      : v.selectedTitleCount
                        ? `${v.selectedTitleCount} selected titles already inside · `
                        : ""}
                    {v.count} titles ·{" "}
                    {v.record.visibility === "private"
                      ? "Private"
                      : "Published"}
                  </small>
                </span>
                {selected.includes(v.record.id) && <Check size={18} />}
              </label>
            ))}
          </div>
          {query.data?.pages[0]?.length === 0 && (
            <p className="muted-copy">
              Start a collection above. Your selected title will come with you.
            </p>
          )}
          {query.hasNextPage && (
            <button
              className="text-link"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              Load more collections
            </button>
          )}
          <p className="form-error" role="alert">
            {error}
          </p>
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={!selected.length || pending || !online}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  unwrap(
                    await addTitlesToCollections({
                      collectionIds: selected,
                      titleIds,
                    }),
                  );
                  await invalidate();
                  toast(
                    "Added to your collections. Existing titles were kept once.",
                  );
                  onOpenChange(false);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Please try again.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Adding…" : "Add selected"}
            </button>
          </div>
        </div>
      </ProductDialog>
      <CreateCollectionDialog
        key={creating ? "creating" : "closed"}
        open={creating}
        onOpenChange={setCreating}
        titleIds={titleIds}
        navigate={false}
        onCreated={() => {
          void query.refetch();
        }}
      />
    </>
  );
}
