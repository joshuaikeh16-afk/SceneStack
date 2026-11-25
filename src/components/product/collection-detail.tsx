"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  Heart,
  Bookmark,
  Copy,
  Flag,
  Globe,
  Lock,
  Layers3,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import type { CollectionDetails } from "@/types/product";
import {
  fetchData,
  unwrap,
  useProduct,
  useInvalidateProduct,
} from "./providers";
import {
  editPersonalCollection,
  deletePersonalCollection,
  addTitlesToCollections,
  editCollectionItem,
  moveCollectionItem,
  sortCollection,
  interactCollection,
  importPersonalCollection,
} from "@/app/actions/collections";
import { CollectionCollage } from "./collection-collage";
import { EditCollectionDialog } from "./collection-editor";
import { ProductDialog } from "./dialog";
import { Confirmation } from "./confirmation";
import { TitleSelector } from "./title-selector";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { rememberTitleTrigger } from "./dialog";
import { assetUrl } from "./collection-card";
import { ReportDialog } from "./submissions";
import { categories } from "@/config/categories";
import { SpoilerGate } from "./spoiler-gate";
import { QuietEmpty } from "./availability";
import { TitleCard } from "./product-title-card";

type Item = CollectionDetails["items"][number];
function EditableItem({
  item,
  owner,
  busy,
  onNote,
  onRemove,
  onMove,
  canReorder,
}: {
  item: Item;
  owner: boolean;
  busy: boolean;
  onNote: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  canReorder: boolean;
}) {
  const {
    isDragging,
    setNodeRef,
    transform,
    transition,
    attributes,
    listeners,
  } = useSortable({ id: item.id, disabled: !owner || !canReorder || busy });
  return (
    <li
      className={`collection-item-row ${isDragging ? "dragging" : ""}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {owner && (
        <button
          className="drag-handle"
          aria-label={`Reorder ${item.title.title.name}`}
          disabled={!canReorder || busy}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={19} />
        </button>
      )}
      <Link
        className="collection-item-poster"
        href={`/titles/${item.title.id}`}
        scroll={false}
        onClick={(e) => rememberTitleTrigger(e.currentTarget)}
      >
        {item.title.title.posterUrl ? (
          <Image src={item.title.title.posterUrl} alt="" fill sizes="65px" />
        ) : (
          <Layers3 size={22} />
        )}
      </Link>
      <div className="collection-item-copy">
        <Link
          href={`/titles/${item.title.id}`}
          scroll={false}
          onClick={(e) => rememberTitleTrigger(e.currentTarget)}
        >
          <h3>{item.title.title.name}</h3>
        </Link>
        <p>
          {item.title.title.releaseYear ?? "Year unavailable"} ·{" "}
          {item.title.title.kind}
        </p>
        {item.note && <p className="creator-note">{item.note}</p>}
      </div>
      {owner && (
        <div className="item-editor-actions">
          <button
            disabled={busy || !canReorder}
            aria-label={`Move ${item.title.title.name} up`}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={16} />
          </button>
          <button
            disabled={busy || !canReorder}
            aria-label={`Move ${item.title.title.name} down`}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={16} />
          </button>
          <button
            disabled={busy}
            aria-label={`Edit note for ${item.title.title.name}`}
            onClick={onNote}
          >
            <Pencil size={16} />
          </button>
          <button
            disabled={busy}
            className="danger-text"
            aria-label={`Remove ${item.title.title.name} from collection`}
            onClick={onRemove}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </li>
  );
}
export function CollectionDetail({ initial }: { initial: CollectionDetails }) {
  const { bootstrap, toast, online } = useProduct();
  const client = useQueryClient();
  const invalidate = useInvalidateProduct();
  const router = useRouter();
  const [edit, setEdit] = useState(false),
    [arranging, setArranging] = useState(false),
    [add, setAdd] = useState(false),
    [deleting, setDeleting] = useState(false),
    [unpublishing, setUnpublishing] = useState(false),
    [publishing, setPublishing] = useState(false),
    [report, setReport] = useState(false);
  const [note, setNote] = useState<Item | null>(null),
    [removing, setRemoving] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState("");
  const [importRequest] = useState(() => crypto.randomUUID());
  const [revealed, setRevealed] = useState(false),
    [viewSort, setViewSort] = useState("manual"),
    [filterQuery, setFilterQuery] = useState(""),
    [filterCategory, setFilterCategory] = useState(""),
    [saveOrder, setSaveOrder] = useState(false);
  const canReorder = viewSort === "manual" && !filterQuery && !filterCategory;
  const key = [
    "collection",
    bootstrap.userId,
    initial.record.id,
    { revealed, viewSort, filterQuery, filterCategory },
  ];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchData<CollectionDetails | null>(
        "collection",
        {
          id: initial.record.id,
          offset: pageParam,
          reveal: revealed ? "1" : undefined,
          sort: viewSort,
          q: filterQuery,
          category: filterCategory || undefined,
        },
        signal,
      ),
    getNextPageParam: (last, pages) =>
      last?.hasMore ? pages.length * 48 : undefined,
    initialData:
      !revealed && canReorder
        ? { pages: [initial], pageParams: [0] }
        : undefined,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const data = query.data?.pages[0];
  if (!data && query.isPending)
    return (
      <div className="collection-view-loading" role="status">
        Opening this universe…
      </div>
    );
  if (!data && query.isError)
    return (
      <div className="inline-error" role="alert">
        <p>{query.error.message}</p>
        <button
          className="button button-secondary"
          onClick={() => query.refetch()}
        >
          Try again
        </button>
      </div>
    );
  if (!data)
    return (
      <QuietEmpty
        title="This collection isn’t available."
        description="It may have been made private or removed."
        action={{
          label: "Back to Discover",
          href: "/discover?tab=collections",
        }}
      />
    );
  if (data.spoilerGated)
    return (
      <SpoilerGate
        title={data.record.title}
        onReveal={() => setRevealed(true)}
        onBack={() => {
          if (window.history.length > 1) router.back();
          else router.push("/discover?tab=collections");
        }}
      />
    );
  const c = data.record,
    owner = c.owner_id === bootstrap.userId;
  const items = query.data!.pages.flatMap((p) => p?.items ?? []);
  const last = query.data!.pages.at(-1);
  async function run(work: () => Promise<unknown>, message: string) {
    if (!navigator.onLine) {
      toast("Reconnect to save collection changes.", true);
      return false;
    }
    setBusy(true);
    setError("");
    try {
      await work();
      await invalidate();
      toast(message);
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Please try again.";
      setError(message);
      toast(message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function move(
    itemId: string,
    beforeId: string | null,
    direction?: -1 | 1,
  ) {
    await run(
      async () =>
        unwrap(
          await moveCollectionItem({
            collectionId: c.id,
            version: c.version,
            itemId,
            beforeId,
            direction,
          }),
        ),
      "Collection order updated.",
    );
  }
  function dragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = items.findIndex((i) => i.id === event.active.id),
      to = items.findIndex((i) => i.id === event.over?.id);
    if (from < 0 || to < 0) return;
    void move(
      String(event.active.id),
      from < to
        ? (items[to + 1]?.id ?? last?.nextItemId ?? null)
        : items[to].id,
    );
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/collections/${c.id}`,
      );
      toast("Collection link copied. Members can open it after signing in.");
    } catch {
      toast("Copy this page’s address to share the collection.", true);
    }
  }
  const cover = c.cover_path
    ? assetUrl("collection-cover", c.cover_path)
    : null;
  return (
    <>
      <div className="collection-detail-header">
        <div className="collection-large-cover">
          {cover ? (
            <Image unoptimized src={cover} alt="" fill sizes="300px" />
          ) : (
            <CollectionCollage posters={data.posters} />
          )}
        </div>
        <div className="collection-heading-copy">
          <p className="eyebrow">
            {c.visibility === "private" ? (
              <Lock size={13} />
            ) : (
              <Globe size={13} />
            )}{" "}
            {c.visibility === "private"
              ? "YOUR PRIVATE COLLECTION"
              : "A COLLECTION WITH A POINT OF VIEW"}
          </p>
          <h1>{c.title}</h1>
          <p className="collection-description">{c.description}</p>
          <p className="collection-byline">
            By{" "}
            <Link href={`/people/${data.creator?.username || c.owner_id}`}>
              {data.creator?.display_name || "Member"}
            </Link>{" "}
            · {data.count} {data.count === 1 ? "title" : "titles"}
          </p>
          {data.sourceCreator && (
            <p className="muted-copy">
              Independent copy imported from @
              {data.sourceCreator.username || data.sourceCreator.display_name}.
            </p>
          )}
          {data.sourceDeleted && (
            <p className="muted-copy">
              Independent copy imported from a former member.
            </p>
          )}
          {c.spoiler_warning && (
            <p className="spoiler-warning">
              This collection contains spoilers.
            </p>
          )}
          <div className="collection-actions">
            {owner ? (
              <>
                <button
                  className="button button-primary"
                  onClick={() => setAdd(true)}
                >
                  <Plus size={17} />
                  Add titles
                </button>
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <button
                      className="button button-secondary"
                      aria-label="Manage collection"
                    >
                      <MoreHorizontal size={18} /> Manage
                    </button>
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Content
                      className="tracking-menu collection-management-menu"
                      align="end"
                      sideOffset={8}
                      collisionPadding={12}
                    >
                      <Menu.Label>Manage collection</Menu.Label>
                      <Menu.Item onSelect={() => setEdit(true)}>
                        <Pencil size={16} />
                        Edit collection
                      </Menu.Item>
                      <Menu.Item onSelect={() => setArranging(true)}>
                        <GripVertical size={16} />
                        Arrange titles & notes
                      </Menu.Item>
                      <Menu.Item
                        disabled={busy || !online}
                        onSelect={() =>
                          c.visibility === "published"
                            ? setUnpublishing(true)
                            : setPublishing(true)
                        }
                      >
                        <Globe size={16} />
                        {c.visibility === "published" ? "Unpublish" : "Publish"}
                      </Menu.Item>
                      {c.visibility === "published" && (
                        <Menu.Item onSelect={() => void copyLink()}>
                          <Share2 size={16} />
                          Copy collection link
                        </Menu.Item>
                      )}
                      <Menu.Separator />
                      <Menu.Item
                        className="destructive-menu-item"
                        onSelect={() => setDeleting(true)}
                      >
                        <Trash2 size={16} />
                        Delete collection
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
              </>
            ) : (
              <>
                <button
                  className={`button button-secondary ${data.favorite ? "is-favorite" : ""}`}
                  disabled={busy || !online}
                  aria-pressed={data.favorite}
                  onClick={() =>
                    void run(
                      async () => {
                        const previous = client.getQueryData(key);
                        client.setQueryData(
                          key,
                          (old: typeof query.data | undefined) =>
                            old
                              ? {
                                  ...old,
                                  pages: old.pages.map((p) =>
                                    p ? { ...p, favorite: !data.favorite } : p,
                                  ),
                                }
                              : old,
                        );
                        try {
                          unwrap(
                            await interactCollection({
                              id: c.id,
                              kind: "favorite",
                              enabled: !data.favorite,
                            }),
                          );
                        } catch (e) {
                          client.setQueryData(key, previous);
                          throw e;
                        }
                      },
                      data.favorite
                        ? "Collection unfavorited."
                        : "Collection favorited.",
                    )
                  }
                >
                  <Heart
                    size={17}
                    fill={data.favorite ? "currentColor" : "none"}
                  />
                  Favorite
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy || !online}
                  aria-pressed={data.saved}
                  onClick={() =>
                    void run(
                      async () =>
                        unwrap(
                          await interactCollection({
                            id: c.id,
                            kind: "save",
                            enabled: !data.saved,
                          }),
                        ),
                      data.saved
                        ? "Removed from saved collections."
                        : "Original collection saved.",
                    )
                  }
                >
                  <Bookmark size={17} />
                  {data.saved ? "Saved" : "Save original"}
                </button>
                <button
                  className="button button-primary"
                  disabled={busy || !online}
                  onClick={async () => {
                    await run(async () => {
                      const result = unwrap(
                        await importPersonalCollection({
                          id: c.id,
                          requestId: importRequest,
                        }),
                      );
                      if (result.id) router.push(`/collections/${result.id}`);
                    }, "Your private copy is ready.");
                  }}
                >
                  <Copy size={17} />
                  Import a copy
                </button>
                <button
                  className="icon-button"
                  aria-label="Copy collection link"
                  onClick={() => void copyLink()}
                >
                  <Share2 size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Report collection"
                  onClick={() => setReport(true)}
                >
                  <Flag size={17} />
                </button>
              </>
            )}
          </div>

          {owner && data.metrics && (
            <p className="collection-metrics">
              {data.metrics.favorites} favorites · {data.metrics.saves} saves ·{" "}
              {data.metrics.imports} imports
            </p>
          )}
          {!owner && (
            <p className="privacy-caption">
              Favorite shows appreciation. Save follows the original. Import
              makes your own private copy.
            </p>
          )}
        </div>
      </div>
      <div className="collection-content-toolbar">
        <h2>The stories inside</h2>
        {owner && (
          <button
            className="text-link collection-arrange-toggle"
            onClick={() => setArranging(!arranging)}
          >
            {arranging ? "Done editing" : "Arrange & add notes"}
          </button>
        )}
        <label className="sort-control">
          View
          <select
            value={viewSort}
            onChange={(e) => setViewSort(e.target.value)}
          >
            <option value="manual">Manual order</option>
            <option value="title">Alphabetical</option>
            <option value="year">Release year</option>
            <option value="added">Date added</option>
            <option value="category">Category</option>
            {owner && <option value="rating">My rating</option>}
          </select>
        </label>
      </div>
      <div className="collection-filter-tools">
        <label className="compact-search">
          <input
            aria-label="Filter collection titles"
            placeholder="Find a story in this collection"
            maxLength={120}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </label>
        <label className="selector-category">
          <span className="sr-only">Filter collection category</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {owner && viewSort !== "manual" && (
          <button
            className="button button-secondary"
            disabled={busy || !online}
            onClick={() => setSaveOrder(true)}
          >
            Save full collection order
          </button>
        )}
      </div>
      {owner && !canReorder && (
        <p className="privacy-caption">
          This view leaves your saved order unchanged. Use manual order without
          filters to rearrange titles.
        </p>
      )}
      <p className="form-error" role="alert">
        {error}
      </p>
      {owner && arranging ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={dragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="collection-item-list">
              {items.map((item) => (
                <EditableItem
                  key={item.id}
                  item={item}
                  owner={owner}
                  canReorder={canReorder}
                  busy={busy}
                  onNote={() => setNote(item)}
                  onRemove={() => setRemoving(item)}
                  onMove={(direction) => void move(item.id, null, direction)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="product-title-grid collection-title-grid">
          {items.map((item) => (
            <div key={item.id}>
              <TitleCard title={item.title.title} view={item.title} />
              {item.note && (
                <p className="collection-poster-note">{item.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {!items.length && (
        <div className="collection-empty-content">
          <QuietEmpty
            title="Every collection has a first story."
            description={
              owner
                ? "Add a few titles, then arrange them in your own way."
                : "The creator hasn’t added any titles yet."
            }
          />
          {owner && (
            <button
              className="button button-primary"
              onClick={() => setAdd(true)}
            >
              <Plus size={17} />
              Add Titles
            </button>
          )}
        </div>
      )}{" "}
      {query.hasNextPage && (
        <button
          className="button button-secondary load-more"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          Load more titles
        </button>
      )}
      {query.isError && (
        <p className="form-error" role="alert">
          {query.error.message}
        </p>
      )}
      <ProductDialog
        open={add}
        onOpenChange={setAdd}
        title="Make a little room."
        description="Choose titles to add. Titles already inside are kept once."
        className="dialog-wide"
      >
        <div className="dialog-body">
          <TitleSelector
            selected={selected}
            collectionId={c.id}
            onChange={setSelected}
            existing={items.map((i) => i.title.id)}
          />
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              onClick={() => setAdd(false)}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={busy || !selected.length || !online}
              onClick={async () => {
                if (
                  await run(
                    async () =>
                      unwrap(
                        await addTitlesToCollections({
                          collectionIds: [c.id],
                          titleIds: selected,
                        }),
                      ),
                    "Titles added to your collection.",
                  )
                ) {
                  setAdd(false);
                  setSelected([]);
                }
              }}
            >
              {busy ? "Adding…" : `Add ${selected.length || "selected"} titles`}
            </button>
          </div>
        </div>
      </ProductDialog>
      <EditCollectionDialog
        key={edit ? "open" : "closed"}
        data={data}
        open={edit}
        onOpenChange={setEdit}
      />
      <ProductDialog
        open={!!note}
        onOpenChange={(v) => {
          if (!v) setNote(null);
        }}
        title="A note from you."
        description={note?.title.title.name}
        className="dialog-small"
      >
        <form
          className="dialog-body product-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("note");
            if (
              note &&
              (await run(
                async () =>
                  unwrap(
                    await editCollectionItem({
                      collectionId: c.id,
                      version: c.version,
                      itemId: note.id,
                      note: value,
                    }),
                  ),
                "Creator note saved.",
              ))
            )
              setNote(null);
          }}
        >
          <label>
            Creator note
            <textarea
              key={note?.id}
              name="note"
              defaultValue={note?.note}
              maxLength={2000}
              rows={5}
            />
          </label>
          <button className="button button-primary" disabled={busy || !online}>
            Save note
          </button>
        </form>
      </ProductDialog>
      <Confirmation
        open={!!removing}
        onOpenChange={(v) => {
          if (!v) setRemoving(null);
        }}
        title="Remove this title from the collection?"
        description="Your library, rating, and favorite are kept."
        danger
        confirmLabel="Remove title"
        onConfirm={async () => {
          if (removing)
            unwrap(
              await editCollectionItem({
                collectionId: c.id,
                version: c.version,
                itemId: removing.id,
                remove: true,
              }),
            );
          await invalidate();
        }}
      />
      <Confirmation
        open={saveOrder}
        onOpenChange={setSaveOrder}
        title="Replace the saved order for this collection?"
        description="This applies the selected sort to the entire collection, including titles hidden by filters. Your previous manual order will be replaced."
        confirmLabel="Save this order"
        onConfirm={async () => {
          unwrap(
            await sortCollection({
              collectionId: c.id,
              version: c.version,
              sort:
                viewSort === "year"
                  ? "release_year"
                  : viewSort === "added"
                    ? "added_at"
                    : viewSort,
              descending: !["title", "category"].includes(viewSort),
            }),
          );
          await invalidate();
          toast("Collection order saved.");
        }}
      />
      <Confirmation
        open={publishing}
        onOpenChange={setPublishing}
        title="Share this collection with members?"
        description="Your title choices, description, and creator notes become visible. Your private tracking, ratings, and favorites stay private."
        confirmLabel="Publish collection"
        onConfirm={async () => {
          unwrap(
            await editPersonalCollection({
              id: c.id,
              patch: { visibility: "published" },
            }),
          );
          await invalidate();
          toast("Your collection is published.");
        }}
      />
      <Confirmation
        open={unpublishing}
        onOpenChange={setUnpublishing}
        title="Make this collection private?"
        description="Other members lose access. Saves and collection favorites are removed. Independent imported copies stay with their owners."
        confirmLabel="Unpublish"
        onConfirm={async () => {
          unwrap(
            await editPersonalCollection({
              id: c.id,
              patch: { visibility: "private" },
            }),
          );
          await invalidate();
        }}
      />
      <ProductDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this collection?"
        description="This permanently removes your collection. Independent copies made by other members are kept. Your private title tracking is unchanged."
        className="dialog-small"
      >
        <form
          className="dialog-body product-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const confirmation = new FormData(e.currentTarget).get(
              "confirmation",
            );
            await run(async () => {
              unwrap(
                await deletePersonalCollection({ id: c.id, confirmation }),
              );
              router.replace("/library");
            }, "Collection deleted.");
          }}
        >
          <label>
            Type “{c.title}” to confirm
            <input
              name="confirmation"
              required
              maxLength={160}
              autoComplete="off"
            />
          </label>
          <button className="button button-danger" disabled={busy || !online}>
            Delete collection
          </button>
        </form>
      </ProductDialog>
      <ReportDialog
        open={report}
        onOpenChange={setReport}
        collectionId={c.id}
      />
    </>
  );
}
