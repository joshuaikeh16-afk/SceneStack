import "server-only";
import { z } from "zod";
import { dataContext } from "./context";
import { result } from "./errors";
import { idSchema, roleSchema } from "@/lib/validation/data";
import { createPrivilegedClient } from "@/lib/supabase/admin";

// Ordinary server utilities, NOT Server Actions or public route handlers.
// The database separately requires the immutable platform-owner identity.
export async function manageAdminRole(input: unknown) {
  const v = z
    .object({ userId: idSchema, role: roleSchema, grant: z.boolean() })
    .strict()
    .parse(input);
  const { user } = await dataContext();
  const admin = createPrivilegedClient();
  await result(
    admin.rpc("manage_admin_role", {
      p_actor: user.id,
      p_user: v.userId,
      p_role: v.role,
      p_grant: v.grant,
    }),
  );
}
export async function transferPlatformOwnership(id: unknown) {
  const target = idSchema.parse(id);
  const { user } = await dataContext();
  const admin = createPrivilegedClient();
  await result(
    admin.rpc("transfer_platform_owner", { p_actor: user.id, p_next: target }),
  );
}
export async function moderateReport(input: unknown) {
  const v = z
    .object({
      reportId: idSchema,
      action: z.enum([
        "dismissal",
        "content_removal",
        "warning",
        "suspension",
        "ban",
      ]),
      reason: z.string().min(1).max(3000),
      until: z.iso.datetime({ offset: true }).optional(),
    })
    .strict()
    .parse(input);
  const { client } = await dataContext();
  await result(
    client.rpc("moderate_report", {
      p_report: v.reportId,
      p_action: v.action,
      p_reason: v.reason,
      p_until: v.until ?? null,
    }),
  );
}
