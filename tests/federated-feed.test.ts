import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeFederatedCursor,
  encodeFederatedCursor,
  federatedFeedPage,
} from "../src/lib/product/federated-feed";
import { productQuerySchema } from "../src/lib/product/validation";
import { normalizeTmdb } from "../src/lib/metadata/providers/tmdb-normalize";
import type { TitleView } from "../src/types/product";
import type { DiscoveredTitle } from "../src/lib/metadata/providers/discovery";
const secret = "isolated-cursor-secret-not-a-real-credential";
const q = productQuerySchema.parse({ limit: 4 });
const payload = (id: number) =>
  normalizeTmdb(
    { id, title: `Fixture ${id}`, release_date: "2020-01-01" },
    "movie",
  );
const view = (n: number): TitleView => ({
  id: `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  title: {
    reference: {
      provider: "scenestack",
      providerId: `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    },
    name: `Fixture ${n}`,
    kind: "movie",
    posterUrl: null,
    backdropUrl: null,
    synopsis: null,
    releaseYear: 2020,
    episodeCount: null,
  },
  genres: [],
  communityRating: null,
  voteCount: 0,
  status: "released",
  edition: "standalone",
});
function fixtures() {
  const local = [1, 2, 3, 4, 5].map(view);
  const byId = new Map(local.map((v) => [v.id, v]));
  let calls = 0;
  return {
    calls: () => calls,
    local: async (cursor: string | null, limit: number) => {
      const n = Number(cursor || 0);
      return {
        availability: "ready" as const,
        titles: local.slice(n, n + limit),
        nextCursor: n + limit < local.length ? String(n + limit) : null,
        previousCursor: null,
        offset: n,
      };
    },
    remote: async (_source: string, page: number) => {
      calls++;
      return {
        items: [payload(10 + page * 2), payload(11 + page * 2)],
        next: page < 3 ? page + 1 : null,
      };
    },
    persist: async (_provider: string, titles: DiscoveredTitle[]) =>
      titles.map((p) => {
        const v = view(Number(p.externalId));
        byId.set(v.id, v);
        return v.id;
      }),
    views: async (ids: string[]) => ids.map((id) => byId.get(id)!),
  };
}
test("local exhaustion does not exhaust a live provider; distinct canonical pages append", async () => {
  const deps = fixtures();
  let state = decodeFederatedCursor(null, "scope", ["tmdb.movie"], secret);
  const ids: string[] = [];
  let pages = 0;
  for (; pages < 10; pages++) {
    const page = await federatedFeedPage(q, state, deps);
    ids.push(...page.titles.map((t) => t.id));
    state = decodeFederatedCursor(
      encodeFederatedCursor(page.state, secret),
      "scope",
      ["tmdb.movie"],
      secret,
    );
    if (!page.more) break;
  }
  assert.ok(pages < 10);
  assert.equal(ids.length, 11);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(deps.calls() >= 3);
});
test("empty and filtered provider pages advance in bounded batches without a false end", async () => {
  const deps = fixtures();
  let calls = 0;
  deps.local = async () => ({
    availability: "ready",
    titles: [],
    nextCursor: null,
    previousCursor: null,
    offset: 0,
  });
  deps.remote = async (_source, page) => {
    calls++;
    return {
      items: page < 8 ? [] : [payload(88)],
      next: page < 8 ? page + 1 : null,
    };
  };
  const first = await federatedFeedPage(
    q,
    decodeFederatedCursor(null, "scope", ["tmdb.movie"], secret),
    deps,
  );
  assert.equal(calls, 6);
  assert.equal(first.more, true);
  assert.equal(first.titles.length, 0);
  const second = await federatedFeedPage(q, first.state, deps);
  assert.equal(second.titles.length, 1);
  assert.equal(second.more, false);
});
test("provider failure is retryable, and never reported as exhaustion", async () => {
  const deps = fixtures();
  deps.remote = async () => {
    throw { code: "rate_limited" };
  };
  const first = await federatedFeedPage(
    q,
    decodeFederatedCursor(null, "scope", ["tmdb.movie"], secret),
    deps,
  );
  assert.equal(first.titles.length, 2);
  assert.equal(first.more, true);
  assert.equal(first.issues[0].code, "rate_limited");
  deps.local = async () => ({
    availability: "ready",
    titles: [],
    nextCursor: null,
    previousCursor: null,
    offset: 0,
  });
  await assert.rejects(federatedFeedPage(q, first.state, deps), {
    code: "RATE_LIMITED",
  });
});
test("failed canonicalization rolls back the provider cursor so retry does not skip titles", async () => {
  const deps = fixtures();
  const persist = deps.persist;
  deps.persist = async () => {
    throw new Error("isolated storage failure");
  };
  const first = await federatedFeedPage(
    q,
    decodeFederatedCursor(null, "scope", ["tmdb.movie"], secret),
    deps,
  );
  assert.equal(first.state.streams[0].index, 0);
  deps.persist = persist;
  const next = await federatedFeedPage(q, first.state, deps);
  assert.ok(next.titles.some((t) => t.id === view(12).id));
});
test("signed cursor rejects tampering, expired scopes, and changed provider/filter sets", () => {
  const state = decodeFederatedCursor(null, "scope", ["tmdb.movie"], secret);
  const token = encodeFederatedCursor(state, secret);
  assert.deepEqual(
    decodeFederatedCursor(token, "scope", ["tmdb.movie"], secret),
    state,
  );
  for (const t of [
    token + "x",
    "fed.invalid.invalid",
    encodeFederatedCursor({ ...state, expires: 0 }, secret),
  ])
    assert.throws(
      () => decodeFederatedCursor(t, "scope", ["tmdb.movie"], secret),
      { code: "INVALID_INPUT" },
    );
  assert.throws(() =>
    decodeFederatedCursor(token, "other-filter", ["tmdb.movie"], secret),
  );
  assert.throws(() =>
    decodeFederatedCursor(token, "scope", ["tmdb.tv"], secret),
  );
});
test("previous window reproduces the same canonical IDs without carrying an unbounded history", async () => {
  const deps = fixtures();
  const first = await federatedFeedPage(
    q,
    decodeFederatedCursor(null, "scope", ["tmdb.movie"], secret),
    deps,
  );
  const next = await federatedFeedPage(q, first.state, deps);
  const previous = first.state.history.at(-1)!;
  const replay = await federatedFeedPage(
    q,
    {
      ...first.state,
      ...previous,
      seen: [],
      history: first.state.history.slice(0, -1),
    },
    deps,
  );
  assert.deepEqual(
    replay.titles.map((t) => t.id),
    first.titles.map((t) => t.id),
  );
  assert.ok(next.state.history.length <= 12);
  assert.ok(encodeFederatedCursor(next.state, secret).length < 8000);
});
test("duplicate native pages keep advancing, and provider limits remain distinct", async () => {
  const deps = fixtures();
  deps.local = async () => ({
    availability: "ready",
    titles: [],
    nextCursor: null,
    previousCursor: null,
    offset: 0,
  });
  deps.remote = async (_source, page) => ({
    items: [payload(99)],
    next: page < 3 ? page + 1 : null,
    limited: page === 3,
  });
  const page = await federatedFeedPage(
    q,
    decodeFederatedCursor(null, "scope", ["tmdb.movie"], secret),
    deps,
  );
  assert.equal(page.titles.length, 1);
  assert.equal(page.limited, true);
  assert.equal(page.more, false);
});
