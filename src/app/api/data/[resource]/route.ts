import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import {
  discoveryHistory,
  continueExploring,
  recentCollections,
  followedCollections,
  creatorCollections,
  discoverData,
  lookups,
  titleStates,
  libraryData,
  userCollections,
  collectionDetails,
  publicProfile,
  notificationData,
} from "@/lib/product/queries";
import { readTitleFeedPage } from "@/lib/product/title-feed";
import { feedSourceSchema } from "@/lib/product/feed-cursor";
import { getBootstrap, activeClient } from "@/lib/product/runtime";
import {
  productQuerySchema,
  libraryQuerySchema,
} from "@/lib/product/validation";
import { idSchema } from "@/lib/validation/data";
import { DataAccessError, result } from "@/lib/data/errors";
import { getPreferences } from "@/lib/data/profiles";
import { catalogDiagnostics } from "@/lib/data/catalog-diagnostics";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource } = await params;
  const q = request.nextUrl.searchParams;
  const page = () =>
    z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(q.get("page") || 1);
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        ...(status === 429 && { "Retry-After": "30" }),
        "X-Content-Type-Options": "nosniff",
      },
    });
  try {
    if (resource === "title-feed") {
      const { source, cursor, ...query } = Object.fromEntries(q);
      const data = await readTitleFeedPage(
        feedSourceSchema.parse(source),
        query,
        cursor,
      );
      if (data.availability !== "ready")
        return reply(
          {
            message: "The title catalog is unavailable.",
            code: data.availability,
          },
          503,
        );
      return reply(data);
    }
    if (resource === "recent-collections")
      return reply(await recentCollections());
    if (resource === "catalog") {
      const input = productQuerySchema.parse(Object.fromEntries(q));
      if (input.tab !== "titles") return reply(await discoverData(input));
      const page = await readTitleFeedPage("catalog", input);
      return reply({ ...page, hasMore: !!page.nextCursor });
    }
    if (resource === "history") return reply(await discoveryHistory());
    if (resource === "continue") return reply(await continueExploring());
    if (resource === "feed") return reply(await followedCollections(page()));
    if (resource === "selectable-titles") {
      const values = Object.fromEntries(q);
      const collectionId = idSchema.parse(values.collectionId);
      delete values.collectionId;
      const cursor = values.cursor;
      delete values.cursor;
      const { client } = await activeClient();
      const data = await readTitleFeedPage(
        "catalog",
        productQuerySchema.parse(values),
        cursor,
      );
      const included = await result(
        client.rpc("included_collection_titles", {
          p_collection: collectionId,
          p_titles: data.titles.map((t) => t.id),
        }),
      );
      return reply({ ...data, includedIds: included });
    }
    if (resource === "bootstrap") return reply(await getBootstrap());
    if (resource === "lookups") return reply(await lookups());
    if (resource === "title-state")
      return reply(
        await titleStates((q.get("ids") || "").split(",").filter(Boolean)),
      );
    if (resource === "library")
      return reply(
        await libraryData(libraryQuerySchema.parse(Object.fromEntries(q))),
      );
    if (resource === "own-collections")
      return reply(
        await userCollections(
          page(),
          z
            .array(idSchema)
            .max(100)
            .parse((q.get("ids") || "").split(",").filter(Boolean)),
        ),
      );
    if (resource === "collection")
      return reply(
        await collectionDetails(
          idSchema.parse(q.get("id")),
          z.coerce
            .number()
            .int()
            .min(0)
            .max(1000000)
            .parse(q.get("offset") || 0),
          48,
          {
            revealed: q.get("reveal") === "1",
            q: z
              .string()
              .max(120)
              .parse(q.get("q") || ""),
            sort: z
              .enum(["manual", "title", "year", "added", "category", "rating"])
              .parse(q.get("sort") || "manual"),
            category: q.has("category")
              ? z
                  .enum([
                    "movie",
                    "anime",
                    "series",
                    "cartoon",
                    "drama",
                    "documentary",
                  ])
                  .parse(q.get("category"))
              : undefined,
          },
        ),
      );
    if (resource === "profile-collections")
      return reply(await creatorCollections(q.get("id"), page()));
    if (resource === "profile") return reply(await publicProfile(q.get("id")));
    if (resource === "notifications")
      return reply(await notificationData(page()));
    if (resource === "my-counts") {
      const { client } = await activeClient();
      return reply(await result(client.rpc("my_library_counts")));
    }
    if (resource === "blocked") {
      const { client } = await activeClient();
      return reply(
        await result(
          client.rpc("blocked_accounts", {
            p_limit: 24,
            p_offset: (page() - 1) * 24,
          }),
        ),
      );
    }
    if (resource === "preferences") return reply(await getPreferences());
    if (resource === "recommendations")
      return reply(
        (await readTitleFeedPage("recommendations", { limit: 24 })).titles,
      );
    if (resource === "admin") {
      const { client, bootstrap } = await activeClient();
      const superAdmin = bootstrap.roles.includes("super_admin"),
        moderator = superAdmin || bootstrap.roles.includes("moderator"),
        editor = superAdmin || bootstrap.roles.includes("catalog_editor");
      if (!moderator && !editor)
        throw new DataAccessError(
          "FORBIDDEN",
          "Administration is not available for your account.",
        );
      const section = z
        .enum([
          "overview",
          "users",
          "reports",
          "catalog",
          "missing",
          "corrections",
          "merges",
          "providers",
          "diagnostics",
          "audit",
        ])
        .parse(q.get("section") || "overview");
      const offset = (page() - 1) * 24;
      if (section === "overview")
        return reply(await result(client.rpc("admin_summary")));
      if (section === "users") {
        if (!moderator)
          throw new DataAccessError("FORBIDDEN", "Moderator access required.");
        return reply(
          await result(
            client.rpc("admin_profiles", {
              p_query: z
                .string()
                .max(120)
                .parse(q.get("q") || ""),
              p_limit: 24,
              p_offset: offset,
            }),
          ),
        );
      }
      if (section === "reports") {
        if (!moderator)
          throw new DataAccessError("FORBIDDEN", "Moderator access required.");
        return reply(
          await result(
            client
              .from("reports")
              .select("*")
              .order("created_at", { ascending: false })
              .range(offset, offset + 23),
          ),
        );
      }
      if (section === "audit") {
        if (!superAdmin)
          throw new DataAccessError(
            "FORBIDDEN",
            "Super Admin access required.",
          );
        return reply(
          await result(
            client
              .from("audit_logs")
              .select("*")
              .order("created_at", { ascending: false })
              .range(offset, offset + 23),
          ),
        );
      }
      if (!editor)
        throw new DataAccessError(
          "FORBIDDEN",
          "Catalog Editor access required.",
        );
      if (section === "diagnostics") return reply(await catalogDiagnostics());
      if (section === "catalog")
        return reply(
          await result(
            client
              .from("titles")
              .select("*")
              .order("updated_at", { ascending: false })
              .range(offset, offset + 23),
          ),
        );
      if (section === "providers")
        return reply({
          sync: await result(
            client
              .from("provider_sync_state")
              .select("*")
              .order("updated_at", { ascending: false })
              .range(offset, offset + 23),
          ),
          alerts: await result(
            client
              .from("admin_alerts")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(24),
          ),
        });
      const table =
        section === "missing"
          ? "missing_title_requests"
          : section === "corrections"
            ? "metadata_corrections"
            : "catalog_merge_requests";
      return reply(
        await result(
          client
            .from(table)
            .select("*")
            .order("created_at", { ascending: false })
            .range(offset, offset + 23),
        ),
      );
    }
    return reply({ message: "Not found." }, 404);
  } catch (error) {
    if (error instanceof ZodError)
      return reply({ message: "Check the search or filter values." }, 400);
    if (error instanceof DataAccessError && error.code === "RATE_LIMITED")
      return reply({ message: error.message, code: error.code }, 429);
    if (error instanceof DataAccessError)
      return reply(
        { message: error.message, code: error.code },
        error.code === "INVALID_INPUT"
          ? 400
          : error.code === "AUTH_REQUIRED"
            ? 401
            : error.code === "FORBIDDEN"
              ? 403
              : 503,
      );
    return reply({ message: "This data is temporarily unavailable." }, 503);
  }
}
