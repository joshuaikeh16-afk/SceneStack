"use server";
import { z } from "zod";
import { perform } from "@/lib/product/action-result";
import { activeClient } from "@/lib/product/runtime";
import { result } from "@/lib/data/errors";
import { idSchema } from "@/lib/validation/data";
export async function rememberTitle(input: unknown) {
  return perform(async () => {
    const id = idSchema.parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("remember_discovery", { p_kind: "title", p_value: id }),
    );
  });
}
export async function rememberSearch(input: unknown) {
  return perform(async () => {
    const q = z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[^\u0000-\u001f\u007f]*$/)
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("remember_discovery", { p_kind: "search", p_value: q }),
    );
  });
}
export async function clearDiscoveryHistory(kind: unknown) {
  return perform(async () => {
    const value = z.enum(["searches", "viewed"]).parse(kind);
    const { client, userId } = await activeClient();
    await result(
      client
        .from(value === "searches" ? "recent_searches" : "recent_titles")
        .delete()
        .eq("user_id", userId),
    );
  });
}
export async function saveDiscoveryPrivacy(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        rememberSearches: z.boolean().optional(),
        rememberViewed: z.boolean().optional(),
      })
      .strict()
      .parse(input);
    const { client, userId } = await activeClient();
    await result(
      client
        .from("recommendation_preferences")
        .update({
          ...(v.rememberSearches !== undefined && {
            remember_searches: v.rememberSearches,
          }),
          ...(v.rememberViewed !== undefined && {
            remember_viewed: v.rememberViewed,
          }),
        })
        .eq("user_id", userId),
    );
  });
}
