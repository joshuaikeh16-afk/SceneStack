import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TitleCard } from "../src/components/catalog/title-card";
import { TitleCard as ProductCard } from "../src/components/product/product-title-card";
import { ProfileHeader } from "../src/components/profile/profile-header";
import { LibraryBrowser } from "../src/components/library/library-browser";
import { CategorySelector } from "../src/components/catalog/category-selector";
import type { Title } from "../src/types/title";

// Isolated component fixtures, never exposed through application routes or data.
const fixture: Title = {
  reference: { provider: "test", providerId: "1" },
  name: "Test fixture",
  kind: "movie",
  synopsis: null,
  posterUrl: null,
  backdropUrl: null,
  releaseYear: null,
  episodeCount: null,
};

test("poster fallback links to its title and never invents a community rating", () => {
  const html = renderToStaticMarkup(
    createElement(TitleCard, { title: fixture }),
  );
  assert.match(html, /href="\/titles\/test--1"/);
  assert.match(html, /Poster unavailable/);
  assert.doesNotMatch(html, /community-rating|NaN|undefined/);
  const rated = renderToStaticMarkup(
    createElement(TitleCard, {
      title: fixture,
      communityRating: { source: "scenestack", score: 8.2, voteCount: 10 },
    }),
  );
  assert.doesNotMatch(
    rated,
    /community-rating|8\.2|<button|Tracking|Favorite|Add to Collection/,
  );
});

test("profile onboarding omits invented usernames and follower counts", () => {
  const html = renderToStaticMarkup(
    createElement(ProfileHeader, { displayName: "Test member", isOwner: true }),
  );
  assert.match(html, /Profile setup pending/);
  assert.match(html, /Set up profile/);
  assert.doesNotMatch(html, /\d+ followers|\d+ following|@undefined/);
});
test("connected browsing cards render without a private-state provider or management controls", () => {
  const html = renderToStaticMarkup(
    createElement(ProductCard, {
      title: fixture,
      view: {
        id: "10000000-0000-4000-8000-000000000001",
        title: fixture,
        genres: [],
        communityRating: null,
        voteCount: 0,
        status: "released",
        edition: "standalone",
      },
    }),
  );
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.match(html, /Test fixture/);
  assert.doesNotMatch(
    html,
    /<button|card-tracking-indicator|title-actions|Not Interested|Already Seen|recommendation-reason/,
  );
});

test("library renders accessible tabs and real discovery action without fake progress", () => {
  const html = renderToStaticMarkup(createElement(LibraryBrowser));
  assert.equal((html.match(/role="tab"/g) || []).length, 5);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /href="\/discover"/);
  assert.match(html, /On Hold/);
  assert.doesNotMatch(html, /episodes? watched|chapters?|\d+%|\d+ titles/i);
});

test("category links retain the submitted search", () => {
  const html = renderToStaticMarkup(
    createElement(CategorySelector, {
      compact: true,
      query: { q: "quiet worlds", category: "anime" },
    }),
  );
  assert.match(html, /\/discover\?category=movie&amp;q=quiet\+worlds/);
  assert.match(html, /aria-current="true"/);
});
