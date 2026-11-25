import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
const origin = process.argv[2] || "http://127.0.0.1:3000";
const output = path.resolve(".release/qa/2026-11-25");
await mkdir(output, { recursive: true });
const launch = () =>
  chromium.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--renderer-process-limit=1",
      "--disable-features=BackForwardCache",
    ],
  });
let browser = await launch();
const resume = process.argv.includes("--resume");
const report = resume
  ? JSON.parse(await readFile(path.join(output, "browser-report.json"), "utf8"))
  : {
      origin,
      viewports: [],
      live: [],
      stress: [],
      errors: [],
      protectedRoutes: [],
      status: "running",
    };
report.origin = origin;
report.status = "running";
delete report.failure;
report.navigationRetries ??= [];
const sizes = [
  [320, 740],
  [360, 800],
  [390, 844],
  [414, 896],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
];
function observe(page, label) {
  page.on("pageerror", (e) =>
    report.errors.push({ label, type: "pageerror", message: e.message }),
  );
  page.on("console", (m) => {
    if (m.type() === "error")
      report.errors.push({ label, type: "console", message: m.text() });
  });
}
async function navigate(page, url, options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await page.goto(url, options);
    } catch (error) {
      if (
        !String(error).includes("ERR_ABORTED") &&
        !String(error).includes("interrupted")
      )
        throw error;
      report.navigationRetries.push({
        url,
        attempt: attempt + 1,
        error: String(error).split("\n")[0],
      });
      if (attempt === 2) throw error;
    }
  }
}
async function measure(page, label) {
  const measurements = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    hero: document.querySelector(".featured-title")?.getBoundingClientRect()
      .height,
    rails: [...document.querySelectorAll(".poster-carousel")].map((el) => ({
      label: el.getAttribute("aria-label") || "Related titles",
      viewport: el.clientWidth,
      scrollWidth: el.scrollWidth,
      display: getComputedStyle(el).display,
      cards: [...el.children]
        .filter((x) =>
          x.matches(".interactive-title-card,.related-work,a.title-card"),
        )
        .map((card) => {
          const box = card.getBoundingClientRect(),
            p = card.querySelector(".title-poster")?.getBoundingClientRect(),
            t = card.querySelector("h3"),
            meta = card.querySelector("a.title-card > p");
          return {
            width: box.width,
            posterWidth: p?.width,
            posterHeight: p?.height,
            titleHeight: t?.getBoundingClientRect().height,
            lineHeight: t ? parseFloat(getComputedStyle(t).lineHeight) : 0,
            metaWhiteSpace: meta ? getComputedStyle(meta).whiteSpace : null,
          };
        }),
    })),
  }));
  assert.ok(
    measurements.document <= measurements.viewport + 1,
    `${label}: document overflow ${measurements.document}/${measurements.viewport}`,
  );
  for (const rail of measurements.rails) {
    assert.equal(rail.display, "flex", `${label}: shared rail layout`);
    for (const card of rail.cards) {
      assert.ok(card.width >= 119, `${label}: collapsed card ${card.width}`);
      assert.ok(
        Math.abs(card.posterHeight / card.posterWidth - 1.5) < 0.025,
        `${label}: poster proportions`,
      );
      assert.ok(
        card.titleHeight <= card.lineHeight * 2 + 0.5,
        `${label}: title exceeds two lines`,
      );
      assert.equal(
        card.metaWhiteSpace,
        "nowrap",
        `${label}: metadata containment`,
      );
    }
  }
  return measurements;
}
async function waitCards(page) {
  await page
    .locator(".poster-carousel .interactive-title-card")
    .first()
    .waitFor({ timeout: 60000 });
  await page.waitForFunction(
    () => {
      const b = document.querySelector(".featured-arrows button");
      return (
        b &&
        Object.keys(b).some(
          (k) =>
            k.startsWith("__reactProps$") &&
            typeof b[k]?.onClick === "function",
        )
      );
    },
    null,
    { timeout: 60000 },
  );
}
try {
  // Real transport and real database: no interception in this section.
  let context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  let page = await context.newPage();
  observe(page, "live");
  await navigate(page, origin, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await waitCards(page);
  const original = await page.locator(".featured-title h1").textContent();
  await page.getByRole("button", { name: "Next featured title" }).click();
  await page.waitForFunction(
    (original) =>
      document.querySelector(".featured-title h1").textContent !== original,
    original,
    { timeout: 15000 },
  );
  await page.getByRole("button", { name: "Previous featured title" }).click();
  const rail = page.getByRole("region", { name: "Popular now", exact: true });
  await rail.scrollIntoViewIfNeeded();
  const baseline = await rail.locator("[data-title-id]").first().boundingBox();
  for (let i = 0; i < (resume ? 0 : 3); i++) {
    const before = await rail.locator("[data-title-id]").count();
    await rail.evaluate((el) =>
      el.scrollTo({ left: el.scrollWidth, behavior: "instant" }),
    );
    await page.waitForFunction(
      ({ before }) =>
        document
          .querySelector('[aria-label="Popular now"]')
          .querySelectorAll("[data-title-id]").length > before,
      { before },
      { timeout: 45000 },
    );
    const after = await rail.locator("[data-title-id]").count(),
      box = await rail.locator("[data-title-id]").first().boundingBox();
    assert.ok(
      Math.abs(box.width - baseline.width) < 0.5,
      "Live pagination changed card width",
    );
    const ids = await rail
      .locator("[data-title-id]")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.titleId));
    assert.equal(new Set(ids).size, ids.length, "Live rail duplicates");
    report.live.push({
      kind: "Home horizontal",
      before,
      after,
      width: box.width,
    });
  }
  await measure(page, "live Home");
  await page.screenshot({
    caret: "initial",
    path: path.join(output, "live-home-390.png"),
  });
  const href = await rail.locator("a.title-card").first().getAttribute("href");
  await rail.locator("a.title-card").first().scrollIntoViewIfNeeded();
  const left = await rail.evaluate((el) => el.scrollLeft);
  if (!resume) {
    await rail.locator("a.title-card").first().click();
    await page.getByRole("dialog").waitFor({ timeout: 45000 });
    await page.screenshot({
      caret: "initial",
      path: path.join(output, "live-title-modal-390.png"),
    });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.ok(
      Math.abs((await rail.evaluate((el) => el.scrollLeft)) - left) < 2,
      "Modal lost rail position",
    );
  }
  await navigate(page, origin + "/discover", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page
    .locator(".feed-grid [data-title-id]")
    .first()
    .waitFor({ timeout: 45000 });
  for (let i = 0; i < (resume ? 0 : 2); i++) {
    const before = await page.locator(".feed-grid [data-title-id]").count();
    await page
      .locator(".feed-grid [data-title-id]")
      .last()
      .scrollIntoViewIfNeeded();
    await page.waitForFunction(
      ({ before }) =>
        document.querySelectorAll(".feed-grid [data-title-id]").length > before,
      { before },
      { timeout: 45000 },
    );
    const ids = await page
      .locator(".feed-grid [data-title-id]")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.titleId));
    assert.equal(new Set(ids).size, ids.length);
    report.live.push({ kind: "Discover vertical", before, after: ids.length });
  }
  await measure(page, "live Discover");
  await page.screenshot({
    caret: "initial",
    path: path.join(output, "live-discover-390.png"),
  });
  // Deterministic layout stress: clone actual rendered card markup only inside
  // this browser DOM. Separate live checks above exercise real query appending.
  await navigate(page, origin, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await waitCards(page);
  for (const [width, height] of sizes.filter(
    ([w, h]) => !report.viewports.some((v) => v.width === w && v.height === h),
  )) {
    report.stress = report.stress.filter((s) => s.viewport !== width);
    await page.setViewportSize({ width, height });
    await navigate(page, origin, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await waitCards(page);
    const directory = path.join(output, `${width}x${height}`);
    await mkdir(directory, { recursive: true });
    for (const name of [
      "Popular now",
      "Popular movies",
      "Anime picks",
      "TV series",
      "Documentaries",
      "Drama essentials",
      "Animation favorites",
    ]) {
      const region = page.getByRole("region", { name, exact: true });
      if (await region.count()) {
        await region.scrollIntoViewIfNeeded();
        await page.waitForFunction(
          (name) => {
            const el = document.querySelector(
              `[role=region][aria-label="${name}"]`,
            );
            return (
              !el ||
              el.querySelector("[data-title-id]") ||
              el.parentElement.querySelector(".feed-error")
            );
          },
          name,
          { timeout: 45000 },
        );
      }
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    const m = await measure(page, `Home ${width}`);
    if (width < 768) assert.ok(m.hero <= 550, "Oversized mobile hero");
    await page.screenshot({
      caret: "initial",
      path: path.join(directory, "home.png"),
      fullPage: true,
    });
    const target = page.getByRole("region", {
      name: "Popular now",
      exact: true,
    });
    await target.scrollIntoViewIfNeeded();
    await target.evaluate((el) => {
      window.__qaCard = el.querySelector("[data-title-id]").cloneNode(true);
      window.__qaTrack = el.cloneNode(false);
      el.replaceWith(window.__qaTrack);
    });
    let initialWidth = 0,
      previousScroll = 0;
    for (const count of [10, 20, 50, 100, 200]) {
      await page.evaluate((count) => {
        const track = window.__qaTrack;
        track.replaceChildren();
        for (let i = 0; i < count; i++) {
          const card = window.__qaCard.cloneNode(true);
          card.dataset.titleId = `isolated-layout-fixture-${i}`;
          if (i % 3 === 0)
            card.querySelector("h3").textContent =
              "A long title with enough words to test clipping and prevent neighbouring card overlap";
          track.appendChild(card);
        }
      }, count);
      const x = await page.evaluate(() => {
        const el = window.__qaTrack;
        const first = el.firstElementChild,
          last = el.lastElementChild;
        return {
          count: el.children.length,
          width: first.getBoundingClientRect().width,
          lastWidth: last.getBoundingClientRect().width,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          document: document.documentElement.scrollWidth,
          viewport: innerWidth,
        };
      });
      if (!initialWidth) initialWidth = x.width;
      assert.ok(
        Math.abs(x.width - initialWidth) < 0.5 &&
          Math.abs(x.lastWidth - initialWidth) < 0.5,
        `${width}/${count}: cards shrink`,
      );
      assert.ok(
        x.scrollWidth > previousScroll,
        `${width}/${count}: track did not grow`,
      );
      assert.ok(
        x.document <= x.viewport + 1,
        `${width}/${count}: document overflow`,
      );
      previousScroll = x.scrollWidth;
      await measure(page, `stress ${width}/${count}`);
      report.stress.push({ viewport: width, ...x });
    }
    await page.locator('[aria-label="Popular now"]').evaluate((el) => {
      const header = document
        .querySelector(".site-header")
        .getBoundingClientRect();
      scrollBy({
        top: el.getBoundingClientRect().top - header.bottom - 20,
        behavior: "instant",
      });
    });
    await page
      .locator('[aria-label="Popular now"]')
      .screenshot({
        caret: "initial",
        path: path.join(directory, "carousel-200.png"),
      });
    await navigate(page, origin + "/discover", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.locator("h1").waitFor();
    await measure(page, `Discover ${width}`);
    await page.screenshot({
      caret: "initial",
      path: path.join(directory, "discover.png"),
    });
    await navigate(page, origin + href, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.locator(".title-detail").waitFor({ timeout: 45000 });
    await measure(page, `Details ${width}`);
    await page.screenshot({
      caret: "initial",
      path: path.join(directory, "title-details.png"),
    });
    if (width < 768) {
      await navigate(page, origin, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      const dock = page.getByRole("navigation", {
        name: "Mobile primary navigation",
      });
      assert.ok(await dock.isVisible());
      const bounds = await dock.boundingBox();
      assert.ok(bounds.x >= 12 && bounds.x + bounds.width <= width - 12);
      assert.ok(
        parseFloat(
          await page
            .locator("body")
            .evaluate((el) => getComputedStyle(el).paddingBottom),
        ) >=
          bounds.height + 20,
      );
    }
    for (const route of [
      "/library",
      "/profile",
      "/collections/10000000-0000-4000-8000-000000000001",
      "/admin",
      "/settings",
      "/notifications",
    ]) {
      await navigate(page, origin + route, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      assert.equal(new URL(page.url()).pathname, "/login");
      await measure(page, `Guest gate ${route}/${width}`);
      await page.screenshot({
        caret: "initial",
        path: path.join(directory, route.split("/")[1] + "-auth-required.png"),
      });
      report.protectedRoutes.push({
        route,
        width,
        status:
          "authentication gate verified; authorized content not exercised",
      });
    }
    report.viewports.push({
      width,
      height,
      status: "passed",
      rails: m.rails.map((r) => ({
        label: r.label,
        cards: r.cards.length,
        cardWidth: r.cards[0]?.width,
        viewport: r.viewport,
        scrollWidth: r.scrollWidth,
      })),
    });
    await writeFile(
      path.join(output, "browser-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(`Passed viewport ${width}x${height}.`);
    await context.close();
    await browser.close();
    browser = await launch();
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    page = await context.newPage();
    observe(page, `viewport ${width}`);
  }
  for (const route of [
    "/library",
    "/profile",
    "/collections/10000000-0000-4000-8000-000000000001",
    "/admin",
  ]) {
    await navigate(page, origin + route, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    assert.ok(
      new URL(page.url()).pathname === "/login",
      "Guest route must require authentication",
    );
    const label = route.split("/")[1];
    await page.screenshot({
      caret: "initial",
      path: path.join(output, `${label}-signed-out.png`),
    });
    report.protectedRoutes.push({
      route,
      status: "authentication gate verified; authorized content not exercised",
    });
  }
  await context.close();
  assert.equal(
    report.errors.length,
    0,
    "Browser console/page errors: " + JSON.stringify(report.errors),
  );
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack || String(error);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(
    path.join(output, "browser-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        status: report.status,
        viewports: report.viewports.length,
        stressCases: report.stress.length,
        live: report.live,
        errors: report.errors.length,
        output,
      },
      null,
      2,
    ),
  );
}
