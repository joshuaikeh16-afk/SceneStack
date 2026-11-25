import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dataContext } from "./context";
import { result, DataAccessError } from "./errors";
import {
  catalogQuerySchema,
  idSchema,
  providerTitleSchema,
  categorySchema,
  correctionSchema,
} from "@/lib/validation/data";

export async function searchCatalog(input: unknown = {}) {
  const v = catalogQuerySchema.parse(input);
  const { client } = await dataContext();
  return result(
    client.rpc("search_catalog", {
      p_query: v.q,
      p_category: v.category ?? null,
      p_year: v.year ?? null,
      p_genre: v.genre ?? null,
      p_language: v.language ?? null,
      p_country: v.country ?? null,
      p_min_rating: v.minimumRating ?? null,
      p_sort: v.sort,
      p_limit: v.limit,
      p_offset: v.offset,
    }),
  );
}
export async function getCanonicalTitle(id: unknown) {
  const key = idSchema.parse(id);
  const client = await createClient();
  if (!client)
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "Configure Supabase to read cached titles.",
    );
  const resolved = await result(client.rpc("resolve_title", { p_title: key }));
  if (!resolved) return null;
  return result(
    client.from("titles").select("*").eq("id", resolved).maybeSingle(),
  );
}
export async function getCommunityRating(id: unknown) {
  const key = idSchema.parse(id);
  const client = await createClient();
  if (!client)
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "Configure Supabase to read community ratings.",
    );
  return result(client.rpc("community_rating", { p_title: key }));
}
export async function submitMissingTitle(input: unknown) {
  const v = z
    .object({
      title: z.string().trim().min(1).max(300),
      category: categorySchema,
      details: z.string().max(3000).default(""),
    })
    .strict()
    .parse(input);
  const { client } = await dataContext();
  return result(
    client.rpc("submit_missing_title", {
      p_title: v.title,
      p_kind: v.category,
      p_details: v.details,
    }),
  );
}
export async function suggestCorrection(input: unknown) {
  const v = correctionSchema.parse(input);
  const { client } = await dataContext();
  return result(
    client.rpc("suggest_correction", {
      p_title: v.titleId,
      p_field: v.field,
      p_value: v.value,
      p_reason: v.reason,
    }),
  );
}
export async function editCatalogTitle(id: unknown, input: unknown) {
  const key = idSchema.nullable().parse(id),
    v = providerTitleSchema.parse(input);
  const { client } = await dataContext();
  return result(
    client.rpc("catalog_edit_title", {
      p_id: key,
      p_name: v.displayTitle,
      p_kind: v.kind,
      p_description: v.description,
      p_year: v.releaseYear,
      p_original: v.originalTitle,
      p_age: v.ageRating,
    }),
  );
}
export async function reviewCatalogSubmission(input: unknown) {
  const v = z
    .object({
      kind: z.enum(["missing", "correction", "merge"]),
      id: idSchema,
      approve: z.boolean(),
      notes: z.string().max(3000).default(""),
      resolvedTitle: idSchema.optional(),
    })
    .strict()
    .parse(input);
  const { client } = await dataContext();
  await result(
    client.rpc("review_catalog_submission", {
      p_kind: v.kind,
      p_id: v.id,
      p_approve: v.approve,
      p_notes: v.notes,
      p_resolved_title: v.resolvedTitle ?? null,
    }),
  );
}
export async function proposeCatalogMerge(input: unknown) {
  const v = z
    .object({
      source: idSchema,
      target: idSchema,
      reason: z.string().min(1).max(3000),
    })
    .strict()
    .parse(input);
  const { client } = await dataContext();
  return result(
    client.rpc("propose_catalog_merge", {
      p_source: v.source,
      p_target: v.target,
      p_reason: v.reason,
    }),
  );
}
export async function requestMetadataRefresh(
  title: unknown,
  provider: unknown,
) {
  const titleId = idSchema.parse(title),
    providerId = idSchema.parse(provider);
  const { client } = await dataContext();
  return result(
    client.rpc("request_metadata_refresh", {
      p_title: titleId,
      p_provider: providerId,
    }),
  );
}
