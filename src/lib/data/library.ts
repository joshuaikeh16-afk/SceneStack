import "server-only";
import { z } from "zod";
import { dataContext } from "./context";
import { result } from "./errors";
import {
  idSchema,
  pageSchema,
  trackingStatusSchema,
  ratingSchema,
} from "@/lib/validation/data";

export async function listTracking(input: unknown = {}) {
  const v = pageSchema
    .extend({ status: trackingStatusSchema.optional() })
    .parse(input);
  const { client, user } = await dataContext();
  let query = client
    .from("tracking")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(v.limit);
  if (v.status) query = query.eq("status", v.status);
  if (v.cursor)
    query = query.or(
      `updated_at.lt.${v.cursor.at},and(updated_at.eq.${v.cursor.at},id.lt.${v.cursor.id})`,
    );
  return result(query);
}
export async function setTracking(title: unknown, status: unknown) {
  const titleId = idSchema.parse(title),
    value = trackingStatusSchema.parse(status);
  const { client } = await dataContext();
  return result(
    client.rpc("set_tracking", { p_title: titleId, p_status: value }),
  );
}
export async function removeTracking(title: unknown) {
  const titleId = idSchema.parse(title);
  const { client, user } = await dataContext();
  await result(
    client
      .from("tracking")
      .delete()
      .eq("user_id", user.id)
      .eq("title_id", titleId),
  );
}
export async function rateTitle(title: unknown, score: unknown) {
  const titleId = idSchema.parse(title),
    value = ratingSchema.parse(score);
  const { client } = await dataContext();
  return result(client.rpc("set_rating", { p_title: titleId, p_score: value }));
}
export async function removeRating(title: unknown) {
  const titleId = idSchema.parse(title);
  const { client, user } = await dataContext();
  await result(
    client
      .from("ratings")
      .delete()
      .eq("user_id", user.id)
      .eq("title_id", titleId),
  );
}
export async function setFavorite(title: unknown, favorite: unknown) {
  const titleId = idSchema.parse(title),
    enabled = z.boolean().parse(favorite);
  const { client, user } = await dataContext();
  if (enabled)
    await result(client.from("favorites").insert({ title_id: titleId }));
  else
    await result(
      client
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("title_id", titleId),
    );
}
export async function listPrivateHistory(
  kind: "tracking" | "rating",
  input: unknown = {},
) {
  const v = pageSchema.parse(input);
  const { client, user } = await dataContext();
  const table = kind === "tracking" ? "tracking_history" : "rating_history";
  let query = client
    .from(table)
    .select("*")
    .eq("user_id", user.id)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(v.limit);
  if (v.cursor)
    query = query.or(
      `changed_at.lt.${v.cursor.at},and(changed_at.eq.${v.cursor.at},id.lt.${v.cursor.id})`,
    );
  return result(query);
}
export async function listFavorites(input: unknown = {}) {
  const v = pageSchema.parse(input);
  const { client, user } = await dataContext();
  let query = client
    .from("favorites")
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
