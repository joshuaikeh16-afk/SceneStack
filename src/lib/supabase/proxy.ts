import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/config/env";
import { safeRedirect } from "@/lib/utils/redirect";

const protectedRoots = [
  "/library",
  "/profile",
  "/settings",
  "/collections",
  "/notifications",
  "/onboarding",
  "/admin",
  "/people",
  "/account/recovery",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  let authenticated = false;
  let unavailable = false;
  if (config) {
    const supabase = createServerClient(config.url, config.publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    });
    try {
      const { data, error } = await supabase.auth.getClaims();
      authenticated = !error && Boolean(data?.claims.sub);
    } catch {
      unavailable = true;
    }
  }
  const pathname = request.nextUrl.pathname;
  if (
    protectedRoots.some(
      (root) => pathname === root || pathname.startsWith(`${root}/`),
    ) &&
    !authenticated
  ) {
    const destination = new URL("/login", request.url);
    destination.searchParams.set(
      "next",
      safeRedirect(pathname + request.nextUrl.search),
    );
    if (unavailable) destination.searchParams.set("error", "unavailable");
    const redirected = NextResponse.redirect(destination);
    response.cookies
      .getAll()
      .forEach((cookie) => redirected.cookies.set(cookie));
    response.headers.forEach((value, key) => {
      if (["cache-control", "expires", "pragma"].includes(key))
        redirected.headers.set(key, value);
    });
    response = redirected;
  }
  // Authenticated and cookie-refresh responses must never be shared by a CDN.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
