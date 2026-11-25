import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTracking,
  trackingLabel,
  blankTitleState,
} from "../src/lib/product/state";
import {
  productQuerySchema,
  titleMutationSchema,
} from "../src/lib/product/validation";
import { safeRedirect } from "../src/lib/utils/redirect";
import { approvedImagePath } from "../src/lib/metadata/presentation";
import {
  normalizeTmdb,
  AnimeProviderRequired,
} from "../src/lib/metadata/providers/tmdb-normalize";
test("primary actions use watched for standalone movies/docs and watching for episodic categories", () => {
  for (const kind of ["movie", "documentary"] as const)
    assert.equal(defaultTracking({ kind }, "standalone"), "completed");
  for (const kind of ["series", "anime", "cartoon", "drama"] as const) {
    assert.equal(defaultTracking({ kind }, "series"), "watching");
    assert.equal(defaultTracking({ kind }, "standalone"), "completed");
  }
  assert.equal(defaultTracking({ kind: "documentary" }, "series"), "watching");
  assert.equal(
    trackingLabel(
      { ...blankTitleState("fixture"), tracking: "completed" },
      { kind: "movie" },
    ),
    "Watched",
  );
  assert.equal(
    trackingLabel(
      { ...blankTitleState("fixture"), tracking: "completed" },
      { kind: "series" },
    ),
    "Completed",
  );
});
test("OAuth destinations retain a single constrained intent and reject query injection", () => {
  const id = "10000000-0000-4000-8000-000000000001",
    nonce = "20000000-0000-4000-8000-000000000001";
  const next = `/titles/${id}?intent=rate&nonce=${nonce}`;
  assert.equal(safeRedirect(next), next);
  for (const suffix of [
    "&next=//evil.invalid",
    "&intent=favorite",
    "#fragment",
  ])
    assert.equal(safeRedirect(next + suffix), "/library");
  assert.equal(
    safeRedirect(`/titles/${id}?intent=delete&nonce=${nonce}`),
    "/library",
  );
  assert.equal(
    safeRedirect("/discover?tab=collections&sort=year"),
    "/discover?tab=collections&sort=year",
  );
  assert.equal(safeRedirect("/discover?q=%0Aevil"), "/library");
});
test("product mutations and filters reject spoofed ownership, invalid precision and unbounded queries", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  assert.ok(
    titleMutationSchema.safeParse({ action: "rate", titleId: id, rating: 8.7 })
      .success,
  );
  assert.ok(
    !titleMutationSchema.safeParse({
      action: "rate",
      titleId: id,
      rating: 8.71,
    }).success,
  );
  assert.ok(
    !titleMutationSchema.safeParse({
      action: "favorite",
      titleId: id,
      enabled: true,
      userId: id,
    }).success,
  );
  assert.ok(!productQuerySchema.safeParse({ limit: 10000 }).success);
  assert.ok(!productQuerySchema.safeParse({ rating: "Infinity" }).success);
});
test("TMDB normalization keeps external scores out, rejects unapproved anime and restricts media URLs", () => {
  const data = {
    id: 123,
    title: "Isolated unit fixture",
    original_language: "en",
    release_date: "2020-01-01",
    status: "Released",
    poster_path: "/fixture.jpg",
    runtime: 125,
    production_companies: [{ id: 1, name: "Isolated studio" }],
    backdrop_path: null,
    genres: [{ id: 18, name: "Drama" }],
    vote_average: 9.9,
    vote_count: 10000,
    credits: {
      cast: [{ id: 9, name: "Fixture person", character: "Fixture role" }],
    },
    videos: {
      results: [
        {
          site: "YouTube",
          type: "Trailer",
          official: true,
          key: "fixture_123",
        },
        { site: "Unapproved", type: "Trailer", key: "evil" },
      ],
    },
  };
  const result = normalizeTmdb(data, "movie");
  assert.equal(result.kind, "movie");
  assert.equal(result.year, 2020);
  assert.equal(result.releaseDate, "2020-01-01");
  assert.equal(result.runtime, 125);
  assert.equal(result.companies[0].name, "Isolated studio");
  assert.equal(result.credits.length, 1);
  assert.equal(result.trailers.length, 1);
  assert.ok(!("rating" in result));
  assert.ok(!("vote_average" in result));
  assert.equal(approvedImagePath(result.poster), result.poster);
  assert.equal(approvedImagePath("https://evil.invalid/image.jpg"), null);
  assert.equal(
    approvedImagePath("https://image.tmdb.org.evil.invalid/image.jpg"),
    null,
  );
  assert.throws(
    () =>
      normalizeTmdb(
        {
          ...data,
          original_language: "ja",
          genres: [{ id: 16, name: "Animation" }],
        },
        "movie",
      ),
    AnimeProviderRequired,
  );
});
