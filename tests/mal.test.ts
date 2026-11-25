import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeMal,
  malArtwork,
} from "../src/lib/metadata/providers/mal-normalize";
import { approvedImagePath } from "../src/lib/metadata/presentation";

test("MAL normalization preserves actual anime metadata and excludes provider scores and user lists", () => {
  const title = normalizeMal({
    id: 1,
    title: "Isolated anime fixture",
    alternative_titles: {
      ja: "Fixture original",
      synonyms: ["Alias", "Alias"],
    },
    start_date: "2001-04",
    media_type: "tv",
    status: "finished_airing",
    average_episode_duration: 1440,
    studios: [{ id: 2, name: "Fixture studio" }],
    main_picture: {
      large: "https://cdn.myanimelist.net/images/anime/1/123.jpg",
    },
    mean: 9.8,
    rank: 1,
    my_list_status: { score: 10 },
  });
  assert.equal(title.kind, "anime");
  assert.equal(title.year, 2001);
  assert.equal(title.releaseDate, null);
  assert.equal(title.runtime, 24);
  assert.equal(title.edition, "series");
  assert.equal(title.popularity, null);
  assert.deepEqual(title.aliases, ["Fixture original", "Alias"]);
  assert.equal("mean" in title, false);
  assert.equal("my_list_status" in title, false);
  assert.equal(approvedImagePath(title.poster), title.poster);
});
test("MAL artwork excludes unexpected hosts, queries, active content and malformed identifiers", () => {
  for (const value of [
    "https://cdn.myanimelist.net.evil.example/images/anime/1/2.jpg",
    "https://cdn.myanimelist.net/images/anime/1/2.svg",
    "https://cdn.myanimelist.net/images/anime/1/2.jpg?token=private",
    "javascript:alert(1)",
  ]) {
    assert.equal(malArtwork(value), null);
    assert.equal(approvedImagePath(value), null);
  }
  assert.throws(() => normalizeMal({ id: -1, title: "Invalid" }));
});
