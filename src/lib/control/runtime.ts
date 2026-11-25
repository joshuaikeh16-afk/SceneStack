import "server-only";
import { z } from "zod";
import { getAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DataAccessError, result } from "@/lib/data/errors";
import { canOpenControl } from "@/config/control-center";

const identitySchema = z.object({
  userId: z.uuid(),
  role: z.enum(["super_admin", "moderator"]),
  appointedAt: z.string(),
});
export type ControlIdentity = z.infer<typeof identitySchema>;
// Deliberately not memoized: each privileged request rechecks database access.
export async function controlContext(section?: string) {
  const { user } = await getAuth();
  if (!user)
    throw new DataAccessError(
      "AUTH_REQUIRED",
      "Sign in with your SceneStack account.",
    );
  const client = await createClient();
  if (!client)
    throw new DataAccessError("SETUP_REQUIRED", "Supabase is not configured.");
  const identity = identitySchema
    .nullable()
    .parse(await result(client.rpc("control_identity")));
  const permissionSection =
    section === "templates"
      ? "support"
      : section === "help"
        ? "content-studio"
        : section;
  if (
    !identity ||
    identity.userId !== user.id ||
    (permissionSection && !canOpenControl(identity.role, permissionSection))
  )
    throw new DataAccessError(
      "FORBIDDEN",
      "Your account does not have access to this Control Center workspace.",
    );
  return { client, identity, user };
}
export async function memberControlContext() {
  const { user } = await getAuth();
  if (!user)
    throw new DataAccessError(
      "AUTH_REQUIRED",
      "Sign in to review your activity.",
    );
  const client = await createClient();
  if (!client)
    throw new DataAccessError("SETUP_REQUIRED", "Supabase is not configured.");
  return { client, user };
}
