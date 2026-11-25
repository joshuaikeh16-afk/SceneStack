import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/config/env";
import type { Database } from "@/types/database";

export async function createClient() {
  // Always mark auth-aware renders dynamic, including unconfigured builds.
  const cookieStore = await cookies();
  const config = getSupabaseConfig();
  if (!config) return null;
  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot mutate cookies. Proxy refreshes them first.
        }
      },
    },
  });
}
