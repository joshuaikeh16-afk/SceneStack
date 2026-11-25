import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/utils/redirect";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeRedirect(url.searchParams.get("next"));
  function finish(path: string) {
    // Relative Location preserves the browser origin, including loopback aliases,
    // without trusting Host or forwarded-host headers. Every path is allowlisted.
    const response = new NextResponse(null, {
      status: 307,
      headers: { Location: path },
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const failure = (reason: string) =>
    finish(`/login?${new URLSearchParams({ error: reason, next })}`);
  if (url.searchParams.has("error")) return failure("denied");
  const code = url.searchParams.get("code");
  if (!code) return failure("callback");
  const supabase = await createClient();
  if (!supabase) return failure("unavailable");
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure("callback");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [profile, onboarding] = await Promise.all([
        supabase
          .from("profiles")
          .select("status")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("onboarding")
          .select("completed_at")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (profile.data && profile.data.status !== "active")
        return finish("/account/recovery");
      if (!onboarding.error && onboarding.data && !onboarding.data.completed_at)
        return finish(`/onboarding?${new URLSearchParams({ next })}`);
    }
    return finish(next);
  } catch {
    return failure("unavailable");
  }
}
