"use server";
import { z } from "zod";
import { perform } from "@/lib/product/action-result";
import {
  requestAccountDeletion,
  recoverAccount,
  buildPersonalExport,
} from "@/lib/data/account";
import { activeClient } from "@/lib/product/runtime";
import { DataAccessError } from "@/lib/data/errors";
export async function exportMyData(format: unknown) {
  return perform(() => buildPersonalExport(format));
}
export async function requestDeletion(input: unknown) {
  return perform(async () => {
    const text = z.string().parse(input);
    const { bootstrap } = await activeClient();
    if (
      text !== (bootstrap.profile?.username || bootstrap.profile?.display_name)
    )
      throw new DataAccessError(
        "INVALID_INPUT",
        "Type your username or display name exactly to confirm.",
      );
    return requestAccountDeletion();
  });
}
export async function recoverMyAccount() {
  return perform(() => recoverAccount());
}
