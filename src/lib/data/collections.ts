import "server-only";
import { z } from "zod";
import { dataContext } from "./context";
import { result } from "./errors";
import { collectionSchema, idSchema, pageSchema } from "@/lib/validation/data";

function collectionValues(input: unknown) {
  const v = collectionSchema.parse(input);
  return {
    title: v.title,
    description: v.description,
    visibility: v.visibility,
    spoiler_warning: v.spoilerWarning,
    cover_path: v.coverPath ?? null,
    sort_by: v.sortBy,
    sort_desc: v.sortDesc,
  };
}
export async function createCollection(input: unknown) {
  const values = collectionValues(input);
  const { client } = await dataContext();
  return result(client.from("collections").insert(values).select("*").single());
}
export async function updateCollection(id: unknown, input: unknown) {
  const key = idSchema.parse(id),
    values = collectionValues(input);
  const { client, user } = await dataContext();
  return result(
    client
      .from("collections")
      .update(values)
      .eq("id", key)
      .eq("owner_id", user.id)
      .select("*")
      .single(),
  );
}
export async function deleteCollection(id: unknown) {
  const key = idSchema.parse(id);
  const { client, user } = await dataContext();
  await result(
    client.from("collections").delete().eq("id", key).eq("owner_id", user.id),
  );
}
export async function getCollection(id: unknown) {
  const key = idSchema.parse(id);
  const { client } = await dataContext();
  return result(
    client.from("collections").select("*").eq("id", key).maybeSingle(),
  );
}
export async function listMyCollections(input: unknown = {}) {
  const v = pageSchema.parse(input);
  const { client, user } = await dataContext();
  let query = client
    .from("collections")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(v.limit);
  if (v.cursor)
    query = query.or(
      `created_at.lt.${v.cursor.at},and(created_at.eq.${v.cursor.at},id.lt.${v.cursor.id})`,
    );
  return result(query);
}
export async function listCollectionItems(id: unknown, input: unknown = {}) {
  const key = idSchema.parse(id),
    v = z
      .object({
        limit: z.number().int().min(1).max(100).default(24),
        afterPosition: z
          .number()
          .int()
          .min(0)
          .max(Number.MAX_SAFE_INTEGER)
          .optional(),
      })
      .strict()
      .parse(input);
  const { client } = await dataContext();
  let query = client
    .from("collection_items")
    .select("*")
    .eq("collection_id", key)
    .order("position")
    .order("id")
    .limit(v.limit);
  if (v.afterPosition !== undefined)
    query = query.gt("position", v.afterPosition);
  return result(query);
}
export async function addCollectionItem(
  id: unknown,
  title: unknown,
  note: unknown = "",
) {
  const key = idSchema.parse(id),
    titleId = idSchema.parse(title),
    text = z.string().max(2000).parse(note);
  const { client } = await dataContext();
  return result(
    client.rpc("add_collection_item", {
      p_collection: key,
      p_title: titleId,
      p_note: text,
    }),
  );
}
export async function reorderCollectionItems(id: unknown, items: unknown) {
  const key = idSchema.parse(id),
    ids = z.array(idSchema).parse(items);
  const { client } = await dataContext();
  await result(
    client.rpc("reorder_collection_items", {
      p_collection: key,
      p_item_ids: ids,
    }),
  );
}
export async function importCollection(id: unknown, title?: unknown) {
  const key = idSchema.parse(id),
    name = z.string().trim().min(1).max(160).optional().parse(title);
  const { client } = await dataContext();
  return result(
    client.rpc("import_collection", { p_source: key, p_title: name ?? null }),
  );
}
export async function interactWithCollection(
  id: unknown,
  kind: "favorite" | "save",
  enabled: unknown,
) {
  const key = idSchema.parse(id),
    on = z.boolean().parse(enabled);
  const { client, user } = await dataContext();
  const table =
    kind === "favorite" ? "collection_favorites" : "collection_saves";
  if (on) await result(client.from(table).insert({ collection_id: key }));
  else
    await result(
      client
        .from(table)
        .delete()
        .eq("collection_id", key)
        .eq("user_id", user.id),
    );
}
export async function collectionMetrics(id: unknown) {
  const key = idSchema.parse(id);
  const { client } = await dataContext();
  return result(client.rpc("collection_metrics", { p_collection: key }));
}

export async function listPublicCollections(
  owner: unknown,
  input: unknown = {},
) {
  const key = idSchema.parse(owner),
    v = pageSchema.parse(input);
  const { client } = await dataContext();
  let query = client
    .from("collections")
    .select("*")
    .eq("owner_id", key)
    .eq("visibility", "published")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(v.limit);
  if (v.cursor)
    query = query.or(
      `created_at.lt.${v.cursor.at},and(created_at.eq.${v.cursor.at},id.lt.${v.cursor.id})`,
    );
  return result(query);
}
export async function listCollectionReferences(
  kind: unknown,
  input: unknown = {},
) {
  const source = z.enum(["saved", "favorite", "imported"]).parse(kind),
    v = pageSchema.parse(input);
  const { client, user } = await dataContext();
  const table =
    source === "saved"
      ? "collection_saves"
      : source === "favorite"
        ? "collection_favorites"
        : "collection_imports";
  let query = client
    .from(table)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(v.limit);
  if (v.cursor)
    query = query.or(
      `created_at.lt.${v.cursor.at},and(created_at.eq.${v.cursor.at},id.lt.${v.cursor.id})`,
    );
  return result(query);
}
