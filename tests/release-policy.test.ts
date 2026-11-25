import assert from "node:assert/strict";
import test from "node:test";
import {
  providerEnabled,
  providerArtworkAllowed,
} from "../src/config/providers";
import { safeRedirect } from "../src/lib/utils/redirect";
import { siteOrigin, searchIndexingEnabled } from "../src/config/site";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";

test("production provider permissions fail closed independently of local credentials", (t) => {
  const values = {
    NODE_ENV: "production",
    TMDB_API_ENABLED: "true",
    TMDB_LICENSE_CONFIRMED: "true",
    MAL_API_ENABLED: "true",
    MAL_LICENSE_CONFIRMED: "true",
    TMDB_PUBLIC_RELEASE_APPROVED: "false",
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
  assert.equal(providerEnabled("tmdb"), false);
  assert.equal(providerEnabled("myanimelist"), false);
  assert.equal(
    providerArtworkAllowed("https://image.tmdb.org/t/p/w500/test.jpg"),
    false,
  );
  assert.equal(
    providerArtworkAllowed("https://cdn.myanimelist.net/images/anime/1/2.jpg"),
    false,
  );
  process.env.TMDB_PUBLIC_RELEASE_APPROVED = "true";
  assert.equal(providerEnabled("tmdb"), true);
  assert.equal(providerEnabled("myanimelist"), false);
  assert.equal(
    providerArtworkAllowed("https://image.tmdb.org/t/p/w500/test.jpg"),
    true,
  );
  process.env.TMDB_API_ENABLED = "false";
  assert.equal(providerEnabled("tmdb"), false);
  process.env.MAL_PUBLIC_RELEASE_APPROVED = "true";
  assert.equal(providerEnabled("myanimelist"), true);
  process.env.MAL_LICENSE_CONFIRMED = "false";
  assert.equal(providerEnabled("myanimelist"), false);
  assert.equal(providerArtworkAllowed("/art/city.svg"), true);
});

test("library sign-in destinations preserve valid filters and reject injected redirects", () => {
  assert.equal(
    safeRedirect("/library?section=favorites&sort=year&page=2"),
    "/library?section=favorites&sort=year&page=2",
  );
  for (const value of [
    "/library?next=//evil.example",
    "/library?section=favorites&section=ratings",
    "/library?status=bogus",
    "/library?page=999999",
    "/library?section=favorites#fragment",
  ])
    assert.equal(safeRedirect(value), "/library");
});

test("canonical metadata uses the confirmed domain and preview indexing stays off", (t) => {
  assert.equal(siteOrigin(), "https://scenestack.media");
  const previousFlag = process.env.SCENESTACK_SEARCH_INDEXING;
  const previousEnvironment = process.env.VERCEL_ENV;
  t.after(() => {
    if (previousFlag === undefined)
      delete process.env.SCENESTACK_SEARCH_INDEXING;
    else process.env.SCENESTACK_SEARCH_INDEXING = previousFlag;
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
  });
  process.env.SCENESTACK_SEARCH_INDEXING = "true";
  process.env.VERCEL_ENV = "preview";
  assert.equal(searchIndexingEnabled(), false);
  assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });
  assert.deepEqual(sitemap(), []);
  process.env.VERCEL_ENV = "production";
  assert.equal(searchIndexingEnabled(), true);
  assert.ok(
    sitemap().every((item) => item.url.startsWith("https://scenestack.media/")),
  );
});
