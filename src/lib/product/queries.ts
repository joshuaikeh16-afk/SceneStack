import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getBootstrap, activeClient, availabilityFor } from "./runtime";
import {
  productQuerySchema,
  libraryQuerySchema,
  type ProductQuery,
} from "./validation";
import { idSchema } from "@/lib/validation/data";
import { result } from "@/lib/data/errors";
import type { Row } from "@/types/database";
import type {
  TitleView,
  TitleDetails,
  TitleState,
  CatalogResult,
  CollectionView,
  CollectionDetails,
  ProfileView,
  LibraryResult,
  LookupData,
  NotificationView,
} from "@/types/product";
import { approvedImagePath } from "@/lib/metadata/presentation";
import { restrictedTitleIds } from "@/lib/metadata/release-policy";
import { providerArtworkAllowed } from "@/config/providers";

const profileFields =
  "id,username,display_name,avatar_path,bio,cover_path,featured_collection_id,created_at" as const;
export async function titleViews(rows: Row<"titles">[]): Promise<TitleView[]> {
  const client = await createClient();
  if (!client || !rows.length) return [];
  const sourceIds = rows.map((r) => r.id);
  const redirects = await result(
    client
      .from("title_redirects")
      .select("source_id,target_id")
      .in("source_id", sourceIds),
  );
  if (redirects?.length) {
    const canonicalRows = await result(
      client
        .from("titles")
        .select("*")
        .in(
          "id",
          redirects.map((r) => r.target_id),
        ),
    );
    rows = rows.map(
      (row) =>
        canonicalRows?.find(
          (c) =>
            c.id === redirects.find((r) => r.source_id === row.id)?.target_id,
        ) ?? row,
    );
  }
  const ids = rows.map((row) => row.id);
  const [raw, rawFreshness, restricted] = await Promise.all([
    result(client.rpc("title_card_data", { p_ids: ids })),
    result(client.rpc("catalog_freshness", { p_ids: ids })),
    restrictedTitleIds(ids),
  ]);
  const freshness = z
    .array(
      z.object({
        id: z.string(),
        lastSuccessAt: z.string().nullable(),
        stale: z.boolean().nullable(),
      }),
    )
    .parse(rawFreshness);
  const metadata = z
    .array(
      z.object({
        id: z.string(),
        genres: z.array(z.object({ id: z.string(), name: z.string() })),
        poster: z.string().nullable(),
        backdrop: z.string().nullable(),
        rating: z.object({
          score: z.number().nullable(),
          voteCount: z.number(),
        }),
      }),
    )
    .parse(raw);
  return rows.flatMap((row, index) => {
    if (restricted.has(row.id)) return [];
    const meta = metadata.find((m) => m.id === row.id);
    const score = meta?.rating.score ?? null;
    const votes = meta?.rating.voteCount ?? 0;
    return [
      {
        id: row.id,
        sourceId: sourceIds[index],
        title: {
          reference: { provider: "scenestack", providerId: row.id },
          name: row.display_title,
          kind: row.kind,
          synopsis: row.description || null,
          posterUrl: providerArtworkAllowed(meta?.poster ?? null)
            ? approvedImagePath(meta?.poster ?? null)
            : null,
          backdropUrl: providerArtworkAllowed(meta?.backdrop ?? null)
            ? approvedImagePath(meta?.backdrop ?? null)
            : null,
          releaseYear: row.release_year,
          episodeCount: null,
        },
        genres: meta?.genres ?? [],
        communityRating:
          score === null
            ? null
            : { source: "scenestack", score, voteCount: votes },
        voteCount: votes,
        status: row.status,
        edition: row.edition,
        freshness: {
          lastSuccessAt:
            freshness.find((f) => f.id === row.id)?.lastSuccessAt ?? null,
          stale: freshness.find((f) => f.id === row.id)?.stale ?? false,
        },
      },
    ];
  });
}
export async function getTitleDetails(
  input: unknown,
): Promise<TitleDetails | null> {
  const id = idSchema.safeParse(
    typeof input === "string" ? input.replace(/^scenestack--/, "") : input,
  );
  if (!id.success) return null;
  const client = await createClient();
  if (!client) return null;
  const resolved = await result(
    client.rpc("resolve_title", { p_title: id.data }),
  );
  if (!resolved) return null;
  const { hydrateDiscoveredTitle } = await import("@/lib/metadata/catalog-store");
  await hydrateDiscoveredTitle(resolved).catch(() => undefined);
  const row = await result<Row<"titles">>(
    client.from("titles").select("*").eq("id", resolved).maybeSingle(),
  );
  if (!row) return null;
  const [
    views,
    credits,
    trailers,
    relations,
    providers,
    externalIds,
    rawExtras,
  ] = await Promise.all([
    titleViews([row]),
    result(
      client
        .from("title_credits")
        .select("id,person_id,department,role_name")
        .eq("title_id", row.id)
        .order("billing_order")
        .limit(20),
    ),
    result(
      client
        .from("title_trailers")
        .select("id,url,label")
        .eq("title_id", row.id)
        .limit(4),
    ),
    result(
      client
        .from("title_relations")
        .select("related_id,relation")
        .eq("verified", true)
        .eq("source_id", row.id)
        .limit(12),
    ),
    result(
      client.from("metadata_providers").select("id,name,attribution,terms_url"),
    ),
    result(
      client
        .from("provider_title_ids")
        .select("provider_id")
        .eq("title_id", row.id),
    ),
    result(client.rpc("catalog_title_extras", { p_title: row.id })),
  ]);
  if (!views.length) return null;
  const extras = z
    .object({
      aliases: z.array(z.string()),
      countries: z.array(z.string()),
      languages: z.array(z.string()),
      companies: z.array(z.string()),
      warnings: z.array(z.string()),
    })
    .parse(rawExtras);
  const people = credits?.length
    ? await result(
        client
          .from("people")
          .select("id,name")
          .in(
            "id",
            credits.map((c) => c.person_id),
          ),
      )
    : [];
  const relatedRows = relations?.length
    ? await result(
        client
          .from("titles")
          .select("*")
          .in(
            "id",
            relations.map((r) => r.related_id),
          ),
      )
    : [];
  return {
    ...views[0],
    ...extras,
    releaseDate: row.release_date,
    runtimeMinutes: row.runtime_minutes,
    relationshipLabels: Object.fromEntries(
      (relations ?? []).map((r) => [r.related_id, r.relation]),
    ),
    originalTitle: row.original_title,
    ageRating: row.age_rating,
    credits: (credits ?? [])
      .map((c) => ({
        id: c.id,
        name: people?.find((p) => p.id === c.person_id)?.name ?? "",
        department: c.department,
        role: c.role_name,
      }))
      .filter((c) => c.name),
    trailers: (trailers ?? []).filter((t) =>
      /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+|vimeo\.com\/\d+)$/.test(
        t.url,
      ),
    ),
    related: await titleViews(relatedRows ?? []),
    providerAttributions: (providers ?? [])
      .filter((p) => externalIds?.some((x) => x.provider_id === p.id))
      .map((p) => ({
        name: p.name,
        termsUrl: p.terms_url,
        attribution: p.attribution,
      })),
  };
}
export async function titleStates(input: unknown): Promise<TitleState[]> {
  const ids = z.array(idSchema).max(100).parse(input);
  if (!ids.length) return [];
  const { client } = await activeClient();
  const raw = await result(client.rpc("personal_title_states", { p_ids: ids }));
  return z
    .array(
      z.object({
        titleId: idSchema,
        tracking: z
          .enum(["planned", "watching", "completed", "on_hold", "dropped"])
          .nullable(),
        favorite: z.boolean(),
        rating: z.number().nullable(),
      }),
    )
    .parse(raw);
}
export async function lookups(): Promise<LookupData> {
  const client = await createClient();
  if (!client) return { genres: [], countries: [], languages: [] };
  const [genres, countries, languages] = await Promise.all([
    result(client.from("genres").select("id,name").order("name")),
    result(client.from("countries").select("code,name").order("name")),
    result(client.from("languages").select("code,name").order("name")),
  ]);
  return {
    genres: genres ?? [],
    countries: countries ?? [],
    languages: languages ?? [],
  };
}
export async function collectionViews(
  rows: Row<"collections">[],
  { revealSpoilers = false }: { revealSpoilers?: boolean } = {},
): Promise<CollectionView[]> {
  const client = await createClient();
  if (!client || !rows.length) return [];
  const context = await getBootstrap();
  const ids = rows.map((r) => r.id);
  const [creators, rawCards, favorites, saves, imports] = await Promise.all([
    result(
      client
        .from("profiles")
        .select(profileFields)
        .in("id", [...new Set(rows.map((r) => r.owner_id))]),
    ),
    result(client.rpc("collection_card_data", { p_ids: ids })),
    context.userId
      ? result(
          client
            .from("collection_favorites")
            .select("collection_id")
            .eq("user_id", context.userId)
            .in("collection_id", ids),
        )
      : [],
    context.userId
      ? result(
          client
            .from("collection_saves")
            .select("collection_id")
            .eq("user_id", context.userId)
            .in("collection_id", ids),
        )
      : [],
    context.userId
      ? result(
          client
            .from("collection_imports")
            .select("imported_collection_id,source_owner_id")
            .eq("user_id", context.userId)
            .in("imported_collection_id", ids),
        )
      : [],
  ]);
  const cards = z
    .array(
      z.object({
        id: z.string(),
        count: z.number(),
        titleIds: z.array(z.string()),
      }),
    )
    .parse(rawCards);
  const coverIds = [...new Set(cards.flatMap((c) => c.titleIds))];
  const artwork = coverIds.length
    ? await result(
        client
          .from("title_artwork")
          .select("title_id,url")
          .eq("kind", "poster")
          .in("title_id", coverIds),
      )
    : [];
  const sourceIds = (imports ?? []).flatMap((i) =>
    i.source_owner_id ? [i.source_owner_id] : [],
  );
  const sources = sourceIds.length
    ? await result(
        client.from("profiles").select(profileFields).in("id", sourceIds),
      )
    : [];
  return rows.map((record) => {
    const imported = (imports ?? []).find(
      (i) => i.imported_collection_id === record.id,
    );
    const card = cards.find((c) => c.id === record.id);
    return {
      record:
        record.spoiler_warning &&
        record.owner_id !== context.userId &&
        !revealSpoilers
          ? {
              ...record,
              description: "",
              cover_path: null,
              collage_reference: null,
            }
          : record,
      creator: creators?.find((p) => p.id === record.owner_id) ?? null,
      count: card?.count ?? 0,
      posters: (record.spoiler_warning &&
      record.owner_id !== context.userId &&
      !revealSpoilers
        ? []
        : (card?.titleIds ?? [])
      ).map((id) =>
        approvedImagePath(
          (artwork ?? []).find(
            (a) => a.title_id === id && providerArtworkAllowed(a.url),
          )?.url ?? null,
        ),
      ),
      favorite: !!favorites?.some((f) => f.collection_id === record.id),
      saved: !!saves?.some((s) => s.collection_id === record.id),
      sourceCreator:
        sources?.find((p) => p.id === imported?.source_owner_id) ?? null,
      sourceDeleted: !!imported && !imported.source_owner_id,
    };
  });
}
export function browseCatalogRows(
  client: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  q: ProductQuery,
  offset: number,
) {
  return result(
    client.rpc("browse_catalog", {
      p_query: q.q,
      p_category: q.category ?? null,
      p_year: q.year ?? null,
      p_genre: q.genre ?? null,
      p_language: q.language ?? null,
      p_country: q.country ?? null,
      p_min_rating: q.rating ?? null,
      p_sort: q.sort,
      p_status: q.status ?? null,
      p_limit: q.limit + 1,
      p_offset: offset,
    }),
  );
}

