import "server-only";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation/data";
import { result, DataAccessError } from "./errors";
import type { Row } from "@/types/database";

// Trusted scheduled-worker entry points only. No route, browser action, or scheduler is installed.
export async function recordProviderSync(input: unknown) {
  const v = z
    .object({
      titleId: idSchema,
      providerId: idSchema,
      success: z.boolean(),
      errorCode: z
        .enum([
          "timeout",
          "rate_limited",
          "unavailable",
          "invalid_payload",
          "not_found",
        ])
        .optional(),
    })
    .strict()
    .parse(input);
  const admin = createPrivilegedClient();
  await result(
    admin.rpc("record_provider_sync", {
      p_title: v.titleId,
      p_provider: v.providerId,
      p_success: v.success,
      p_error_code: v.errorCode ?? null,
    }),
  );
}
export async function releaseExpiredSuspensions() {
  return result(createPrivilegedClient().rpc("release_expired_suspensions"));
}
export async function purgeDeletedAccount(
  id: unknown,
  options: { execute?: boolean } = {},
) {
  const userId = idSchema.parse(id);
  const admin = createPrivilegedClient();
  const row = await result<
    Pick<Row<"account_deletions">, "user_id" | "recover_until">
  >(
    admin
      .from("account_deletions")
      .select("user_id,recover_until")
      .eq("user_id", userId)
      .maybeSingle(),
  );
  if (!row || new Date(row.recover_until).getTime() > Date.now())
    return { eligible: false, executed: false };
  if (options.execute !== true) return { eligible: true, executed: false };
  if (process.env.SCENESTACK_ENABLE_ACCOUNT_PURGE !== "true")
    throw new DataAccessError(
      "FORBIDDEN",
      "Irreversible account cleanup is disabled on this server.",
    );
  const claimed = await result(
    admin.rpc("claim_account_purge", { p_user: userId }),
  );
  if (!claimed) return { eligible: false, executed: false };
  // Storage is removed through its API before Auth deletion. Never DELETE storage.objects via SQL.
  for (const bucket of ["scenestack-avatars", "scenestack-collection-covers"]) {
    const removeFolder = async (prefix: string): Promise<void> => {
      while (true) {
        const files = await result(
          admin.storage.from(bucket).list(prefix, { limit: 100, offset: 0 }),
        );
        if (!files?.length) break;
        for (const file of files) {
          const path = `${prefix}/${file.name}`;
          if (file.id) await result(admin.storage.from(bucket).remove([path]));
          else await removeFolder(path);
        }
      }
    };
    await removeFolder(userId);
  }
  // Supabase Auth admin API performs the managed-row deletion; FKs clean application rows.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error)
    throw new DataAccessError(
      "UNAVAILABLE",
      "Account cleanup could not finish and can be retried safely.",
    );
  return { eligible: true, executed: true };
}

/** Scheduled privacy maintenance; returns counts only, never history contents. */
export async function expireDiscoveryHistory() {
  return result(createPrivilegedClient().rpc("expire_discovery_history"));
}
