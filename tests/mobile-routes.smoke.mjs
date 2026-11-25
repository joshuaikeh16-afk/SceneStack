import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const origin = process.argv[2] || "http://localhost:3000";
const requireCatalog = process.argv.includes("--require-catalog");
async function page(path) {
  const r = await fetch(new URL(path, origin));
  assert.equal(r.status, 200, path);
  return new JSDOM(await r.text()).window.document;
}
function cleanCards(doc) {
  for (const card of doc.querySelectorAll(".interactive-title-card")) {
    assert.equal(card.querySelectorAll("a.title-card").length, 1);
    assert.deepEqual(
      [...card.querySelector("a.title-card").children].map((x) => x.tagName),
      ["DIV", "H3", "P"],
    );
    assert.equal(
      card.querySelectorAll(
        "button,select,input,.community-rating,.card-tracking-indicator,.recommendation-feedback",
      ).length,
      0,
    );
  }
}
const home = await page("/");
cleanCards(home);
assert.equal(home.querySelector(".cinematic-hero"), null);
assert.ok(home.querySelector("h1"));
const discover = await page("/discover");
cleanCards(discover);
assert.equal(discover.querySelector("h1")?.textContent, "Discover");
assert.ok(discover.querySelector('input[role="combobox"]'));
assert.equal(discover.querySelectorAll(".category-pills button").length, 7);
const feedUrl = (query) => {
  const url = new URL("/api/data/title-feed", origin);
  url.search = new URLSearchParams({
    source: "catalog",
    limit: "12",
    ...query,
  });
  return url;
};
const firstResponse = await fetch(feedUrl({}));
let feedPages = 0;
if (firstResponse.ok) {
  const first = await firstResponse.json();
  assert.equal(first.availability, "ready");
  assert.equal(first.offset, 0);
  assert.equal(first.previousCursor, null);
  assert.ok(first.titles.length <= 12);
  const ids = (page) => page.titles.map((item) => item.id);
  if (first.titles.length) {
    const rail = home.querySelector(
      '[role="region"][aria-label="Popular now"]',
    );
    assert.ok(rail, "Home server-renders the first popular rail");
    assert.deepEqual(
      [...rail.querySelectorAll(".interactive-title-card")].map(
        (card) => card.dataset.titleId,
      ),
      ids(first),
    );
  }
  feedPages++;
  if (first.nextCursor) {
    const nextResponse = await fetch(feedUrl({ cursor: first.nextCursor }));
    assert.equal(nextResponse.status, 200);
    const next = await nextResponse.json();
    assert.equal(next.offset, 12);
    assert.ok(next.titles.length > 0 && next.titles.length <= 12);
    const combined = [...ids(first), ...ids(next)];
    assert.equal(new Set(combined).size, combined.length);
    assert.ok(next.previousCursor);
    const previousResponse = await fetch(
      feedUrl({ cursor: next.previousCursor }),
    );
    assert.equal(previousResponse.status, 200);
    const previous = await previousResponse.json();
    assert.deepEqual(ids(previous), ids(first));
    assert.equal(previous.previousCursor, null);
    const mixed = await fetch(
      feedUrl({ category: "movie", cursor: first.nextCursor }),
    );
    assert.equal(mixed.status, 400);
    feedPages++;
  }
} else {
  assert.equal(firstResponse.status, 503);
  assert.equal((await firstResponse.json()).code, "unconfigured");
  assert.equal(requireCatalog, false, "The configured title feed is required.");
}
let titles = 0;
for (const category of ["movie", "anime"]) {
  const response = await fetch(
    new URL(`/api/data/catalog?category=${category}&limit=1`, origin),
  );
  assert.equal(response.status, 200);
  const catalog = await response.json();
  if (!catalog.titles.length) {
    if (requireCatalog) assert.fail(`Real ${category} catalog is required.`);
    continue;
  }
  const title = catalog.titles[0];
  const detail = await page(`/titles/${title.id}`);
  assert.equal(
    detail.querySelector(".detail-heading h1")?.textContent,
    title.title.name,
  );
  assert.ok(detail.querySelector(".detail-poster img"));
  assert.ok(detail.querySelector(".title-actions-detail"));
  assert.match(
    detail.querySelector(".community-line")?.textContent || "",
    /SceneStack community/,
  );
  assert.equal(detail.querySelector(".title-actions-compact"), null);
  titles++;
}
if (titles) {
  const hero = home.querySelector(".featured-title");
  assert.ok(hero);
  assert.equal(hero.querySelectorAll(".title-actions-hero button").length, 1);
  assert.ok(hero.querySelector(".featured-title-meta")?.textContent);
  assert.ok(hero.querySelector('a[href^="/titles/"]'));
}
console.log(
  `HTTP/DOM checks passed for Home, Discover, ${feedPages} catalog feed pages and ${titles} canonical details.`,
);
