import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { DataAccessError, result } from "../src/lib/data/errors";
import { productQuerySchema } from "../src/lib/product/validation";
import {
  catalogSeek,
  feedScope,
  pageLinks,
  readFeedCursor,
  usesCatalogKeyset,
} from "../src/lib/product/feed-cursor";
import { providerRetryDelay } from "../src/lib/metadata/providers/retry-delay";

const firstId = "20000000-0000-4000-8000-000000000001";
const secondId = "20000000-0000-4000-8000-000000000002";
const thirdId = "20000000-0000-4000-8000-000000000003";

test("cursors are bound to feed, principal, normalized search, sort and page size", () => {
  const q = productQuerySchema.parse({ limit: 12, category: "anime" });
  const scope = feedScope("catalog", q, null);
  const initial = readFeedCursor(null, scope, q, true);
  const edge = { id: firstId, value: 10 };
  const links = pageLinks(initial, q.limit, false, true, edge, edge);
  assert.equal(links.previousCursor, null);
  const next = readFeedCursor(links.nextCursor, scope, q, true);
  assert.deepEqual(next.edge, edge);
  assert.equal(next.offset, 12);
  assert.equal(next.cutoff, initial.cutoff);
  const previous = pageLinks(next, q.limit, true, false, edge, edge);
  assert.equal(previous.nextCursor, null);
  assert.equal(
    readFeedCursor(previous.previousCursor, scope, q, true).direction,
    "previous",
  );
  for (const changed of [
    feedScope("recent", q, null),
    feedScope("catalog", { ...q, q: "new" }, null),
    feedScope("catalog", { ...q, sort: "year" }, null),
    feedScope("catalog", { ...q, limit: 24 }, null),
    feedScope("catalog", { ...q, category: "movie" }, null),
    feedScope("catalog", q, firstId),
  ]) {
    assert.throws(
      () => readFeedCursor(links.nextCursor, changed, q, true),
      DataAccessError,
    );
  }
  for (const token of ["broken", "TMDB:page:1", "a".repeat(8193), ""]) {
    assert.throws(() => readFeedCursor(token, scope, q, true), DataAccessError);
  }
  assert.throws(() => readFeedCursor(links.nextCursor, scope, q, false));
  assert.equal(usesCatalogKeyset("catalog", q), true);
  assert.equal(usesCatalogKeyset("catalog", { ...q, q: "a title" }), false);
  assert.equal(usesCatalogKeyset("catalog", { ...q, genre: secondId }), false);
});

test("keyset filters handle ties, nulls last and punctuation in a display title", () => {
  const edge = { id: secondId, value: null };
  assert.equal(
    catalogSeek("year", "next", edge),
    `and(release_year.is.null,id.gt.${secondId})`,
  );
  assert.equal(
    catalogSeek("popular", "previous", edge),
    `popularity.not.is.null,and(popularity.is.null,id.lt.${secondId})`,
  );
  assert.equal(
    catalogSeek("year", "next", { ...edge, value: 2020 }),
    `release_year.lt.2020,and(release_year.eq.2020,id.gt.${secondId}),release_year.is.null`,
  );
  const text = String.raw`The "Cut", (Part \One)`;
  const literal = String.raw`"The \"Cut\", (Part \\One)"`;
  assert.equal(
    catalogSeek("title", "previous", { ...edge, value: text }),
    `display_title.lt.${literal},and(display_title.eq.${literal},id.lt.${secondId})`,
  );
});

// Server-only modules are loaded inside a Node test with isolated HTTP and
// credentials. The application still uses the installed PostgREST client,
// page assembler, title hydration, and request handlers.
let serverClient: unknown;
async function withServerImports<T>(client: unknown, work: () => Promise<T>) {
  const previousClient = serverClient;
  serverClient = client;
  const loader = Module as unknown as {
    _load: (...args: unknown[]) => unknown;
  };
  const load = loader._load;
  loader._load = function (this: unknown, ...args: unknown[]) {
    if (args[0] === "server-only") return {};
    if (args[0] === "@/lib/supabase/server")
      return { createClient: async () => serverClient };
    return Reflect.apply(load, this, args);
  };
  try {
    return await work();
  } finally {
    loader._load = load;
    serverClient = previousClient;
  }
}

