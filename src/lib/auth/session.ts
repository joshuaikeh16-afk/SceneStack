import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/utils/redirect";

export const getAuth = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return { user: null, status: "unconfigured" as const };
  try {
    // Verify with Auth server; never authorize using unverified cookie session data.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError")
      return { user: null, status: "unavailable" as const };
    return { user, status: "ready" as const };
  } catch {
    return { user: null, status: "unavailable" as const };
  }
});

export async function requireUser(next: string) {
  const { user, status } = await getAuth();
  if (!user) {
    const query = new URLSearchParams({ next: safeRedirect(next) });
    if (status === "unavailable") query.set("error", "unavailable");
    redirect(`/login?${query}`);
  }
  return user;
}
