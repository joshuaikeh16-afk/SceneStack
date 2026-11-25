import assert from "node:assert/strict";
import test from "node:test";
import { discoverHref, parseDiscoverQuery } from "../src/lib/utils/discover";
import { approvedImagePath, titleHref } from "../src/lib/metadata/presentation";

test("normalizes bounded queries and rejects unsupported or ambiguous categories", () => {
  assert.deepEqual(
    parseDiscoverQuery({ q: "  space\nworlds  ", category: "anime" }),
    { q: "spaceworlds", category: "anime" },
  );
  assert.deepEqual(
    parseDiscoverQuery({ q: ["one", "two"], category: "manga" }),
    { q: "", category: undefined },
  );
  assert.equal(parseDiscoverQuery({ q: "x".repeat(200) }).q.length, 120);
  assert.equal(
    discoverHref({ category: "drama", q: "a & b" }),
    "/discover?category=drama&q=a+%26+b",
  );
});

test("only approved local images and valid provider references reach media components", () => {
  for (const path of [
    "https://unknown.example/poster.jpg",
    "//evil.example/poster.jpg",
    "/art/../secret.png",
    "data:image/png;base64,test",
    "/art/city.svg?script=1",
  ])
    assert.equal(approvedImagePath(path), null);
  assert.equal(approvedImagePath("/art/city.svg"), "/art/city.svg");
  assert.equal(
    titleHref({ provider: "approved", providerId: "123" }),
    "/titles/approved--123",
  );
  assert.equal(
    titleHref({ provider: "//evil.example", providerId: "123" }),
    null,
  );
});
