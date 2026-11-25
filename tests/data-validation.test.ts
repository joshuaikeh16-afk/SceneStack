import assert from "node:assert/strict";
import test from "node:test";
import {
  ratingSchema,
  usernameSchema,
  profilePatchSchema,
  collectionSchema,
  catalogQuerySchema,
  pageSchema,
  providerTitleSchema,
  reportSchema,
} from "../src/lib/validation/data";
import { csvCell, exportCsv } from "../src/lib/utils/export";
import {
  DataAccessError,
  databaseFailure,
  result,
} from "../src/lib/data/errors";

test("validation rejects precision loss, identity/role changes, unsupported categories and unbounded queries", () => {
  for (const score of [0, 10.1, 8.23, Number.NaN, Infinity, "8.2"])
    assert.equal(ratingSchema.safeParse(score).success, false);
  for (const score of [1, 8.2, 10])
    assert.equal(ratingSchema.parse(score), score);
  assert.equal(usernameSchema.parse("  Film_Lover "), "film_lover");
  assert.equal(usernameSchema.safeParse("Admin").success, false);
  assert.equal(
    profilePatchSchema.safeParse({ username: "changed" }).success,
    false,
  );
  assert.equal(
    profilePatchSchema.safeParse({ status: "active" }).success,
    false,
  );
  assert.equal(
    collectionSchema.parse({ title: "My collection" }).visibility,
    "private",
  );
  assert.equal(
    collectionSchema.safeParse({ title: "Owned", ownerId: "another-user" })
      .success,
    false,
  );
  for (const query of [
    { category: "manga" },
    { sort: "drop table" },
    { limit: 101 },
    { q: "x".repeat(121) },
  ])
    assert.equal(catalogQuerySchema.safeParse(query).success, false);
  assert.equal(pageSchema.safeParse({ limit: 1000 }).success, false);
  assert.equal(
    providerTitleSchema.safeParse({
      displayTitle: "Untrusted input",
      kind: "movie",
      communityRating: 9.9,
    }).success,
    false,
  );
  assert.equal(reportSchema.safeParse({ reason: "spam" }).success, false);
});
test("CSV exports quote text and neutralize spreadsheet formulas", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=IMPORTDATA(1)"), '"\'=IMPORTDATA(1)"');
  assert.equal(csvCell("  +SUM(1)"), '"\'  +SUM(1)"');
  assert.match(
    exportCsv({ profile: { id: "test", bio: 'Hello, "world"' } }),
    /""world""/,
  );
});
test("data-access failures hide database/provider internals and identify unapplied migrations", async () => {
  assert.throws(
    () =>
      databaseFailure({ code: "42P01", message: "internal relation details" }),
    (error) =>
      error instanceof DataAccessError && error.code === "SETUP_REQUIRED",
  );
  assert.throws(
    () =>
      databaseFailure({
        code: "XX000",
        message: "never expose provider credentials",
      }),
    (error) =>
      error instanceof DataAccessError &&
      !error.message.includes("credentials"),
  );
  await assert.rejects(
    () => result(Promise.reject(new Error("internal endpoint"))),
    (error) =>
      error instanceof DataAccessError && !error.message.includes("endpoint"),
  );
});
