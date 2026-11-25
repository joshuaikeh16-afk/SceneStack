import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/config/env";
import type { Database } from "@/types/database";
import { DataAccessError } from "@/lib/data/errors";

/** Dedicated trusted-worker client. Never reuse a browser/user-session client here. */
export function createPrivilegedClient() {
  const config = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret?.startsWith("sb_secret_"))
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "A server-only Supabase secret key is required for this trusted operation.",
    );
  return createSupabaseClient<Database>(config.url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
