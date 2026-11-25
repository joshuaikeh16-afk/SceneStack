"use server";
import { z } from "zod";
import { perform } from "@/lib/product/action-result";
import { activeClient } from "@/lib/product/runtime";
import { result } from "@/lib/data/errors";
import { idSchema } from "@/lib/validation/data";
import {
  completeOnboarding,
  updateProfile,
  updateDiscoveryPreferences,
  updateNotificationPreferences,
  updateRecommendationPreferences,
} from "@/lib/data/profiles";
import { blockUser, submitReport } from "@/lib/data/social";
import { uploadImage, validateUploadedCover } from "@/lib/data/storage";
export async function followCreator(input: unknown) {
  return perform(async () => {
    const v = z
      .object({ id: idSchema, enabled: z.boolean() })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("set_follow", { p_user: v.id, p_enabled: v.enabled }),
    );
    return { enabled: v.enabled };
  });
}
export async function blockCreator(input: unknown) {
  return perform(async () => {
    const v = z
      .object({ id: idSchema, enabled: z.boolean() })
      .strict()
      .parse(input);
    await blockUser(v.id, v.enabled);
  });
}
export async function reportContent(input: unknown) {
  return perform(() => submitReport(input));
}
export async function editMyProfile(input: unknown) {
  return perform(() => updateProfile(input));
}
export async function savePreferences(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        categories: z.array(z.string()).max(6).optional(),
        genres: z.array(idSchema).max(100).optional(),
        languages: z.array(z.string()).max(100).optional(),
        notifications: z.unknown().optional(),
        recommendations: z.unknown().optional(),
      })
      .strict()
      .parse(input);
    if (v.categories !== undefined || v.genres !== undefined) {
      let languages = v.languages;
      if (languages === undefined) {
        const { client, userId } = await activeClient();
        languages =
          (
            await result(
              client
                .from("preferred_languages")
                .select("language_code")
                .eq("user_id", userId),
            )
          )?.map((l) => l.language_code) ?? [];
      }
      await updateDiscoveryPreferences({
        categories: v.categories ?? [],
        genres: v.genres ?? [],
        languages,
      });
    }
    if (v.notifications !== undefined)
      await updateNotificationPreferences(v.notifications);
    if (v.recommendations !== undefined)
      await updateRecommendationPreferences(v.recommendations);
  });
}
export async function saveOnboardingStep(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        step: z.number().int().min(1).max(4),
        username: z.string().max(30).nullable(),
        displayName: z.string().max(80).nullable(),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("save_onboarding_progress", {
        p_step: v.step,
        p_username: v.username,
        p_display_name: v.displayName,
      }),
    );
  });
}
export async function finishOnboarding(input: unknown) {
  return perform(() => completeOnboarding(input));
}
export async function checkUsername(input: unknown) {
  return perform(async () => {
    const name = z.string().trim().max(30).parse(input);
    const { client } = await activeClient();
    return result(client.rpc("username_available", { p_username: name }));
  });
}
export async function uploadPersonalImage(form: FormData) {
  return perform(async () => {
    const kind = z
      .enum(["avatar", "profile-cover", "collection-cover"])
      .parse(form.get("kind"));
    const file = z.instanceof(File).parse(form.get("file"));
    const collectionId =
      kind === "collection-cover"
        ? idSchema.parse(form.get("collectionId"))
        : undefined;
    return uploadImage({ kind, file, collectionId });
  });
}
export async function validatePersonalCover(input: unknown) {
  return perform(() => validateUploadedCover(input));
}
export async function readNotifications(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        all: z.boolean().default(false),
        ids: z.array(idSchema).max(100).default([]),
      })
      .strict()
      .parse(input);
    const { client, userId } = await activeClient();
    if (v.all) await result(client.rpc("mark_all_notifications_read"));
    else if (v.ids.length)
      await result(
        client
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("recipient_id", userId)
          .in("id", v.ids),
      );
  });
}

export async function saveOnboardingStarters(input: unknown) {
  return perform(async () => {
    const ids = z.array(idSchema).max(100).parse(input);
    const { client } = await activeClient();
    await result(client.rpc("save_onboarding_starters", { p_titles: ids }));
  });
}
