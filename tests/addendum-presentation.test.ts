import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionCollage } from "../src/components/product/collection-collage";
import { SpoilerGate } from "../src/components/product/spoiler-gate";
import manifest from "../src/app/manifest";
test("collection collages retain the first four positions and show genuine missing-poster fallbacks", () => {
  for (let count = 1; count <= 4; count++) {
    const posters = Array.from({ length: count }, (_, i) =>
      i === 1 ? null : "/art/city.svg",
    );
    const html = renderToStaticMarkup(
      createElement(CollectionCollage, { posters }),
    );
    assert.match(html, new RegExp(`collage-${count}`));
    assert.equal((html.match(/class="collage-tile"/g) || []).length, count);
    if (count > 1) assert.match(html, /collage-fallback/);
  }
  const empty = renderToStaticMarkup(
    createElement(CollectionCollage, { posters: [] }),
  );
  assert.match(empty, /Collection cover/);
  assert.doesNotMatch(empty, /A story waiting to take shape/);
  assert.doesNotMatch(empty, /<img/);
});
test("spoiler gate reveals only its title and explicit consent controls", () => {
  const html = renderToStaticMarkup(
    createElement(SpoilerGate, {
      title: "Isolated collection",
      onReveal: () => {},
      onBack: () => {},
    }),
  );
  assert.match(html, /Isolated collection/);
  assert.match(html, /Reveal Collection/);
  assert.match(html, /Back/);
  assert.doesNotMatch(html, /creator-note|<img|collection-item-row/);
});
test("install manifest has standalone mode and real appropriately sized icons", () => {
  const data = manifest();
  assert.equal(data.display, "standalone");
  assert.equal(data.scope, "/");
  assert.ok(data.icons?.some((icon) => icon.sizes === "192x192"));
  assert.ok(
    data.icons?.some(
      (icon) => icon.sizes === "512x512" && icon.purpose === "maskable",
    ),
  );
});
