import "server-only";
import { z } from "zod";
import { dataContext } from "./context";
import { result } from "./errors";
import type { Row } from "@/types/database";
import { exportCsv } from "@/lib/utils/export";

export async function requestAccountDeletion() {
  const { client } = await dataContext();
  return result(client.rpc("request_account_deletion"));
}
export async function recoverAccount() {
  const { client } = await dataContext({ allowInactive: true });
  await result(client.rpc("recover_account"));
}
export async function getDeletionState() {
  const { client, user } = await dataContext({ allowInactive: true });
  return result<
    Pick<
      Row<"account_deletions">,
      "requested_at" | "recover_until" | "claimed_at"
    >
  >(
    client
      .from("account_deletions")
      .select("requested_at,recover_until,claimed_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  );
}
export async function requestDataExport(format: unknown) {
  const value = z.enum(["json", "csv"]).parse(format);
  const { client } = await dataContext();
  return result(client.rpc("request_data_export", { p_format: value }));
}
export async function buildPersonalExport(format: unknown) {
  const value = z.enum(["json", "csv"]).parse(format);
  const { client } = await dataContext();
  const payload = await result(client.rpc("export_personal_data"));
  return {
    filename: `scenestack-export.${value}`,
    contentType:
      value === "json"
        ? "application/json; charset=utf-8"
        : "text/csv; charset=utf-8",
    body:
      value === "json" ? JSON.stringify(payload, null, 2) : exportCsv(payload),
  };
}
