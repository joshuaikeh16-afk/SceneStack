import { createHash } from "node:crypto";
import { z } from "zod";
import { DataAccessError } from "@/lib/data/errors";
import type { ProductQuery } from "./validation";
import type { TitleFeedSource } from "@/types/product";

export const feedSourceSchema = z.enum([
  "catalog",
  "watching",
  "planned",
  "recent",
  "recommendations",
]);
type Direction = "next" | "previous";
const edgeSchema = z
  .object({
    id: z.uuid(),
    value: z.union([z.number(), z.string().max(1200), z.null()]),
  })
  .strict();
export type CatalogEdge = z.infer<typeof edgeSchema>;

const cursorSchema = z
  .object({
    v: z.literal(1),
    scope: z.string().length(22),
    offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    cutoff: z.iso.datetime(),
    direction: z.enum(["next", "previous"]),
    edge: edgeSchema.optional(),
  })
  .strict();
type Cursor = z.infer<typeof cursorSchema>;

export function feedScope(
  source: TitleFeedSource,
  q: ProductQuery,
  userId: string | null,
) {
  // Order comes from the validated schema and never from URL parameter order.
  const values = [
    source,
    userId,
    q.limit,
    q.q,
    q.category,
    q.genre,
    q.year,
    q.country,
    q.language,
    q.rating,
    q.sort,
    q.status,
  ];
  return createHash("sha256")
    .update(JSON.stringify(values))
    .digest("base64url")
    .slice(0, 22);
}

export function usesCatalogKeyset(source: TitleFeedSource, q: ProductQuery) {
  return (
    source === "catalog" &&
    !q.q &&
    !q.genre &&
    !q.country &&
    !q.language &&
    !q.rating
  );
}

export function readFeedCursor(
  token: string | null | undefined,
  scope: string,
  q: ProductQuery,
  keyset: boolean,
): Cursor {
  if (token == null)
    return {
      v: 1,
      scope,
      offset: (q.page - 1) * q.limit,
      cutoff: new Date().toISOString(),
      direction: "next",
    };
  try {
    if (!/^[A-Za-z0-9_-]{1,8192}$/.test(token)) throw new Error();
    const parsed = cursorSchema.parse(
      JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
    );
    if (
      parsed.scope !== scope ||
      parsed.offset % q.limit !== 0 ||
      keyset !== !!parsed.edge
    )
      throw new Error();
    if (!keyset && parsed.offset > 1_000_000) throw new Error();
    if (parsed.edge) {
      const value = parsed.edge.value;
      if (q.sort === "title" && typeof value !== "string") throw new Error();
      if (
        q.sort === "added" &&
        !z.iso.datetime({ offset: true }).safeParse(value).success
      )
        throw new Error();
      if (
        ["year", "popular"].includes(q.sort) &&
        value !== null &&
        typeof value !== "number"
      )
        throw new Error();
    }
    return parsed;
  } catch {
    throw new DataAccessError(
      "INVALID_INPUT",
      "This page does not belong to the current feed.",
    );
  }
}

export const catalogSortColumns = {
  title: "display_title",
  year: "release_year",
  popular: "popularity",
  added: "created_at",
} as const;

// PostgREST's or() uses its own filter grammar. Quote text and escape both
// escape characters so punctuation in a title remains part of its value.
export function catalogSeek(
  sort: ProductQuery["sort"],
  direction: Direction,
  edge: CatalogEdge,
) {
  const column = catalogSortColumns[sort];
  const forward = direction === "next";
  const idOp = forward ? "gt" : "lt";
  const idClause = `id.${idOp}.${edge.id}`;
  const nullable = sort === "popular" || sort === "year";
  if (edge.value === null) {
    const ties = `and(${column}.is.null,${idClause})`;
    return forward ? ties : `${column}.not.is.null,${ties}`;
  }
  const op = (sort === "title") === forward ? "gt" : "lt";
  const value =
    typeof edge.value === "number"
      ? edge.value.toString()
      : '"' + edge.value.replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"';
  const clauses = [
    `${column}.${op}.${value}`,
    `and(${column}.eq.${value},${idClause})`,
  ];
  if (nullable && forward) clauses.push(`${column}.is.null`);
  return clauses.join(",");
}

export function pageLinks(
  cursor: Cursor,
  limit: number,
  hasPrevious: boolean,
  hasNext: boolean,
  first?: CatalogEdge,
  last?: CatalogEdge,
) {
  function encode(direction: Direction, offset: number, edge?: CatalogEdge) {
    const data: Cursor = {
      v: 1,
      scope: cursor.scope,
      cutoff: cursor.cutoff,
      direction,
      offset,
      edge,
    };
    return Buffer.from(JSON.stringify(data)).toString("base64url");
  }
  return {
    offset: cursor.offset,
    previousCursor:
      hasPrevious && cursor.offset >= limit
        ? encode("previous", cursor.offset - limit, first)
        : null,
    nextCursor:
      hasNext && (last || cursor.offset + limit <= 1_000_000)
        ? encode("next", cursor.offset + limit, last)
        : null,
  };
}
