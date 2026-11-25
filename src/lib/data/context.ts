import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAuth } from "@/lib/auth/session";
import { DataAccessError, result } from "./errors";
import type { Row } from "@/types/database";

export async function dataContext(options: { allowInactive?: boolean } = {}) {
  const { user } = await getAuth();
  if (!user)
    throw new DataAccessError(
      "AUTH_REQUIRED",
      "Sign in with Google to continue.",
    );
  const client = await createClient();
  if (!client)
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "Configure Supabase before using stored data.",
    );
  const profile = await result<Pick<Row<"profiles">, "id" | "status">>(
    client.from("profiles").select("id,status").eq("id", user.id).maybeSingle(),
  );
  if (!profile)
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "Your profile is not initialized. Apply the profile migration first.",
    );
  if (!options.allowInactive && profile.status !== "active")
    throw new DataAccessError(
      "FORBIDDEN",
      "Your account is not currently active.",
    );
  return { client, user, profile };
}
