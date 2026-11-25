import assert from "node:assert/strict";
import test from "node:test";
import { safeRedirect } from "../src/lib/utils/redirect";

test("allows only known local return destinations", () => {
  for (const route of [
    "/",
    "/discover",
    "/library",
    "/profile",
    "/settings",
    "/titles/tmdb-movie_123",
  ]) {
    assert.equal(safeRedirect(route), route);
  }
});

test("preserves only valid Discover search and category parameters", () => {
  assert.equal(
    safeRedirect("/discover?category=anime"),
    "/discover?category=anime",
  );
  assert.equal(
    safeRedirect("/discover?q=quiet+worlds&category=movie"),
    "/discover?category=movie&q=quiet+worlds",
  );
  for (const value of [
    "/discover?next=https://evil.example",
    "/discover?category=manga",
    "/discover?category=anime&category=movie",
    "/discover?q=first&q=second",
    "/discover?q=%0aLocation%3Aevil",
    "/discover?category=anime#//evil.example",
    `/discover?q=${"x".repeat(121)}`,
    "/discover?category=anime&redirect=//evil.example",
  ])
    assert.equal(safeRedirect(value), "/library", value);
});

test("rejects external redirects, parser ambiguities, encoded bypasses, and auth loops", () => {
  for (const value of [
    undefined,
    null,
    ["/profile"],
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\evil.example",
    "/%2fevil.example",
    "/%5cevil.example",
    "/library?next=https://evil.example",
    "/library#fragment",
    "/library\r\nLocation: https://evil.example",
    "/auth/callback",
    "/login",
    "/titles/../login",
    "/titles/%2e%2e",
    "/unknown",
    "javascript:alert(1)",
    "/titles/foo/bar",
    " /profile",
    "/profile/",
  ])
    assert.equal(safeRedirect(value), "/library", String(value));
});
