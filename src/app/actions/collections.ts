"use server";
import { z } from "zod";
import { idSchema, collectionSchema } from "@/lib/validation/data";
import { activeClient } from "@/lib/product/runtime";
import { perform } from "@/lib/product/action-result";
import { result, DataAccessError } from "@/lib/data/errors";
import { collectionDetails } from "@/lib/product/queries";
export async function createPersonalCollection(input: unknown) {
  return perform(async () => {
    const v = collectionSchema
      .extend({
        requestId: idSchema,
        titleIds: z.array(idSchema).max(100).default([]),
      })
      .parse(input);
    const { client } = await activeClient();
    const id = await result(
      client.rpc("create_collection_with_titles", {
        p_request: v.requestId,
        p_title: v.title,
        p_description: v.description,
        p_visibility: v.visibility,
        p_spoiler: v.spoilerWarning,
        p_titles: v.titleIds,
      }),
    );
    if (!id)
      throw new DataAccessError(
        "UNAVAILABLE",
        "The collection couldn’t be created. Please try again.",
      );
    return { id };
  });
}
export async function editPersonalCollection(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        id: idSchema,
        version: z.number().int().positive().optional(),
        patch: z
          .object({
            title: z.string().trim().min(1).max(160).optional(),
            description: z.string().max(5000).optional(),
            visibility: z.enum(["private", "published"]).optional(),
            spoilerWarning: z.boolean().optional(),
            coverPath: z.string().max(300).nullable().optional(),
          })
          .strict(),
      })
      .strict()
      .parse(input);
    const { client, userId } = await activeClient();
    const p = v.patch;
    let version = v.version;
    if (version === undefined) {
      const current = await result<{ version: number }>(
        client
          .from("collections")
          .select("version")
          .eq("id", v.id)
          .eq("owner_id", userId)
          .single(),
      );
      version = current?.version;
    }
    if (version === undefined)
      throw new DataAccessError(
        "UNAVAILABLE",
        "The collection is unavailable.",
      );
    const raw = await result(
      client.rpc("update_collection_version", {
        p_id: v.id,
        p_version: version,
        p_patch: {
          ...(p.title !== undefined && { title: p.title }),
          ...(p.description !== undefined && { description: p.description }),
          ...(p.visibility !== undefined && { visibility: p.visibility }),
          ...(p.spoilerWarning !== undefined && {
            spoiler_warning: p.spoilerWarning,
          }),
          ...(p.coverPath !== undefined && { cover_path: p.coverPath }),
        },
      }),
    );
    return z
      .object({ id: idSchema, version: z.number(), updated_at: z.string() })
      .parse(raw);
  });
}
export async function deletePersonalCollection(input: unknown) {
  return perform(async () => {
    const v = z
      .object({ id: idSchema, confirmation: z.string().max(160) })
      .strict()
      .parse(input);
    const { client, userId } = await activeClient();
    const row = await result<{ title: string }>(
      client
        .from("collections")
        .select("title")
        .eq("id", v.id)
        .eq("owner_id", userId)
        .maybeSingle(),
    );
    if (!row || row.title !== v.confirmation)
      throw new DataAccessError(
        "INVALID_INPUT",
        "Type the collection’s exact name to delete it.",
      );
    await result(
      client.from("collections").delete().eq("id", v.id).eq("owner_id", userId),
    );
  });
}
export async function addTitlesToCollections(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        collectionIds: z.array(idSchema).min(1).max(50),
        titleIds: z.array(idSchema).min(1).max(100),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("add_titles_to_collections", {
        p_collections: v.collectionIds,
        p_titles: v.titleIds,
      }),
    );
  });
}
export async function editCollectionItem(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        collectionId: idSchema,
        version: z.number().int().positive(),
        itemId: idSchema,
        note: z.string().max(2000).optional(),
        remove: z.boolean().optional(),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("edit_collection_item_version", {
        p_collection: v.collectionId,
        p_item: v.itemId,
        p_version: v.version,
        p_note: v.note ?? null,
        p_remove: v.remove ?? false,
      }),
    );
  });
}
export async function moveCollectionItem(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        collectionId: idSchema,
        version: z.number().int().positive(),
        itemId: idSchema,
        beforeId: idSchema.nullable().optional(),
        direction: z.union([z.literal(-1), z.literal(1)]).optional(),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("move_collection_item_version", {
        p_version: v.version,
        p_collection: v.collectionId,
        p_item: v.itemId,
        p_before: v.beforeId ?? null,
        p_direction: v.direction ?? null,
      }),
    );
  });
}
export async function sortCollection(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        collectionId: idSchema,
        version: z.number().int().positive(),
        sort: z.enum([
          "title",
          "release_year",
          "added_at",
          "rating",
          "category",
        ]),
        descending: z.boolean(),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("save_collection_order", {
        p_version: v.version,
        p_collection: v.collectionId,
        p_sort: v.sort,
        p_desc: v.descending,
      }),
    );
  });
}
export async function interactCollection(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        id: idSchema,
        kind: z.enum(["favorite", "save"]),
        enabled: z.boolean(),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("set_collection_interaction", {
        p_collection: v.id,
        p_kind: v.kind,
        p_enabled: v.enabled,
      }),
    );
    return { kind: v.kind, enabled: v.enabled };
  });
}
export async function importPersonalCollection(input: unknown) {
  return perform(async () => {
    const v = z
      .object({ id: idSchema, requestId: idSchema })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    const id = await result(
      client.rpc("import_collection_once", {
        p_source: v.id,
        p_request: v.requestId,
      }),
    );
    return { id };
  });
}
export async function loadCollectionPage(id: unknown, offset: unknown = 0) {
  return perform(async () =>
    collectionDetails(id, z.number().int().min(0).max(1000000).parse(offset)),
  );
}