test("catalog API issues bounded keyset slices and can return to an evicted page", async () => {
  const requests: URL[] = [];
  const rows = [firstId, secondId, thirdId].map((id, i) => ({
    id,
    kind: i === 1 ? "anime" : "movie",
    display_title: "Shared title",
    description: "",
    release_year: 2020,
    popularity: i === 2 ? null : 1,
    status: "released",
    edition: "film",
  }));
  const client = createClient<Database>(
    "http://localhost:12345",
    "test-only-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (url) => {
          const request = new URL(String(url));
          requests.push(request);
          let payload: unknown[] = [];
          if (request.pathname.endsWith("/titles")) {
            assert.equal(request.searchParams.get("limit"), "3");
            assert.equal(request.searchParams.get("status"), "neq.merged");
            const seek = request.searchParams.get("or");
            payload = !seek
              ? rows
              : seek.includes("id.gt")
                ? rows.slice(-1)
                : rows.slice(0, 2).reverse();
          }
          return Response.json(payload);
        },
      },
    },
  );
  await withServerImports(client, async () => {
    const { readTitleFeedPage } = await import("../src/lib/product/title-feed");
    const input = { limit: 2 };
    const first = await readTitleFeedPage("catalog", input);
    assert.deepEqual(
      first.titles.map((t) => t.id),
      [firstId, secondId],
    );
    assert.equal(first.previousCursor, null);
    assert.ok(first.nextCursor);
    const next = await readTitleFeedPage("catalog", input, first.nextCursor);
    assert.deepEqual(
      next.titles.map((t) => t.id),
      [thirdId],
    );
    assert.equal(next.offset, 2);
    assert.equal(next.nextCursor, null);
    assert.ok(next.previousCursor);
    const previous = await readTitleFeedPage(
      "catalog",
      input,
      next.previousCursor,
    );
    assert.deepEqual(previous.titles, first.titles);
    assert.equal(previous.offset, 0);
    assert.equal(previous.previousCursor, null);
    const titleRequests = requests.filter((url) =>
      url.pathname.endsWith("/titles"),
    );
    assert.equal(titleRequests.length, 3);
    assert.match(titleRequests[1].searchParams.get("or")!, /popularity\.lt\.1/);
    assert.match(
      titleRequests[2].searchParams.get("or")!,
      /popularity\.not\.is\.null/,
    );
    assert.equal(
      titleRequests[2].searchParams.get("order"),
      "popularity.asc.nullsfirst,id.desc",
    );
    assert.equal(
      new Set(titleRequests.map((url) => url.searchParams.get("created_at")))
        .size,
      1,
    );
    const count = requests.length;
    await assert.rejects(
      readTitleFeedPage(
        "catalog",
        { ...input, category: "anime" },
        first.nextCursor,
      ),
      { code: "INVALID_INPUT" },
    );
    assert.equal(requests.length, count);
  });
});

test("upstream throttling remains distinguishable from unavailable or empty data", async () => {
  await assert.rejects(
    result(
      Promise.resolve({ data: null, error: { message: "busy" }, status: 429 }),
    ),
    { code: "RATE_LIMITED" },
  );
  await assert.rejects(
    result(
      Promise.resolve({ data: null, error: { message: "down" }, status: 503 }),
    ),
    { code: "UNAVAILABLE" },
  );
  assert.equal(providerRetryDelay("60", 0), null);
  assert.equal(providerRetryDelay("2", 0), 2000);
  const now = Date.UTC(2026, 10, 23, 12);
  assert.equal(
    providerRetryDelay(new Date(now + 60_000).toUTCString(), 0, now),
    null,
  );
  assert.equal(providerRetryDelay(null, 1), 1000);
});