export async function discoverData(input: unknown): Promise<CatalogResult> {
  const q = productQuerySchema.parse(input);
  const client = await createClient();
  if (!client)
    return { availability: "unconfigured", titles: [], hasMore: false };
  try {
    if (q.tab !== "titles") {
      await activeClient();
      if (q.tab === "people") {
        const people = z
          .array(
            z.object({
              id: idSchema,
              username: z.string().nullable(),
              display_name: z.string(),
              avatar_path: z.string().nullable(),
              cover_path: z.string().nullable(),
              featured_collection_id: z.string().nullable(),
              bio: z.string(),
              created_at: z.string(),
            }),
          )
          .parse(
            await result(
              client.rpc("search_creators", {
                p_query: q.q,
                p_limit: q.limit + 1,
                p_offset: (q.page - 1) * q.limit,
              }),
            ),
          );
        return {
          availability: "ready",
          titles: [],
          people: (people ?? []).slice(0, q.limit),
          hasMore: (people?.length ?? 0) > q.limit,
        };
      }
      let query = client
        .from("collections")
        .select("*")
        .eq("visibility", "published")
        .order("updated_at", { ascending: false })
        .order("id")
        .range((q.page - 1) * q.limit, q.page * q.limit);
      if (q.q)
        query = query.ilike("title", `%${q.q.replace(/[%_\\]/g, "\\$&")}%`);
      const rows = await result(query);
      return {
        availability: "ready",
        titles: [],
        collections: await collectionViews((rows ?? []).slice(0, q.limit)),
        hasMore: (rows?.length ?? 0) > q.limit,
      };
    }
    const rows = await browseCatalogRows(client, q, (q.page - 1) * q.limit);
    return {
      availability: "ready",
      titles: await titleViews((rows ?? []).slice(0, q.limit)),
      hasMore: (rows?.length ?? 0) > q.limit,
    };
  } catch (error) {
    return { availability: availabilityFor(error), titles: [], hasMore: false };
  }
}
export async function collectionDetails(
  input: unknown,
  offset = 0,
  limit = 48,
  options: {
    revealed?: boolean;
    q?: string;
    category?: Row<"titles">["kind"];
    sort?: string;
  } = {},
): Promise<CollectionDetails | null> {
  const id = idSchema.parse(input);
  const { client, userId } = await activeClient();
  const row = await result<Row<"collections">>(
    client.from("collections").select("*").eq("id", id).maybeSingle(),
  );
  if (!row) return null;
  const [view] = await collectionViews([row], {
    revealSpoilers: !!options.revealed,
  });
  if (row.spoiler_warning && row.owner_id !== userId && !options.revealed)
    return {
      ...view,
      items: [],
      hasMore: false,
      nextItemId: null,
      metrics: null,
      spoilerGated: true,
    };
  const items = await result(
    client.rpc("collection_items_page", {
      p_collection: id,
      p_query: options.q ?? "",
      p_category: options.category ?? null,
      p_sort: options.sort ?? "manual",
      p_limit: limit + 1,
      p_offset: offset,
    }),
  );
  const titleRows = items?.length
    ? await result(
        client
          .from("titles")
          .select("*")
          .in(
            "id",
            items.map((i) => i.title_id),
          ),
      )
    : [];
  const titles = await titleViews(titleRows ?? []);
  const metrics =
    row.owner_id === userId
      ? await result(client.rpc("collection_metrics", { p_collection: id }))
      : null;
  const parsed = z
    .object({ favorites: z.number(), saves: z.number(), imports: z.number() })
    .safeParse(metrics);
  return {
    ...view,
    items: (items ?? []).slice(0, limit).flatMap((i) => {
      const title = titles.find(
        (t) => t.id === i.title_id || t.sourceId === i.title_id,
      );
      return title
        ? [
            {
              id: i.id,
              position: i.position,
              note: i.creator_note,
              addedAt: i.created_at,
              title,
            },
          ]
        : [];
    }),
    hasMore: (items?.length ?? 0) > limit,
    nextItemId: items?.[limit]?.id ?? null,
    metrics: parsed.success ? parsed.data : null,
    spoilerGated: false,
  };
}
export async function libraryData(input: unknown): Promise<LibraryResult> {
  const q = libraryQuerySchema.parse(input);
  try {
    const { client } = await activeClient();
    if (["collections", "saved", "imported"].includes(q.section)) {
      const rows = await result(
        client.rpc("library_collections", {
          p_section: q.section,
          p_query: q.q,
          p_sort: q.sort,
          p_limit: q.limit + 1,
          p_offset: (q.page - 1) * q.limit,
        }),
      );

      return {
        availability: "ready",
        titles: [],
        states: [],
        collections: await collectionViews((rows ?? []).slice(0, q.limit)),
        hasMore: (rows?.length ?? 0) > q.limit,
      };
    }
    const rows = await result(
      client.rpc("library_titles", {
        p_section: q.section,
        p_status: q.status === "all" ? null : q.status,
        p_query: q.q,
        p_sort: q.sort,
        p_limit: q.limit + 1,
        p_offset: (q.page - 1) * q.limit,
      }),
    );
    const titles = await titleViews((rows ?? []).slice(0, q.limit));
    return {
      availability: "ready",
      titles,
      states: await titleStates(titles.map((t) => t.id)),
      collections: [],
      hasMore: (rows?.length ?? 0) > q.limit,
    };
  } catch (error) {
    return {
      availability: availabilityFor(error),
      titles: [],
      states: [],
      collections: [],
      hasMore: false,
    };
  }
}
export async function userCollections(page = 1, selectedTitles: string[] = []) {
  const { client, userId } = await activeClient();
  const rows = await result(
    client
      .from("collections")
      .select("*")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .order("id")
      .range((page - 1) * 50, page * 50 - 1),
  );
  const views = await collectionViews(rows ?? []);
  if (!selectedTitles.length || !views.length) return views;
  const counts = z
    .array(z.object({ collectionId: idSchema, count: z.number() }))
    .parse(
      await result(
        client.rpc("collection_memberships", {
          p_collections: views.map((v) => v.record.id),
          p_titles: selectedTitles,
        }),
      ),
    );
  return views.map((v) => ({
    ...v,
    selectedTitleCount:
      counts.find((c) => c.collectionId === v.record.id)?.count ?? 0,
  }));
}
export async function publicProfile(input: unknown): Promise<{
  profile: ProfileView;
  collections: CollectionView[];
  followers: number;
  following: number;
  isFollowing: boolean;
  featuredCollection?: CollectionView | null;
} | null> {
  const slug = z.string().max(80).parse(input);
  const { client, userId } = await activeClient();
  let query = client.from("profiles").select(profileFields);
  query = idSchema.safeParse(slug).success
    ? query.eq("id", slug)
    : query.eq("username", slug.toLowerCase());
  const profile = await result<ProfileView>(query.maybeSingle());
  if (!profile) return null;
  const [collections, counts, follow] = await Promise.all([
    result(
      client
        .from("collections")
        .select("*")
        .eq("owner_id", profile.id)
        .eq("visibility", "published")
        .order("updated_at", { ascending: false })
        .limit(24),
    ),
    result(client.rpc("follow_counts", { p_user: profile.id })),
    result(
      client
        .from("follows")
        .select("id")
        .eq("follower_id", userId)
        .eq("followed_id", profile.id)
        .maybeSingle(),
    ),
  ]);
  const parsed = z
    .object({ followers: z.number(), following: z.number() })
    .parse(counts);
  const featuredRow = profile.featured_collection_id
    ? await result<Row<"collections">>(
        client
          .from("collections")
          .select("*")
          .eq("id", profile.featured_collection_id)
          .eq("visibility", "published")
          .maybeSingle(),
      )
    : null;
  return {
    profile,
    featuredCollection: featuredRow
      ? (await collectionViews([featuredRow]))[0]
      : null,
    collections: await collectionViews(collections ?? []),
    ...parsed,
    isFollowing: !!follow,
  };
}
export async function notificationData(
  page = 1,
): Promise<{ items: NotificationView[]; unread: number; hasMore: boolean }> {
  const { client, userId } = await activeClient();
  const [rows, count] = await Promise.all([
    result(
      client
        .from("notifications")
        .select("*")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .order("id")
        .range((page - 1) * 20, page * 20),
    ),
    client
      .from("notifications")
      .select("id", { head: true, count: "exact" })
      .eq("recipient_id", userId)
      .is("read_at", null),
  ]);
  if (count.error) throw count.error;
  const actorIds = [
      ...new Set((rows ?? []).flatMap((n) => (n.actor_id ? [n.actor_id] : []))),
    ],
    collectionIds = [
      ...new Set(
        (rows ?? []).flatMap((n) => (n.collection_id ? [n.collection_id] : [])),
      ),
    ];
  const [actors, collections] = await Promise.all([
    actorIds.length
      ? result(client.from("profiles").select(profileFields).in("id", actorIds))
      : [],
    collectionIds.length
      ? result(
          client.from("collections").select("id,title").in("id", collectionIds),
        )
      : [],
  ]);
  return {
    items: (rows ?? []).slice(0, 20).map((n) => ({
      ...n,
      actor: actors?.find((a) => a.id === n.actor_id) ?? null,
      collectionTitle:
        collections?.find((c) => c.id === n.collection_id)?.title ?? null,
    })),
    unread: count.count ?? 0,
    hasMore: (rows?.length ?? 0) > 20,
  };
}

