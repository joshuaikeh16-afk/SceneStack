import { z } from "zod";
import { entertainmentKinds } from "@/types/title";

export const idSchema = z.uuid();
export const categorySchema = z.enum(entertainmentKinds);
export const trackingStatusSchema = z.enum([
  "planned",
  "watching",
  "completed",
  "on_hold",
  "dropped",
]);
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{2,29}$/)
  .refine(
    (value) =>
      ![
        "admin",
        "administrator",
        "moderator",
        "scenestack",
        "support",
        "official",
      ].includes(value),
    "Choose a different username.",
  );
export const ratingSchema = z
  .number()
  .min(1)
  .max(10)
  .refine(
    (value) => /^(?:[1-9](?:\.[0-9])?|10(?:\.0)?)$/.test(String(value)),
    "Use increments of 0.1.",
  );
export const storagePathSchema = z
  .string()
  .max(300)
  .regex(
    /^[a-f0-9-]{36}\/(?:[a-f0-9-]{36}\/)?[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/,
  );
export const pageSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(24),
    cursor: z
      .object({ at: z.iso.datetime({ offset: true }), id: idSchema })
      .strict()
      .optional(),
  })
  .strict();
export const onboardingSchema = z
  .object({
    username: usernameSchema,
    displayName: z.string().trim().min(1).max(80),
    categories: z.array(categorySchema).max(6).default([]),
    genres: z.array(idSchema).max(100).default([]),
    starterTitles: z.array(idSchema).max(100).default([]),
  })
  .strict();
export const profilePatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    bio: z.string().max(500).optional(),
    avatarPath: storagePathSchema.nullable().optional(),
    coverPath: storagePathSchema.nullable().optional(),
    featuredCollectionId: idSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");
export const notificationPreferencesSchema = z
  .object({
    enabled: z.boolean().optional(),
    newFollowers: z.boolean().optional(),
    collectionFavorites: z.boolean().optional(),
    followedCollections: z.boolean().optional(),
  })
  .strict();
export const recommendationPreferencesSchema = z
  .object({
    enabled: z.boolean().optional(),
    includeMature: z.boolean().optional(),
    diversify: z.boolean().optional(),
    rememberSearches: z.boolean().optional(),
    rememberViewed: z.boolean().optional(),
  })
  .strict();
export const collectionSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().max(5000).default(""),
    visibility: z.enum(["private", "published"]).default("private"),
    spoilerWarning: z.boolean().default(false),
    coverPath: storagePathSchema.nullable().optional(),
    sortBy: z
      .enum(["manual", "title", "release_year", "added_at"])
      .default("manual"),
    sortDesc: z.boolean().default(false),
  })
  .strict();
export const catalogQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(120)
      .regex(/^[^\u0000-\u001f\u007f]*$/)
      .default(""),
    category: categorySchema.optional(),
    year: z.number().int().min(1888).max(2200).optional(),
    genre: idSchema.optional(),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/)
      .optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    minimumRating: ratingSchema.optional(),
    sort: z.enum(["title", "year", "added"]).default("title"),
    limit: z.number().int().min(1).max(100).default(24),
    offset: z.number().int().min(0).max(1000000).default(0),
  })
  .strict();
export const providerTitleSchema = z
  .object({
    displayTitle: z.string().trim().min(1).max(300),
    originalTitle: z.string().max(300).nullable().default(null),
    kind: categorySchema,
    description: z.string().max(20000).default(""),
    releaseYear: z.number().int().min(1888).max(2200).nullable().default(null),
    ageRating: z.string().max(40).nullable().default(null),
  })
  .strict();
export const reportSchema = z
  .object({
    userId: idSchema.optional(),
    collectionId: idSchema.optional(),
    reason: z.enum([
      "spam",
      "harassment",
      "hate",
      "inappropriate",
      "spoiler",
      "copyright",
      "other",
    ]),
    details: z.string().max(3000).default(""),
  })
  .strict()
  .refine(
    (value) => Boolean(value.userId) !== Boolean(value.collectionId),
    "Choose one report target.",
  );
export const correctionSchema = z
  .object({
    titleId: idSchema,
    field: z.enum([
      "display_title",
      "original_title",
      "description",
      "release_year",
      "kind",
      "age_rating",
    ]),
    value: z.string().min(1).max(20000),
    reason: z.string().trim().min(1).max(3000),
  })
  .strict();
export const roleSchema = z.enum([
  "super_admin",
  "moderator",
]);