test("provider adapters keep page and offset models separate and stop on a long Retry-After", async (t) => {
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  const keys: Record<string, string> = {
    TMDB_API_ENABLED: "true",
    TMDB_LICENSE_CONFIRMED: "true",
    TMDB_API_TOKEN: "fixture-only",
    MAL_API_ENABLED: "true",
    MAL_LICENSE_CONFIRMED: "true",
    MAL_CLIENT_ID: "fixture-only",
  };
  for (const [key, value] of Object.entries(keys)) {
    const initial = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (initial === undefined) delete process.env[key];
      else process.env[key] = initial;
    });
  }
  const urls: URL[] = [];
  const transport = t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL) => {
      urls.push(new URL(String(input)));
      return new Response(null, {
        status: 429,
        headers: { "Retry-After": "120" },
      });
    },
  );
  await withServerImports(null, async () => {
    const { searchMal } = await import("../src/lib/metadata/providers/mal");
    const { searchTmdb } = await import("../src/lib/metadata/providers/tmdb");
    await assert.rejects(searchMal("fixture", 20), { code: "rate_limited" });
    await assert.rejects(searchTmdb("fixture", "tv", 2), {
      code: "rate_limited",
    });
    assert.equal(transport.mock.callCount(), 2);
    assert.equal(urls[0].searchParams.get("offset"), "20");
    assert.equal(urls[0].searchParams.has("page"), false);
    assert.equal(urls[1].searchParams.get("page"), "2");
    assert.equal(urls[1].searchParams.has("offset"), false);
    await assert.rejects(searchMal("different fixture", 40), {
      code: "RATE_LIMITED",
    });
    assert.equal(
      transport.mock.callCount(),
      2,
      "Backoff must prevent another upstream call",
    );
    clock += 31_000;
    transport.mock.mockImplementation(async () => new Response("bad JSON"));
    await assert.rejects(searchMal("fixture"), { code: "invalid_payload" });
    transport.mock.mockImplementation(
      async () => new Response(null, { status: 404 }),
    );
    await assert.rejects(searchTmdb("fixture", "movie"), { code: "not_found" });
    assert.equal(transport.mock.callCount(), 4);
  });
});

test("production catalog provenance hides disabled providers within the requested page", async (t) => {
  const values = {
    NODE_ENV: "production",
    TMDB_API_ENABLED: "true",
    TMDB_LICENSE_CONFIRMED: "true",
    TMDB_PUBLIC_RELEASE_APPROVED: "true",
    MAL_API_ENABLED: "true",
    MAL_LICENSE_CONFIRMED: "true",
    MAL_PUBLIC_RELEASE_APPROVED: "false",
  };
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const requests: URL[] = [];
  const tmdb = "20000000-0000-4000-8000-000000000010";
  const mal = "20000000-0000-4000-8000-000000000011";
  const client = createClient<Database>(
    "https://fixture.supabase.co",
    "fixture-only",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          const url = new URL(String(input));
          requests.push(url);
          if (url.pathname.endsWith("/metadata_providers"))
            return Response.json([
              { id: tmdb, key: "tmdb" },
              { id: mal, key: "myanimelist" },
            ]);
          assert.ok(url.pathname.endsWith("/provider_title_ids"));
          assert.equal(url.searchParams.get("provider_id"), null);
          assert.equal(
            url.searchParams.get("title_id"),
            `in.(${firstId},${secondId},${thirdId})`,
          );
          return Response.json([
            { title_id: secondId, provider_id: mal },
            {
              title_id: thirdId,
              provider_id: "20000000-0000-4000-8000-000000000099",
            },
          ]);
        },
      },
    },
  );
  await withServerImports(client, async () => {
    const { restrictedTitleIds } =
      await import("../src/lib/metadata/release-policy");
    assert.deepEqual(
      [...(await restrictedTitleIds([firstId, secondId, thirdId]))],
      [secondId, thirdId],
    );
    assert.equal(requests.length, 2);
  });
});
