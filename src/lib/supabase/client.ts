"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/config/env";
import type { Database } from "@/types/database";

export function createClient() {
  const config = getSupabaseConfig();
  if (!config)
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart SceneStack.",
    );
  return createBrowserClient<Database>(config.url, config.publishableKey);
}
