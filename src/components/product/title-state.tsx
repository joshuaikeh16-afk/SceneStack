"use client";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useIsMutating,
} from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { changeTitle } from "@/app/actions/title";
import {
  fetchData,
  unwrap,
  useProduct,
  useInvalidateProduct,
} from "./providers";
import { blankTitleState } from "@/lib/product/state";
import type { TitleState } from "@/types/product";
import type { z } from "zod";
import { titleMutationSchema } from "@/lib/product/validation";
export function TitleStates({
  ids,
  initial,
  children,
}: {
  ids: string[];
  initial?: TitleState[];
  children: ReactNode;
}) {
  const { bootstrap } = useProduct();
  const client = useQueryClient();
  const key = [...new Set(ids)].sort().join(",");
  const query = useQuery({
    queryKey: ["title-states", bootstrap.userId, key],
    queryFn: ({ signal }) =>
      Promise.all(
        Array.from({ length: Math.ceil(key.split(",").length / 100) }, (_, i) =>
          fetchData<TitleState[]>(
            "title-state",
            {
              ids: key
                .split(",")
                .slice(i * 100, i * 100 + 100)
                .join(","),
            },
            signal,
          ),
        ),
      ).then((pages) => pages.flat()),
    enabled: !!bootstrap.userId && bootstrap.availability === "ready" && !!key,
    initialData: initial,
  });
  useEffect(() => {
    query.data?.forEach((state) => {
      const queryKey = ["title-state", bootstrap.userId, state.titleId];
      if (!client.isMutating({ mutationKey: queryKey }))
        client.setQueryData(queryKey, state);
    });
  }, [query.data, bootstrap.userId, client]);
  return (
    <>
      {query.isError && (
        <div className="inline-error" role="status">
          <p>
            Your private title states couldn’t be loaded. Your saved data is
            unchanged.
          </p>
          <button className="text-link" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      )}
      {children}
    </>
  );
}
export function useTitleState(id: string, load = false) {
  const { bootstrap } = useProduct();
  return useQuery({
    queryKey: ["title-state", bootstrap.userId, id],
    queryFn: async ({ signal }) =>
      (await fetchData<TitleState[]>("title-state", { ids: id }, signal))[0] ??
      blankTitleState(id),
    enabled: load && !!bootstrap.userId && bootstrap.availability === "ready",
  });
}
export function useTitleMutation(id: string) {
  const { bootstrap, toast } = useProduct();
  const client = useQueryClient();
  const invalidate = useInvalidateProduct();
  const key = ["title-state", bootstrap.userId, id];
  const sharedPending = useIsMutating({ mutationKey: key }) > 0;
  const bulkPending =
    useIsMutating({ mutationKey: ["bulk-title-state", bootstrap.userId] }) > 0;
  function write(state: TitleState) {
    client.setQueryData(key, state);
    client.setQueriesData<TitleState[]>(
      { queryKey: ["title-states", bootstrap.userId] },
      (old) => old?.map((row) => (row.titleId === id ? state : row)),
    );
  }
  const mutation = useMutation({
    mutationKey: key,
    mutationFn: async (input: z.infer<typeof titleMutationSchema>) => {
      if (!navigator.onLine)
        throw new Error("You’re offline. Reconnect to save this change.");
      return unwrap(await changeTitle(input));
    },
    onMutate: async (input) => {
      await Promise.all([
        client.cancelQueries({ queryKey: key }),
        client.cancelQueries({ queryKey: ["title-states", bootstrap.userId] }),
      ]);
      const previous = client.getQueryData<TitleState>(key);
      const countsKey = ["library", bootstrap.userId, "counts"];
      const previousCounts =
        client.getQueryData<Record<string, number>>(countsKey);
      const next = { ...(previous ?? blankTitleState(id)) };
      if (input.action === "track") next.tracking = input.status;
      else if (input.action === "favorite") next.favorite = input.enabled;
      else if (input.action === "rate") next.rating = input.rating;
      write(next);
      if (previousCounts) {
        const before = previous ?? blankTitleState(id);
        client.setQueryData(countsKey, {
          ...previousCounts,
          tracking:
            previousCounts.tracking +
            Number(!!next.tracking) -
            Number(!!before.tracking),
          favorites:
            previousCounts.favorites +
            Number(next.favorite) -
            Number(before.favorite),
          ratings:
            previousCounts.ratings +
            Number(next.rating !== null) -
            Number(before.rating !== null),
        });
      }
      return { previous, previousCounts };
    },
    onError: (error, _input, context) => {
      write(context?.previous ?? blankTitleState(id));
      if (context?.previousCounts)
        client.setQueryData(
          ["library", bootstrap.userId, "counts"],
          context.previousCounts,
        );
      toast(error.message, true);
    },
    onSuccess: (state, input) => {
      write(state);
      toast(
        input.action === "track"
          ? input.status
            ? "Library updated."
            : "Removed from tracking. Your rating and favorite are unchanged."
          : input.action === "favorite"
            ? input.enabled
              ? "Added to your private favorites."
              : "Removed from favorites."
            : input.action === "rate"
              ? input.rating !== null
                ? "Your rating is saved."
                : "Rating removed."
              : "Recommendation feedback saved.",
      );
      void client.invalidateQueries({ queryKey: ["catalog"] });
      void client.invalidateQueries({ queryKey: ["title-details", id] });
      void client.invalidateQueries({
        queryKey: ["recommendations", bootstrap.userId],
      });
      void invalidate();
    },
  });
  return {
    ...mutation,
    isPending: mutation.isPending || sharedPending || bulkPending,
  };
}
