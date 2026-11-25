"use server";
import { z } from "zod";
import { perform } from "@/lib/product/action-result";
import { activeClient } from "@/lib/product/runtime";
import { result } from "@/lib/data/errors";
import { idSchema } from "@/lib/validation/data";
import {
  editCatalogTitle,
  reviewCatalogSubmission,
  proposeCatalogMerge,
  requestMetadataRefresh,
  submitMissingTitle,
  suggestCorrection,
} from "@/lib/data/catalog";
import { manageAdminRole, moderateReport } from "@/lib/data/administration";
export async function saveCatalogTitle(id: unknown, input: unknown) {
  return perform(() => editCatalogTitle(id, input));
}
export async function reviewSubmission(input: unknown) {
  return perform(() => reviewCatalogSubmission(input));
}
export async function reviewReport(input: unknown) {
  return perform(() => moderateReport(input));
}
export async function proposeMerge(input: unknown) {
  return perform(() => proposeCatalogMerge(input));
}
export async function refreshMetadata(title: unknown, provider: unknown) {
  return perform(() => requestMetadataRefresh(title, provider));
}
export async function changeAdminRole(input: unknown) {
  return perform(() => manageAdminRole(input));
}
export async function requestMissingTitle(input: unknown) {
  return perform(() => submitMissingTitle(input));
}
export async function requestCorrection(input: unknown) {
  return perform(() => suggestCorrection(input));
}
export async function moderateAccount(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        userId: idSchema,
        action: z.enum(["warning", "suspension", "ban"]),
        reason: z.string().min(1).max(3000),
        until: z.iso.datetime({ offset: true }).nullable().optional(),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("admin_account_action", {
        p_user: v.userId,
        p_action: v.action,
        p_reason: v.reason,
        p_until: v.until ?? null,
      }),
    );
  });
}

export async function verifyRelationship(input: unknown) {
  return perform(async () => {
    const v = z
      .object({
        source: idSchema,
        related: idSchema,
        relation: z.enum([
          "sequel",
          "prequel",
          "spin_off",
          "remake",
          "adaptation",
          "franchise",
          "related_series",
          "season",
          "other",
        ]),
      })
      .strict()
      .parse(input);
    const { client } = await activeClient();
    await result(
      client.rpc("verify_title_relationship", {
        p_source: v.source,
        p_related: v.related,
        p_relation: v.relation,
      }),
    );
  });
}
