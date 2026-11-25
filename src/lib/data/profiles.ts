import "server-only";
import { z } from "zod";
import { dataContext } from "./context";
import { result } from "./errors";
import {
  idSchema,
  onboardingSchema,
  profilePatchSchema,
  notificationPreferencesSchema,
  recommendationPreferencesSchema,
} from "@/lib/validation/data";

export async function getProfile(id: unknown) {
  const parsed = idSchema.parse(id);
  const { client } = await dataContext();
  return result(
    client
      .from("profiles")
      .select("id,username,display_name,avatar_path,bio,created_at")
      .eq("id", parsed)
      .maybeSingle(),
  );
}
export async function getMyProfile() {
  const { client, user } = await dataContext({ allowInactive: true });
  return result(client.from("profiles").select("*").eq("id", user.id).single());
}
export async function updateProfile(input: unknown) {
  const values = profilePatchSchema.parse(input);
  const { client, user } = await dataContext();
  return result(
    client
      .from("profiles")
      .update({
        ...(values.displayName !== undefined && {
          display_name: values.displayName,
        }),
        ...(values.bio !== undefined && { bio: values.bio }),
        ...(values.coverPath !== undefined && { cover_path: values.coverPath }),
        ...(values.featuredCollectionId !== undefined && {
          featured_collection_id: values.featuredCollectionId,
        }),
        ...(values.avatarPath !== undefined && {
          avatar_path: values.avatarPath,
        }),
      })
      .eq("id", user.id)
      .select("id,display_name,bio,avatar_path")
      .single(),
  );
}
export async function completeOnboarding(input: unknown) {
  const values = onboardingSchema.parse(input);
  const { client } = await dataContext();
  await result(
    client.rpc("complete_onboarding", {
      p_username: values.username,
      p_display_name: values.displayName,
      p_categories: values.categories,
      p_genres: values.genres,
      p_starter_titles: values.starterTitles,
    }),
  );
}
export async function getPreferences() {
  const { client, user } = await dataContext();
  const [categories, genres, notifications, recommendations, onboarding] =
    await Promise.all([
      result(
        client
          .from("preferred_categories")
          .select("category")
          .eq("user_id", user.id),
      ),
      result(
        client
          .from("favorite_genres")
          .select("genre_id")
          .eq("user_id", user.id),
      ),
      result(
        client
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user.id)
          .single(),
      ),
      result(
        client
          .from("recommendation_preferences")
          .select("*")
          .eq("user_id", user.id)
          .single(),
      ),
      result(
        client
          .from("onboarding")
          .select("completed_at")
          .eq("user_id", user.id)
          .single(),
      ),
    ]);
  return { categories, genres, notifications, recommendations, onboarding };
}
export async function updateNotificationPreferences(input: unknown) {
  const v = notificationPreferencesSchema.parse(input);
  const { client, user } = await dataContext();
  await result(
    client
      .from("notification_preferences")
      .update({
        ...(v.enabled !== undefined && { enabled: v.enabled }),
        ...(v.newFollowers !== undefined && { new_followers: v.newFollowers }),
        ...(v.collectionFavorites !== undefined && {
          collection_favorites: v.collectionFavorites,
        }),
        ...(v.followedCollections !== undefined && {
          followed_collections: v.followedCollections,
        }),
      })
      .eq("user_id", user.id),
  );
}
export async function updateRecommendationPreferences(input: unknown) {
  const v = recommendationPreferencesSchema.parse(input);
  const { client, user } = await dataContext();
  await result(
    client
      .from("recommendation_preferences")
      .update({
        ...(v.enabled !== undefined && { enabled: v.enabled }),
        ...(v.includeMature !== undefined && {
          include_mature: v.includeMature,
        }),
        ...(v.diversify !== undefined && { diversify: v.diversify }),
        ...(v.rememberSearches !== undefined && {
          remember_searches: v.rememberSearches,
        }),
        ...(v.rememberViewed !== undefined && {
          remember_viewed: v.rememberViewed,
        }),
      })
      .eq("user_id", user.id),
  );
}

export async function updateDiscoveryPreferences(input: unknown) {
  const v = onboardingSchema
    .pick({ categories: true, genres: true })
    .extend({
      languages: z
        .array(z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/))
        .max(100)
        .default([]),
    })
    .strict()
    .parse(input);
  const { client } = await dataContext();
  await result(
    client.rpc("set_discovery_preferences", {
      p_categories: v.categories,
      p_genres: v.genres,
      p_languages: v.languages,
    }),
  );
}
