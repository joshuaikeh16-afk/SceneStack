import "server-only";
import { z } from "zod";
import { DataAccessError, result } from "@/lib/data/errors";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/types/database";
import type {
  TitleFeedPage,
  TitleFeedSource,
  TitleView,
} from "@/types/product";
import { titleViews, browseCatalogRows } from "./queries";
import { activeClient, availabilityFor } from "./runtime";
import { productQuerySchema, type ProductQuery } from "./validation";
import { providerEnabled } from "@/config/providers";
import {
  applicableDiscoverySources,
  discoverProviderPage,
} from "@/lib/metadata/providers/discovery";
import {
  requireCatalogProvider,
  persistDiscoveredTitles,
} from "@/lib/metadata/catalog-store";
import {
  decodeFederatedCursor,
  encodeFederatedCursor,
  federatedFeedPage,
} from "./federated-feed";
import {
  catalogSeek,
  catalogSortColumns,
  feedScope,
  feedSourceSchema,
  pageLinks,
  readFeedCursor,
  usesCatalogKeyset,
} from "./feed-cursor";

type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;
type Cursor = ReturnType<typeof readFeedCursor>;
type TitleRef = { id: string; reason?: string };

async function viewsForRefs(client: Client, refs: TitleRef[]) {
  if (!refs.length) return [];
  const rows = await result(
    client
      .from("titles")
      .select("*")
      .in(
        "id",
        refs.map((r) => r.id),
      ),
  );
  const views = await titleViews(rows ?? []);
  const byId = new Map(views.map((t) => [t.sourceId ?? t.id, t]));
  return refs.flatMap(({ id, reason }) => {
    const title = byId.get(id);
    return title ? [{ ...title, reason }] : [];
  });
}

async function catalogKeysetPage(
  client: Client,
  q: ProductQuery,
  cursor: Cursor,
) {
  const column = catalogSortColumns[q.sort];
  const backwards = cursor.direction === "previous";
  let query = client
    .from("titles")
    .select("*")
    .neq("status", "merged")
    .lte("created_at", cursor.cutoff)
    .order(column, {
      ascending: (q.sort === "title") !== backwards,
      nullsFirst: backwards,
    })
    .order("id", { ascending: !backwards });
  if (q.category) query = query.eq("kind", q.category);
  if (q.status) query = query.eq("status", q.status);
  if (q.year) query = query.eq("release_year", q.year);
  if (cursor.edge)
    query = query.or(catalogSeek(q.sort, cursor.direction, cursor.edge));
  // A direct legacy ?page=N link has no boundary row. Seek by offset once,
  // then every link in either direction uses the sorted value plus UUID.
  const skip = cursor.edge ? 0 : cursor.offset;
  const rows = (await result(query.range(skip, skip + q.limit))) ?? [];
  const page = rows.slice(0, q.limit);
  if (backwards) page.reverse();
  const edge = (r: Row<"titles">) => ({ id: r.id, value: r[column] });
  return {
    titles: await titleViews(page),
    ...pageLinks(
      cursor,
      q.limit,
      page.length > 0 && (!backwards || rows.length > q.limit),
      backwards ? page.length > 0 : rows.length > q.limit,
      page[0] && edge(page[0]),
      page.at(-1) && edge(page[page.length - 1]),
    ),
  };
}

async function rankedPage(
  client: Client,
  source: TitleFeedSource,
  q: ProductQuery,
  cursor: Cursor,
  userId: string | null,
) {
  let titles: TitleView[];
  let size: number;
  const { offset } = cursor;
  if (source === "recent" || source === "recommendations") {
    let refs: TitleRef[];
    if (source === "recent") {
      if (!userId)
        throw new DataAccessError(
          "AUTH_REQUIRED",
          "Sign in to see your viewing history.",
        );
      const since = new Date(
        Date.parse(cursor.cutoff) - 90 * 86_400_000,
      ).toISOString();
      const rows = await result(
        client
          .from("recent_titles")
          .select("title_id")
          .eq("user_id", userId)
          .gt("viewed_at", since)
          .lte("viewed_at", cursor.cutoff)
          .order("viewed_at", { ascending: false })
          .order("title_id")
          .range(offset, offset + q.limit),
      );
      refs = (rows ?? []).map((r) => ({ id: r.title_id }));
    } else {
      // The recommendation RPC exposes a ranked top 100, with no cursor or
      // offset. Only hydrate this page of that bounded, current-user ranking.
      const top = Math.min(100, offset + q.limit + 1);
      const raw = await result(
        client.rpc("recommend_title_ids", { p_limit: top }),
      );
      refs = z
        .array(z.object({ id: z.uuid(), reason: z.string() }))
        .max(100)
        .parse(raw)
        .slice(offset);
    }
    size = refs.length;
    titles = await viewsForRefs(client, refs.slice(0, q.limit));
  } else {
    const rows =
      source === "catalog"
        ? await browseCatalogRows(client, q, offset)
        : await result(
            client.rpc("library_titles", {
              p_section: "tracking",
              p_status: source,
              p_query: "",
              p_sort: "updated",
              p_limit: q.limit + 1,
              p_offset: offset,
            }),
          );
    size = rows?.length ?? 0;
    titles = await titleViews(
      (rows ?? [])
        .slice(0, q.limit)
        .filter((r) => source !== "catalog" || r.created_at <= cursor.cutoff),
    );
  }
  return { titles, ...pageLinks(cursor, q.limit, offset > 0, size > q.limit) };
}

