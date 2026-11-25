"use server";
import { z } from "zod";
import { perform } from "@/lib/product/action-result";
import { controlContext, memberControlContext } from "@/lib/control/runtime";
import { result, DataAccessError } from "@/lib/data/errors";
import type { Json, Row } from "@/types/database";
import { providerEnabled } from "@/config/providers";

const id = z.uuid(),
  reason = z.string().trim().min(1).max(3000),
  body = z.string().trim().min(1).max(10000);
const json = z.record(z.string(), z.json());
const date = z.iso.datetime({ offset: true }).nullable();
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("invite"), userId: id, reason }),
  z.object({
    operation: z.literal("team"),
    userId: id,
    action: z.enum(["cancel_invitation", "suspend", "restore", "remove"]),
    reason,
  }),
  z.object({
    operation: z.literal("invitation_reply"),
    id,
    accept: z.boolean(),
  }),
  z.object({
    operation: z.literal("submit"),
    kind: z.enum([
      "report",
      "title_request",
      "correction",
      "appeal",
      "support",
    ]),
    subject: z.string().trim().min(1).max(300),
    body,
    targetId: id.nullable().default(null),
    collectionId: id.nullable().default(null),
    titleId: id.nullable().default(null),
    payload: json.default({}),
  }),
  z.object({
    operation: z.literal("reply"),
    id,
    body,
    internal: z.boolean().default(false),
  }),
  z.object({
    operation: z.literal("review"),
    id,
    status: z.string().max(40),
    resolution: z.string().max(3000),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    assignee: id.nullable().default(null),
    groupId: id.nullable().default(null),
    titleId: id.nullable().default(null),
  }),
  z.object({
    operation: z.literal("member_case"),
    id,
    action: z.enum(["withdraw", "reopen", "rate"]),
    rating: z.number().int().min(1).max(5).nullable().default(null),
  }),
  z.object({ operation: z.literal("vote"), id, enabled: z.boolean() }),
  z.object({
    operation: z.literal("enforce"),
    userId: id,
    kind: z.enum(["warning", "suspension", "ban", "restriction"]),
    reason,
    explanation: reason,
    feature: z
      .enum([
        "publish",
        "follow",
        "collection_interaction",
        "title_request",
        "correction",
        "report",
      ])
      .nullable()
      .default(null),
    until: date.default(null),
    caseId: id.nullable().default(null),
  }),
  z.object({
    operation: z.literal("enforcement_update"),
    id,
    revoke: z.boolean(),
    until: date.default(null),
    reason,
  }),
  z.object({
    operation: z.literal("profile"),
    userId: id,
    action: z.enum([
      "verify",
      "unverify",
      "clear_bio",
      "clear_avatar",
      "clear_cover",
      "display_name",
      "force_username",
      "restore",
      "delete",
    ]),
    value: z.string().max(200).default(""),
    reason,
  }),
  z.object({
    operation: z.literal("collection"),
    id,
    hidden: z.boolean(),
    reason,
  }),
  z.object({
    operation: z.literal("title"),
    id: id.nullable(),
    patch: json,
    locks: z.record(z.string(), z.boolean()).default({}),
    reason,
  }),
  z.object({ operation: z.literal("title_rollback"), id, reason }),
  z.object({
    operation: z.literal("correction_decisions"),
    id,
    decisions: z.record(z.string(), z.boolean()),
    reason,
  }),
  z.object({
    operation: z.literal("merge"),
    sourceId: id,
    targetId: id,
    reason,
  }),
  z.object({ operation: z.literal("split"), id, reason }),
  z.object({
    operation: z.literal("document"),
    id: id.nullable(),
    kind: z.enum(["help", "editorial", "announcement"]),
    values: json,
    version: z.number().int().min(1),
    reason,
  }),
  z.object({ operation: z.literal("document_rollback"), id, reason }),
  z.object({ operation: z.literal("settings"), values: json, reason }),
  z.object({
    operation: z.literal("job"),
    id: id.nullable(),
    action: z.enum(["create", "pause", "resume", "cancel", "retry"]),
    providerId: id.nullable().default(null),
    kind: z
      .enum([
        "initial",
        "historical",
        "popular",
        "trending",
        "recent",
        "upcoming",
        "refresh",
      ])
      .default("popular"),
    query: json.default({}),
    reason,
  }),
  z.object({
    operation: z.literal("schedule"),
    id: id.nullable(),
    providerId: id,
    name: z.string().trim().min(1).max(120),
    kind: z.enum([
      "historical",
      "popular",
      "trending",
      "recent",
      "upcoming",
      "refresh",
    ]),
    query: json,
    interval: z.number().int().min(60).max(10080),
    enabled: z.boolean(),
    reason,
  }),
  z.object({
    operation: z.literal("provider"),
    id,
    enabled: z.boolean(),
    reason,
  }),
  z.object({
    operation: z.literal("template"),
    id: id.nullable(),
    title: z.string().max(160),
    body: z.string().max(10000),
    remove: z.boolean().default(false),
  }),
  z.object({
    operation: z.literal("mark_notices"),
    id: id.nullable().default(null),
  }),
  z.object({ operation: z.literal("dismiss"), id }),
  z.object({
    operation: z.literal("username"),
    username: z.string().min(3).max(30),
  }),
  z.object({ operation: z.literal("user_note"), userId: id, body }),
  z.object({ operation: z.literal("restore_account"), userId: id, reason }),
  z.object({
    operation: z.literal("appeal"),
    id,
    decision: z.enum(["accepted", "partially_accepted", "rejected"]),
    until: date.default(null),
    reason,
  }),
  z.object({
    operation: z.literal("bulk_category"),
    ids: z.array(id).min(1).max(20),
    category: z.enum([
      "movie",
      "anime",
      "series",
      "cartoon",
      "drama",
      "documentary",
    ]),
    reason,
  }),
  z.object({ operation: z.literal("retry_failures"), id, reason }),
]);
const memberOperations = new Set([
  "submit",
  "reply",
  "member_case",
  "vote",
  "invitation_reply",
  "mark_notices",
  "dismiss",
  "username",
]);
async function requireBulk(providerId: string) {
  const { createPrivilegedClient } = await import("@/lib/supabase/admin");
  const provider = await result<
    Pick<
      Row<"metadata_providers">,
      "key" | "bulk_approved" | "enabled" | "approved"
    >
  >(
    createPrivilegedClient()
      .from("metadata_providers")
      .select("key,bulk_approved,enabled,approved")
      .eq("id", providerId)
      .single(),
  );
  const key = provider?.key;
  if (
    (key !== "tmdb" && key !== "myanimelist") ||
    !providerEnabled(key) ||
    !provider?.bulk_approved ||
    !provider.enabled ||
    !provider.approved ||
    process.env[
      `${key === "tmdb" ? "TMDB" : "MAL"}_BULK_INGESTION_APPROVED`
    ] !== "true"
  )
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "Bulk ingestion is blocked until provider storage and bulk-use permissions are confirmed in the server configuration and provider registry.",
    );
}
export async function controlMutation(input: unknown) {
  return perform(async () => {
    const v = schema.parse(input);
    const { client } = memberOperations.has(v.operation)
      ? await memberControlContext()
      : await controlContext();
    if (v.operation === "submit") {
      if (
        typeof v.payload.referenceUrl === "string" &&
        v.payload.referenceUrl
      ) {
        const url = z.url().max(2000).parse(v.payload.referenceUrl);
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password)
          throw new DataAccessError(
            "INVALID_INPUT",
            "References must be HTTPS links without embedded credentials.",
          );
      }
      return result(
        client.rpc("submit_control_case", {
          p_kind: v.kind,
          p_subject: v.subject,
          p_body: v.body,
          p_target: v.targetId,
          p_collection: v.collectionId,
          p_title: v.titleId,
          p_payload: v.payload as Json,
        }),
      );
    }
    switch (v.operation) {
      case "invite":
        return result(
          client.rpc("invite_moderator", {
            p_user: v.userId,
            p_reason: v.reason,
          }),
        );
      case "team":
        return result(
          client.rpc("manage_moderator", {
            p_user: v.userId,
            p_action: v.action,
            p_reason: v.reason,
          }),
        );
      case "invitation_reply":
        return result(
          client.rpc("respond_moderator_invitation", {
            p_id: v.id,
            p_accept: v.accept,
          }),
        );
      case "reply":
        return result(
          client.rpc("reply_control_case", {
            p_id: v.id,
            p_body: v.body,
            p_internal: v.internal,
          }),
        );
      case "review":
        return result(
          client.rpc("review_control_case", {
            p_id: v.id,
            p_status: v.status,
            p_resolution: v.resolution,
            p_priority: v.priority,
            p_assignee: v.assignee,
            p_group: v.groupId,
            p_title: v.titleId,
          }),
        );
      case "member_case":
        return result(
          client.rpc("member_case_action", {
            p_id: v.id,
            p_action: v.action,
            p_rating: v.rating,
          }),
        );
      case "vote":
        return result(
          client.rpc("vote_title_request", {
            p_id: v.id,
            p_enabled: v.enabled,
          }),
        );
      case "enforce":
        return result(
          client.rpc("enforce_control_account", {
            p_user: v.userId,
            p_kind: v.kind,
            p_reason: v.reason,
            p_explanation: v.explanation,
            p_feature: v.feature,
            p_until: v.until,
            p_case: v.caseId,
          }),
        );
      case "enforcement_update":
        return result(
          client.rpc("update_control_enforcement", {
            p_id: v.id,
            p_revoke: v.revoke,
            p_until: v.until,
            p_reason: v.reason,
          }),
        );
      case "profile":
        return result(
          client.rpc("control_profile_action", {
            p_user: v.userId,
            p_action: v.action,
            p_value: v.value,
            p_reason: v.reason,
          }),
        );
      case "collection":
        return result(
          client.rpc("control_collection_visibility", {
            p_id: v.id,
            p_hidden: v.hidden,
            p_reason: v.reason,
          }),
        );
      case "title":
        return result(
          client.rpc("control_edit_title", {
            p_id: v.id,
            p_patch: v.patch as Json,
            p_locks: v.locks,
            p_reason: v.reason,
          }),
        );
      case "title_rollback":
        return result(
          client.rpc("control_rollback_title", {
            p_revision: v.id,
            p_reason: v.reason,
          }),
        );
      case "correction_decisions":
        return result(
          client.rpc("decide_correction_fields", {
            p_id: v.id,
            p_decisions: v.decisions,
            p_reason: v.reason,
          }),
        );
      case "merge":
        return result(
          client.rpc("control_merge_titles", {
            p_source: v.sourceId,
            p_target: v.targetId,
            p_reason: v.reason,
          }),
        );
      case "split":
        return result(
          client.rpc("control_split_title", {
            p_source: v.id,
            p_reason: v.reason,
          }),
        );
      case "document":
        return result(
          client.rpc("control_save_document", {
            p_id: v.id,
            p_kind: v.kind,
            p_values: v.values as Json,
            p_version: v.version,
            p_reason: v.reason,
          }),
        );
      case "document_rollback":
        return result(
          client.rpc("control_rollback_document", {
            p_revision: v.id,
            p_reason: v.reason,
          }),
        );
      case "settings":
        return result(
          client.rpc("control_save_settings", {
            p_settings: v.values as Json,
            p_reason: v.reason,
          }),
        );
      case "job": {
        if (v.action === "create") {
          if (!v.providerId)
            throw new DataAccessError("INVALID_INPUT", "Choose a provider.");
          await requireBulk(v.providerId);
        }
        return result(
          client.rpc("control_catalog_job", {
            p_id: v.id,
            p_action: v.action,
            p_provider: v.providerId,
            p_kind: v.kind,
            p_query: v.query as Json,
            p_reason: v.reason,
          }),
        );
      }
      case "schedule": {
        if (v.enabled) await requireBulk(v.providerId);
        return result(
          client.rpc("control_save_schedule", {
            p_id: v.id,
            p_provider: v.providerId,
            p_name: v.name,
            p_kind: v.kind,
            p_query: v.query as Json,
            p_interval: v.interval,
            p_enabled: v.enabled,
            p_reason: v.reason,
          }),
        );
      }
      case "provider": {
        if (v.enabled) {
          const { createPrivilegedClient } =
            await import("@/lib/supabase/admin");
          const row = await result<{ key: string }>(
            createPrivilegedClient()
              .from("metadata_providers")
              .select("key")
              .eq("id", v.id)
              .single(),
          );
          if (
            (row?.key !== "tmdb" && row?.key !== "myanimelist") ||
            !providerEnabled(row.key)
          )
            throw new DataAccessError(
              "SETUP_REQUIRED",
              "The provider’s server-side permission gates are closed. Confirm permitted use before enabling this integration.",
            );
        }
        return result(
          client.rpc("control_provider_switch", {
            p_id: v.id,
            p_enabled: v.enabled,
            p_reason: v.reason,
          }),
        );
      }
      case "template":
        return result(
          client.rpc("control_support_template", {
            p_id: v.id,
            p_title: v.title,
            p_body: v.body,
            p_remove: v.remove,
          }),
        );
      case "mark_notices":
        return result(client.rpc("mark_control_notifications", { p_id: v.id }));
      case "dismiss":
        return result(client.rpc("dismiss_control_document", { p_id: v.id }));
      case "username":
        return result(
          client.rpc("change_required_username", { p_username: v.username }),
        );
      case "user_note":
        return result(
          client.rpc("control_add_user_note", {
            p_user: v.userId,
            p_body: v.body,
          }),
        );
      case "restore_account":
        return result(
          client.rpc("control_restore_account", {
            p_user: v.userId,
            p_reason: v.reason,
          }),
        );
      case "appeal":
        return result(
          client.rpc("resolve_control_appeal", {
            p_id: v.id,
            p_decision: v.decision,
            p_reason: v.reason,
            p_until: v.until,
          }),
        );
      case "bulk_category":
        return result(
          client.rpc("control_bulk_category", {
            p_ids: v.ids,
            p_category: v.category,
            p_reason: v.reason,
          }),
        );
      case "retry_failures":
        return result(
          client.rpc("retry_catalog_failures", {
            p_id: v.id,
            p_reason: v.reason,
          }),
        );
    }
  });
}
export async function controlProviderSearch(input: unknown) {
  return perform(async () => {
    await controlContext("catalog");
    const v = z
      .object({
        source: z.enum(["tmdb.movie", "tmdb.tv", "myanimelist.anime"]),
        q: z.string().trim().min(2).max(120),
        page: z.number().int().min(0).max(10000).default(0),
      })
      .parse(input);
    const { discoverProviderPage } =
      await import("@/lib/metadata/providers/discovery");
    const { productQuerySchema } = await import("@/lib/product/validation");
    return discoverProviderPage(
      v.source,
      v.source === "myanimelist.anime" ? v.page : Math.max(1, v.page),
      productQuerySchema.parse({ q: v.q }),
    );
  });
}
export async function controlProviderImport(input: unknown) {
  return perform(async () => {
    const { client } = await controlContext("catalog");
    const v = z
      .object({
        source: z.enum(["tmdb.movie", "tmdb.tv", "myanimelist.anime"]),
        externalId: z.string().regex(/^[1-9][0-9]{0,11}$/),
      })
      .parse(input);
    let canonical: string | null;
    if (v.source === "myanimelist.anime") {
      const { importMalTitle } =
        await import("@/lib/metadata/providers/mal-worker");
      canonical = await importMalTitle(v.externalId);
    } else {
      const { importTmdbTitle } =
        await import("@/lib/metadata/providers/tmdb-worker");
      canonical = await importTmdbTitle(
        v.source === "tmdb.movie" ? "movie" : "tv",
        v.externalId,
      );
    }
    if (!canonical)
      throw new DataAccessError(
        "UNAVAILABLE",
        "The provider import did not confirm a canonical title.",
      );
    await result(
      client.rpc("control_import_audit", {
        p_title: canonical,
        p_source: v.source,
      }),
    );
    return canonical;
  });
}
export async function controlRefreshTitles(input: unknown) {
  return perform(async () => {
    const ids = z.array(z.uuid()).min(1).max(20).parse(input);
    const { client } = await controlContext("catalog");
    const { createPrivilegedClient } = await import("@/lib/supabase/admin");
    const registrations = await result(
      createPrivilegedClient()
        .from("metadata_providers")
        .select("id,key,approved,enabled"),
    );
    const references = await result(
      client
        .from("provider_title_ids")
        .select("title_id,provider_id")
        .in("title_id", ids),
    );
    let queued = 0;
    for (const reference of references ?? []) {
      const provider = registrations?.find(
        (row) => row.id === reference.provider_id,
      );
      if (
        !provider?.approved ||
        !provider.enabled ||
        (provider.key !== "tmdb" && provider.key !== "myanimelist") ||
        !providerEnabled(provider.key)
      )
        continue;
      await result(
        client.rpc("request_metadata_refresh", {
          p_title: reference.title_id,
          p_provider: reference.provider_id,
        }),
      );
      queued++;
    }
    if (!queued)
      throw new DataAccessError(
        "SETUP_REQUIRED",
        "The selected titles have no currently enabled, permitted provider mappings.",
      );
    return { queued };
  });
}
export async function controlRunCatalogBatch() {
  return perform(async () => {
    await controlContext("synchronization");
    const { createPrivilegedClient } = await import("@/lib/supabase/admin");
    const rows = await result(
      createPrivilegedClient()
        .from("metadata_providers")
        .select("id,key,approved,enabled,bulk_approved"),
    );
    const allowed = (rows ?? []).filter(
      (row) =>
        row.approved &&
        row.enabled &&
        row.bulk_approved &&
        (row.key === "tmdb" || row.key === "myanimelist") &&
        providerEnabled(row.key) &&
        process.env[
          `${row.key === "tmdb" ? "TMDB" : "MAL"}_BULK_INGESTION_APPROVED`
        ] === "true",
    );
    if (!allowed.length)
      throw new DataAccessError(
        "SETUP_REQUIRED",
        "No provider has confirmed bulk-use permission and enabled server gates. No ingestion was started.",
      );
    const { runCatalogCycle } = await import("@/lib/control/catalog-worker");
    return runCatalogCycle({ platformTasks: false });
  });
}
export async function controlProviderProbe(input: unknown) {
  return perform(async () => {
    await controlContext("health");
    const provider = z.enum(["tmdb", "myanimelist"]).parse(input);
    if (!providerEnabled(provider))
      throw new DataAccessError(
        "SETUP_REQUIRED",
        "This provider is disabled or its release permission is unconfirmed.",
      );
    const start = Date.now();
    const { discoverProviderPage } =
      await import("@/lib/metadata/providers/discovery");
    const { invalidateCatalogResponses } =
      await import("@/lib/metadata/catalog-runtime");
    const { productQuerySchema } = await import("@/lib/product/validation");
    invalidateCatalogResponses(provider);
    const data = await discoverProviderPage(
      provider === "tmdb" ? "tmdb.movie" : "myanimelist.anime",
      provider === "tmdb" ? 1 : 0,
      productQuerySchema.parse({
        category: provider === "tmdb" ? "movie" : "anime",
      }),
    );
    return {
      provider,
      status: "operational",
      responseMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
      returned: data.items.length,
    };
  });
}
