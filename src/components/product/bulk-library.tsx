"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Layers3, Trash2, X } from "lucide-react";
import { useProduct, unwrap, useInvalidateProduct } from "./providers";
import { bulkTitleActions } from "@/app/actions/title";
import { statusLabels, blankTitleState } from "@/lib/product/state";
import { Confirmation } from "./confirmation";
import { CollectionPicker } from "./collection-picker";
import type { TitleState, TitleView } from "@/types/product";
export function BulkLibraryToolbar({
  selected,
  onChange,
}: {
  selected: TitleView[];
  onChange: (items: TitleView[]) => void;
}) {
  const { bootstrap, toast, online } = useProduct();
  const client = useQueryClient();
  const invalidate = useInvalidateProduct();
  const [remove, setRemove] = useState(false),
    [collections, setCollections] = useState(false),
    [error, setError] = useState("");
  const ids = selected.map((t) => t.id);
  type Input = {
    action: "track" | "remove" | "favorite";
    status?: TitleState["tracking"];
  };
  function write(state: TitleState) {
    client.setQueryData(
      ["title-state", bootstrap.userId, state.titleId],
      state,
    );
    client.setQueriesData<TitleState[]>(
      { queryKey: ["title-states", bootstrap.userId] },
      (old) => old?.map((s) => (s.titleId === state.titleId ? state : s)),
    );
  }
  const mutation = useMutation({
    mutationKey: ["bulk-title-state", bootstrap.userId],
    mutationFn: async (input: Input) => {
      if (!navigator.onLine) throw new Error("Reconnect to save bulk changes.");
      return unwrap(
        await bulkTitleActions({
          titleIds: ids,
          action: input.action,
          ...(input.status && { status: input.status }),
        }),
      );
    },
    onMutate: async (input) => {
      setError("");
      await client.cancelQueries({
        queryKey: ["title-states", bootstrap.userId],
      });
      await client.cancelQueries({
        queryKey: ["title-state", bootstrap.userId],
      });
      const previous = ids.map(
        (id) =>
          client.getQueryData<TitleState>([
            "title-state",
            bootstrap.userId,
            id,
          ]) ?? blankTitleState(id),
      );
      previous.forEach((state) =>
        write({
          ...state,
          ...(input.action === "favorite"
            ? { favorite: true }
            : {
                tracking:
                  input.action === "remove" ? null : (input.status ?? null),
              }),
        }),
      );
      return { previous };
    },
    onError: (error, _v, context) => {
      context?.previous.forEach(write);
      setError(error.message);
      toast(error.message, true);
    },
    onSuccess: async (result, _v, context) => {
      const failed = result.outcomes.filter((r) => !r.ok);
      failed.forEach((r) => {
        const before = context?.previous.find((s) => s.titleId === r.titleId);
        if (before) write(before);
      });
      result.states.forEach(write);
      onChange(selected.filter((t) => failed.some((r) => r.titleId === t.id)));
      const message = `${result.outcomes.length - failed.length} updated${failed.length ? `; ${failed.length} couldn’t be saved` : ""}.`;
      toast(message, failed.length > 0);
      if (failed.length)
        setError(
          `Not saved: ${selected
            .filter((t) => failed.some((r) => r.titleId === t.id))
            .map((t) => t.title.name)
            .join(", ")}. Your selection is preserved for retry.`,
        );
      await invalidate();
    },
  });
  if (!selected.length) return null;
  return (
    <>
      <div
        className="bulk-selection-toolbar"
        role="region"
        aria-label="Bulk library actions"
      >
        <strong>{selected.length} selected</strong>
        <label>
          <span className="sr-only">
            Change tracking status for selected titles
          </span>
          <select
            value=""
            disabled={mutation.isPending || !online}
            onChange={(e) => {
              if (e.target.value)
                mutation.mutate({
                  action: "track",
                  status: e.target.value as TitleState["tracking"],
                });
            }}
          >
            <option value="">Change status</option>
            {Object.entries(statusLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={mutation.isPending || !online}
          onClick={() => mutation.mutate({ action: "favorite" })}
        >
          <Heart size={16} />
          <span>Favorite</span>
        </button>
        <button
          disabled={mutation.isPending || !online}
          onClick={() => setCollections(true)}
        >
          <Layers3 size={16} />
          <span>Add to collection</span>
        </button>
        <button
          disabled={mutation.isPending || !online}
          className="danger-text"
          onClick={() => setRemove(true)}
        >
          <Trash2 size={16} />
          <span>Remove tracking</span>
        </button>
        <button
          aria-label="Clear selection"
          disabled={mutation.isPending}
          onClick={() => onChange([])}
        >
          <X size={17} />
        </button>
        {mutation.isPending && <span role="status">Saving…</span>}
      </div>
      {error && (
        <p className="form-error bulk-error" role="alert">
          {error}
        </p>
      )}
      <Confirmation
        open={remove}
        onOpenChange={setRemove}
        title={`Remove ${selected.length} titles from tracking?`}
        description="Your ratings, favorites, and collections stay as they are. Any failed records will remain selected for retry."
        confirmLabel="Remove tracking"
        danger
        onConfirm={async () => {
          await mutation.mutateAsync({ action: "remove" });
        }}
      />
      <CollectionPicker
        open={collections}
        onOpenChange={setCollections}
        titleIds={ids}
      />
    </>
  );
}