async function readLocalTitleFeedPage(
  source: TitleFeedSource,
  input: unknown,
  token?: string | null,
): Promise<TitleFeedPage> {
  feedSourceSchema.parse(source);
  const q = productQuerySchema.parse(input);
  if (q.tab !== "titles")
    throw new DataAccessError("INVALID_INPUT", "Choose a title feed.");
  const context = source === "catalog" ? null : await activeClient();
  const userId = context?.userId ?? null;
  const keyset = usesCatalogKeyset(source, q);
  const cursor = readFeedCursor(token, feedScope(source, q, userId), q, keyset);
  const client = context?.client ?? (await createClient());
  if (!client)
    return {
      availability: "unconfigured",
      offset: cursor.offset,
      titles: [],
      previousCursor: null,
      nextCursor: null,
    };
  const page = keyset
    ? await catalogKeysetPage(client, q, cursor)
    : await rankedPage(client, source, q, cursor, userId);
  // Different source rows can resolve to the same canonical UUID after a merge.
  const ids = new Set<string>();
  const titles = page.titles.filter((t) => {
    if (ids.has(t.id)) return false;
    ids.add(t.id);
    return true;
  });
  return { ...page, titles, availability: "ready" };
}

export async function readTitleFeedPage(
  source: TitleFeedSource,
  input: unknown,
  token?: string | null,
): Promise<TitleFeedPage> {
  feedSourceSchema.parse(source);
  if (source !== "catalog") return readLocalTitleFeedPage(source, input, token);
  const q = productQuerySchema.parse(input);
  if (q.tab !== "titles")
    throw new DataAccessError("INVALID_INPUT", "Choose a title feed.");
  const sources = applicableDiscoverySources(q).filter((s) =>
    providerEnabled(s.startsWith("tmdb") ? "tmdb" : "myanimelist"),
  );
  if (!sources.length) {
    if (token?.startsWith("fed."))
      throw new DataAccessError(
        "INVALID_INPUT",
        "Provider availability changed. Restart this search.",
      );
    const local = await readLocalTitleFeedPage(source, q, token);
    return {
      ...local,
      catalog: {
        mode: "local",
        providers: [],
        limitations: [
          q.rating
            ? "Community-rating filters apply to locally rated titles; external provider scores are not used."
            : "External discovery is disabled or does not support these filters. Only cached matches are shown.",
        ],
        terminal: local.nextCursor ? null : "cache_only",
      },
    };
  }
  const client = await createClient();
  if (!client)
    return {
      availability: "unconfigured",
      titles: [],
      offset: 0,
      nextCursor: null,
      previousCursor: null,
    };
  const secret =
    process.env.CATALOG_CURSOR_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!secret || secret.length < 24)
    throw new DataAccessError(
      "SETUP_REQUIRED",
      "Server catalog storage and cursor signing must be configured for discovery.",
    );
  const scope = feedScope(source, q, null) + ":" + sources.join(",");
  const state = decodeFederatedCursor(token, scope, sources, secret);
  const genre = q.genre
    ? await result<{ name: string }>(
        client.from("genres").select("name").eq("id", q.genre).maybeSingle(),
      )
    : null;
  if (q.genre && !genre)
    throw new DataAccessError(
      "INVALID_INPUT",
      "This genre is no longer available. Clear the filter and retry.",
    );
  const page = await federatedFeedPage(q, state, {
    local: (cursor, limit) =>
      readLocalTitleFeedPage("catalog", { ...q, limit }, cursor),
    remote: async (source, number) => {
      await requireCatalogProvider(
        source.startsWith("tmdb") ? "tmdb" : "myanimelist",
      );
      return discoverProviderPage(source, number, {
        ...q,
        genreName: genre?.name,
      });
    },
    persist: (provider, titles, cutoff) =>
      persistDiscoveredTitles(provider, titles, cutoff, !!q.q),
    views: (ids) =>
      viewsForRefs(
        client,
        ids.map((id) => ({ id })),
      ),
  });
  const previous = state.history.at(-1);
  return {
    availability: "ready",
    titles: page.titles,
    offset: page.offset,
    nextCursor: page.more ? encodeFederatedCursor(page.state, secret) : null,
    previousCursor: previous
      ? encodeFederatedCursor(
          {
            ...state,
            ...previous,
            seen: [],
            history: state.history.slice(0, -1),
          },
          secret,
        )
      : null,
    issues: page.issues,
    catalog: {
      mode: "federated",
      providers: [...new Set(sources.map((s) => s.split(".")[0]))],
      limitations: [
        "Results combine cached matches with ranked provider pages. Ordering is applied within each source.",
        ...(sources.includes("myanimelist.anime") && q.sort !== "popular"
          ? [
              "MyAnimeList supplies popularity-ranked pages; global alphabetical/release sorting is not available from that endpoint.",
            ]
          : []),
      ],
      terminal: page.more
        ? null
        : page.limited
          ? "pagination_limit"
          : "exhausted",
    },
  };
}

// Server-rendered first pages retain the existing setup/unavailable notices.
// The route uses readTitleFeedPage so pagination failures have HTTP error status.
export async function titleFeedPage(
  source: TitleFeedSource,
  input: unknown,
  token?: string | null,
): Promise<TitleFeedPage> {
  try {
    return await readTitleFeedPage(source, input, token);
  } catch (error) {
    return {
      availability: availabilityFor(error),
      titles: [],
      offset: 0,
      nextCursor: null,
      previousCursor: null,
    };
  }
}
