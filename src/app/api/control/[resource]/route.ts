import { z } from "zod";
import { NextResponse } from "next/server";
import { controlContext, memberControlContext } from "@/lib/control/runtime";
import { DataAccessError, result } from "@/lib/data/errors";
import { controlModule } from "@/config/control-center";
import { catalogDiagnostics } from "@/lib/data/catalog-diagnostics";
import type { Row } from "@/types/database";

export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await context.params;
    const q = new URL(request.url).searchParams;
    const id = () => z.uuid().parse(q.get("id"));
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(q.get("page") || 1);
    const search = z
      .string()
      .trim()
      .max(120)
      .parse(q.get("q") || "");
    if (
      [
        "activity",
        "case",
        "invitations",
        "notices",
        "requests",
        "access",
        "documents",
      ].includes(resource)
    ) {
      if (resource === "documents") {
        const { createClient } = await import("@/lib/supabase/server");
        const client = await createClient();
        if (!client)
          throw new DataAccessError(
            "SETUP_REQUIRED",
            "Connect Supabase to read published articles.",
          );
        const kind = z
          .enum(["help", "announcement", "editorial"])
          .parse(q.get("kind") || "help");
        return reply(
          await result(
            client
              .from("control_documents")
              .select("*")
              .eq("kind", kind)
              .eq("status", "published")
              .ilike(
                "title",
                `%${search.replaceAll("%", "").replaceAll("_", "")}%`,
              )
              .order("updated_at", { ascending: false })
              .range((page - 1) * 24, page * 24),
          ),
        );
      }
      const { client, user } = await memberControlContext();
      if (resource === "access")
        return reply(await result(client.rpc("control_account_access")));
      if (resource === "invitations")
        return reply(
          await result(
            client
              .from("admin_invitations")
              .select("id,reason,status,created_at,expires_at")
              .eq("invited_user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(20),
          ),
        );
      if (resource === "notices")
        return reply(
          await result(
            client
              .from("control_notifications")
              .select("*")
              .eq("recipient_id", user.id)
              .order("created_at", { ascending: false })
              .range((page - 1) * 24, page * 24),
          ),
        );
      if (resource === "requests")
        return reply(
          await result(
            client.rpc("browse_title_requests", {
              p_query: search,
              p_status: q.get("status") || null,
              p_limit: 24,
              p_offset: (page - 1) * 24,
            }),
          ),
        );
      if (resource === "activity") {
        let read = client
          .from("control_cases")
          .select("*")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false });
        const kind = q.get("kind");
        if (kind)
          read = read.eq(
            "kind",
            z
              .enum([
                "report",
                "title_request",
                "correction",
                "appeal",
                "support",
              ])
              .parse(kind),
          );
        return reply(await result(read.range((page - 1) * 24, page * 24)));
      }
      const item = await result<Row<"control_cases">>(
        client.from("control_cases").select("*").eq("id", id()).maybeSingle(),
      );
      if (!item) return reply({ message: "This case is unavailable." }, 404);
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .parse(q.get("messageOffset") || 0);
      const messages = await result(
        client
          .from("control_messages")
          .select("*")
          .eq("case_id", item.id)
          .order("created_at")
          .order("id")
          .range(offset, offset + 49),
      );
      const decisions =
        item.kind === "correction"
          ? await result(
              client
                .from("correction_field_decisions")
                .select("*")
                .eq("case_id", item.id),
            )
          : [];
      const title = item.title_id
        ? await result(
            client
              .from("titles")
              .select(
                "id,display_title,original_title,description,kind,release_year,status,release_date,runtime_minutes,age_rating",
              )
              .eq("id", item.title_id)
              .maybeSingle(),
          )
        : null;
      const enforcement = item.enforcement_id
        ? await result(
            client
              .from("control_enforcements")
              .select(
                "id,kind,feature,explanation,starts_at,expires_at,revoked_at",
              )
              .eq("id", item.enforcement_id)
              .maybeSingle(),
          )
        : null;
      return reply({
        item,
        messages: messages ?? [],
        hasMoreMessages: (messages?.length ?? 0) === 50,
        decisions: decisions ?? [],
        title,
        enforcement,
      });
    }
    const section = q.get("section") || "overview";
    if (
      resource === "workspace" &&
      !controlModule(section) &&
      !["help", "templates"].includes(section)
    )
      return reply({ message: "Workspace not found." }, 404);
    const { client } = await controlContext(
      resource === "workspace"
        ? section
        : resource === "accounts"
          ? "team"
          : resource === "diagnostics"
            ? "health"
            : resource === "title"
              ? "catalog"
              : resource === "user"
                ? "users"
                : undefined,
    );
    if (resource === "workspace") {
      const date = z.iso.date().nullable();
      return reply(
        await result(
          client.rpc("control_workspace", {
            p_section: section,
            p_query: search,
            p_status: q.get("status") || null,
            p_page: page,
            p_from: date.parse(q.get("from")),
            p_to: date.parse(q.get("to")),
            p_assignment: z
              .enum(["mine", "unassigned"])
              .nullable()
              .parse(q.get("assignment")),
          }),
        ),
      );
    }
    if (resource === "search")
      return reply(
        await result(client.rpc("control_search", { p_query: search })),
      );
    if (resource === "accounts")
      return reply(
        await result(
          client.rpc("control_search_accounts", { p_query: search }),
        ),
      );
    if (resource === "identity")
      return reply((await controlContext()).identity);
    if (resource === "user")
      return reply(
        await result(client.rpc("control_user_detail", { p_id: id() })),
      );
    if (resource === "diagnostics") return reply(await catalogDiagnostics());
    if (resource === "title") {
      const titleId = id();
      const title = await result(
        client.from("titles").select("*").eq("id", titleId).maybeSingle(),
      );
      if (!title) return reply({ message: "Title not found." }, 404);
      const aliases = await result(
        client
          .from("title_names")
          .select("name")
          .eq("title_id", titleId)
          .limit(100),
      );
      const genres = await result(
        client
          .from("title_genres")
          .select("genres(name)")
          .eq("title_id", titleId)
          .limit(100),
      );
      const countries = await result(
        client
          .from("title_countries")
          .select("country_code")
          .eq("title_id", titleId)
          .limit(100),
      );
      const languages = await result(
        client
          .from("title_languages")
          .select("language_code")
          .eq("title_id", titleId)
          .limit(100),
      );
      const artwork = await result(
        client
          .from("title_artwork")
          .select("kind,url,attribution")
          .eq("title_id", titleId)
          .order("created_at", { ascending: false })
          .limit(20),
      );
      const locks = await result(
        client.from("metadata_locks").select("*").eq("title_id", titleId),
      );
      const revisions = await result(
        client
          .from("metadata_revisions")
          .select("*")
          .eq("title_id", titleId)
          .order("created_at", { ascending: false })
          .limit(24),
      );
      const mappings = await result(
        client
          .from("provider_title_ids")
          .select("id,external_id,external_type,provider_id")
          .eq("title_id", titleId),
      );
      return reply({
        title,
        aliases,
        genres,
        countries,
        languages,
        artwork,
        locks,
        revisions,
        mappings,
      });
    }
    return reply({ message: "Resource not found." }, 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return reply({ message: "Check the supplied filters." }, 400);
    if (error instanceof DataAccessError)
      return reply(
        { message: error.message, code: error.code },
        error.code === "AUTH_REQUIRED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : error.code === "INVALID_INPUT"
              ? 400
              : error.code === "RATE_LIMITED"
                ? 429
                : 503,
      );
    return reply(
      { message: "The workspace could not be loaded. Retry shortly." },
      503,
    );
  }
}
