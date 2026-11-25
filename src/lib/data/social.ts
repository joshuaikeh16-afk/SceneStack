import "server-only";
import { z } from "zod";
import { dataContext } from "./context";
import { result } from "./errors";
import { idSchema, pageSchema, reportSchema } from "@/lib/validation/data";

export async function followUser(id: unknown, follow: unknown) {
  const target = idSchema.parse(id),
    enabled = z.boolean().parse(follow);
  const { client, user } = await dataContext();
  if (enabled)
    await result(client.from("follows").insert({ followed_id: target }));
  else
    await result(
      client
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followed_id", target),
    );
}
export async function blockUser(id: unknown, block: unknown) {
  const target = idSchema.parse(id),
    enabled = z.boolean().parse(block);
  const { client, user } = await dataContext();
  if (enabled)
    await result(client.from("blocks").insert({ blocked_id: target }));
  else
    await result(
      client
        .from("blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", target),
    );
}
export async function getFollowCounts(id: unknown) {
  const key = idSchema.parse(id);
  const { client } = await dataContext();
  return result(client.rpc("follow_counts", { p_user: key }));
}
export async function submitReport(input: unknown) {
  const v = reportSchema.parse(input);
  const { client } = await dataContext();
  return result(
    client.rpc("submit_report", {
      p_user: v.userId ?? null,
      p_collection: v.collectionId ?? null,
      p_reason: v.reason,
      p_details: v.details,
    }),
  );
}
export async function listNotifications(input: unknown = {}) {
  const v = pageSchema.parse(input);
  const { client, user } = await dataContext();
  let query = client
    .from("notifications")
    .select("*")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(v.limit);
  if (v.cursor)
    query = query.or(
      `created_at.lt.${v.cursor.at},and(created_at.eq.${v.cursor.at},id.lt.${v.cursor.id})`,
    );
  return result(query);
}
export async function markNotificationsRead(
  input: unknown,
  read: unknown = true,
) {
  const ids = z.array(idSchema).min(1).max(100).parse(input),
    enabled = z.boolean().parse(read);
  const { client, user } = await dataContext();
  await result(
    client
      .from("notifications")
      .update({ read_at: enabled ? new Date().toISOString() : null })
      .eq("recipient_id", user.id)
      .in("id", ids),
  );
}