export async function creatorCollections(input: unknown, page = 1) {
  const id = idSchema.parse(input);
  const { client } = await activeClient();
  const rows = await result(
    client
      .from("collections")
      .select("*")
      .eq("owner_id", id)
      .eq("visibility", "published")
      .order("updated_at", { ascending: false })
      .order("id")
      .range((page - 1) * 24, page * 24 - 1),
  );
  return collectionViews(rows ?? []);
}

export async function discoveryHistory() {
  const { client, userId } = await activeClient();
  const [searches, pref] = await Promise.all([
    result(
      client
        .from("recent_searches")
        .select("query")
        .eq("user_id", userId)
        .gt("searched_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .order("searched_at", { ascending: false })
        .limit(8),
    ),
    result<
      Pick<
        Row<"recommendation_preferences">,
        "remember_searches" | "remember_viewed"
      >
    >(
      client
        .from("recommendation_preferences")
        .select("remember_searches,remember_viewed")
        .eq("user_id", userId)
        .single(),
    ),
  ]);
  return {
    searches: searches?.map((s) => s.query) ?? [],
    rememberSearches: pref?.remember_searches ?? false,
    rememberViewed: pref?.remember_viewed ?? true,
  };
}
export async function continueExploring() {
  const { client, userId } = await activeClient();
  const [refs, planned, collections] = await Promise.all([
    result(
      client
        .from("recent_titles")
        .select("title_id")
        .eq("user_id", userId)
        .gt("viewed_at", new Date(Date.now() - 90 * 86400000).toISOString())
        .order("viewed_at", { ascending: false })
        .limit(12),
    ),
    libraryData({ status: "planned", limit: 12 }),
    recentCollections(),
  ]);
  const rows = refs?.length
    ? await result(
        client
          .from("titles")
          .select("*")
          .in(
            "id",
            refs.map((r) => r.title_id),
          ),
      )
    : [];
  const recent = await titleViews(rows ?? []);
  return {
    recent: (refs ?? []).flatMap((r) => {
      const t = recent.find((t) => t.id === r.title_id);
      return t ? [t] : [];
    }),
    planned: planned.titles,
    collections,
  };
}
export async function recentCollections() {
  const { client, userId } = await activeClient();
  const rows = await result(
    client
      .from("collections")
      .select("*")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .order("id")
      .limit(6),
  );
  return collectionViews(rows ?? []);
}
export async function followedCollections(page = 1) {
  const { client } = await activeClient();
  const rows = await result(
    client.rpc("followed_collection_feed", {
      p_limit: 12,
      p_offset: (page - 1) * 12,
    }),
  );
  return collectionViews(rows ?? []);
}
