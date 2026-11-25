import { z } from "zod";
import { categorySchema, idSchema, ratingSchema } from "@/lib/validation/data";
export const productQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(120)
      .regex(/^[^\u0000-\u001f\u007f]*$/)
      .default(""),
    tab: z.enum(["titles", "collections", "people"]).default("titles"),
    category: categorySchema.optional(),
    genre: idSchema.optional(),
    year: z.coerce.number().int().min(1888).max(2200).optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/)
      .optional(),
    rating: z.coerce.number().min(1).max(10).optional(),
    sort: z.enum(["popular", "title", "year", "added"]).default("popular"),
    status: z
      .enum(["announced", "airing", "released", "ended", "unavailable"])
      .optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();
export type ProductQuery = z.infer<typeof productQuerySchema>;
export const libraryQuerySchema = z
  .object({
    section: z
      .enum([
        "tracking",
        "favorites",
        "collections",
        "saved",
        "imported",
        "ratings",
      ])
      .default("tracking"),
    status: z
      .enum(["all", "planned", "watching", "completed", "on_hold", "dropped"])
      .default("all"),
    sort: z.enum(["updated", "title", "year", "rating"]).default("updated"),
    q: z.string().trim().max(120).default(""),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();
export function parseQuery(input: URLSearchParams) {
  const allowed = Object.fromEntries(
    [...input.entries()].filter(([, value]) => value !== ""),
  );
  return productQuerySchema.parse(allowed);
}
export function productHref(query: Partial<ProductQuery>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== "" &&
      !(key === "tab" && value === "titles") &&
      !(key === "page" && value === 1) &&
      !(key === "sort" && value === "popular") &&
      !(key === "limit" && value === 24)
    )
      params.set(key, String(value));
  });
  return `/discover${params.size ? `?${params}` : ""}`;
}
export const titleIntentSchema = z.enum([
  "watched",
  "watching",
  "favorite",
  "rate",
  "collection",
]);
export const titleMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("track"),
      titleId: idSchema,
      status: z
        .enum(["planned", "watching", "completed", "on_hold", "dropped"])
        .nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("favorite"),
      titleId: idSchema,
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("rate"),
      titleId: idSchema,
      rating: ratingSchema.nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("feedback"),
      titleId: idSchema,
      feedback: z.enum(["not_interested", "already_seen"]),
    })
    .strict(),
]);
