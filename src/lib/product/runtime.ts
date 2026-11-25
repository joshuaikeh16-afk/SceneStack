import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuth } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/utils/redirect";
import { DataAccessError } from "@/lib/data/errors";
import type { Availability, ProductBootstrap } from "@/types/product";

export function availabilityFor(error: unknown): Availability {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  return [
    "42P01",
    "42703",
    "42883",
    "PGRST202",
    "PGRST205",
    "SETUP_REQUIRED",
  ].includes(code)
    ? "migration_required"
    : "unavailable";
}
export const getBootstrap = cache(async (): Promise<ProductBootstrap> => {
  const { user, status } = await getAuth();
  const base: ProductBootstrap = {
    userId: user?.id ?? null,
    name:
      typeof user?.user_metadata.full_name === "string"
        ? user.user_metadata.full_name
        : "SceneStack member",
    email: user?.email ?? null,
    availability: status === "unconfigured" ? "unconfigured" : "ready",
    profile: null,
    onboarding: null,
    roles: [],
  };
  const client = await createClient();
  if (!client) return base;
  if (!user) return base;
  try {
    const [profile, onboarding, roles] = await Promise.all([
      client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      client
        .from("onboarding")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      client.from("admin_roles").select("role").eq("user_id", user.id),
    ]);
    const error = profile.error || onboarding.error || roles.error;
    if (error) return { ...base, availability: availabilityFor(error) };
    return {
      ...base,
      availability: profile.data ? "ready" : "migration_required",
      profile: profile.data,
      onboarding: onboarding.data,
      roles: (roles.data ?? []).map((row) => row.role),
    };
  } catch {
    return { ...base, availability: "unavailable" };
  }
});
export async function requireProductUser(
  next: string,
  {
    onboarding = true,
    allowInactive = false,
  }: { onboarding?: boolean; allowInactive?: boolean } = {},
) {
  const data = await getBootstrap();
  if (!data.userId)
    redirect(`/login?${new URLSearchParams({ next: safeRedirect(next) })}`);
  if (data.profile && data.profile.status !== "active" && !allowInactive)
    redirect("/account/recovery");
  if (
    data.availability === "ready" &&
    onboarding &&
    !data.onboarding?.completed_at
  )
    redirect(
      `/onboarding?${new URLSearchParams({ next: safeRedirect(next) })}`,
    );
  return data;
}
export async function activeClient() {
  const context = await getBootstrap();
  if (!context.userId)
    throw new DataAccessError(
      "AUTH_REQUIRED",
      "Sign in with Google to continue.",
    );
  if (context.availability !== "ready")
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "This workspace’s database has not been connected yet. Your changes were not saved.",
    );
  if (context.profile?.status !== "active")
    throw new DataAccessError(
      "FORBIDDEN",
      "Your account is not active. Visit account recovery or sign out.",
    );
  const client = await createClient();
  if (!client)
    throw new DataAccessError("SETUP_REQUIRED", "Supabase is not configured.");
  return { client, userId: context.userId, bootstrap: context };
}
