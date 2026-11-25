"use server";
import { z } from "zod";
import { idSchema } from "@/lib/validation/data";
import { titleMutationSchema } from "@/lib/product/validation";
import { activeClient } from "@/lib/product/runtime";
import { perform } from "@/lib/product/action-result";
import { result } from "@/lib/data/errors";
import { titleStates } from "@/lib/product/queries";
export async function changeTitle(input: unknown) {
  return perform(async () => {
    const v = titleMutationSchema.parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("change_personal_title", {
        p_title: v.titleId,
        p_action: v.action,
        p_status: v.action === "track" ? v.status : null,
        p_rating: v.action === "rate" ? v.rating : null,
        p_enabled: v.action === "favorite" ? v.enabled : null,
        p_feedback: v.action === "feedback" ? v.feedback : null,
      }),
    );
    return (await titleStates([v.titleId]))[0];
  });
}

export async function bulkTitleActions(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        titleIds: z.array(idSchema).min(1).max(100),
        action: z.enum(["track", "remove", "favorite"]),
        status: z
          .enum(["planned", "watching", "completed", "on_hold", "dropped"])
          .optional(),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    const raw = await result(
      client.rpc("bulk_title_actions", {
        p_titles: v.titleIds,
        p_action: v.action,
        p_status: v.status ?? null,
      }),
    );
    const outcomes = z
      .array(
        z.object({
          titleId: idSchema,
          ok: z.boolean(),
          code: z.string().optional(),
        }),
      )
      .parse(raw);
    return {
      outcomes,
      states: await titleStates(
        outcomes.filter((r) => r.ok).map((r) => r.titleId),
      ),
    };
  });
}
