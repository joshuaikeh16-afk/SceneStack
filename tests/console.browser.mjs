import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const origin = process.argv[2] || "http://127.0.0.1:3100";
const output = path.resolve(".release/qa/2026-11-25");
const file = path.join(output, "browser-report.json");
const report = JSON.parse(await readFile(file, "utf8"));
await writeFile(
  path.join(output, "browser-report.screenshot-caret-race.json"),
  JSON.stringify(report, null, 2),
);
const errors = [];
const checked = [];
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
async function ready(page, selector, handler) {
  await page.waitForFunction(
    ({ selector, handler }) => {
      const el = document.querySelector(selector);
      return (
        el &&
        Object.keys(el).some(
          (k) =>
            k.startsWith("__reactProps$") &&
            typeof el[k]?.[handler] === "function",
        )
      );
    },
    { selector, handler },
    { timeout: 60000 },
  );
}
try {
  for (const [width, height] of sizes) {
    const b = await chromium.launch({
      headless: true,
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--renderer-process-limit=1",
        "--disable-features=BackForwardCache",
      ],
    });
    try {
      const p = await b.newPage({
        viewport: { width, height },
        reducedMotion: "reduce",
      });
      p.on("console", (m) => {
        if (m.type() === "error")
          errors.push({ width, type: "console", message: m.text() });
      });
      p.on("pageerror", (e) =>
        errors.push({ width, type: "pageerror", message: e.message }),
      );
      await p.goto(origin, { waitUntil: "domcontentloaded", timeout: 90000 });
      await ready(p, ".featured-arrows button", "onClick");
      const href = await p
        .locator('[aria-label="Popular now"] a.title-card')
        .first()
        .getAttribute("href");
      const check = async (label) => {
        const x = await p.evaluate(() => ({
          width: innerWidth,
          document: document.documentElement.scrollWidth,
        }));
        assert.ok(
          x.document <= x.width + 1,
          `${label}/${width}: document overflow`,
        );
      };
      await check("Home");
      await p.screenshot({
        caret: "initial",
        path: path.join(
          output,
          `${width}x${height}`,
          "home-console-checked.png",
        ),
      });
      await p.goto(origin + "/discover", {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await ready(p, 'input[role="combobox"]', "onChange");
      await check("Discover");
      await p.screenshot({
        caret: "initial",
        path: path.join(
          output,
          `${width}x${height}`,
          "discover-console-checked.png",
        ),
      });
      await p.goto(origin + href, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await p.locator(".title-actions-detail button").first().waitFor();
      await check("Details");
      await p.screenshot({
        caret: "initial",
        path: path.join(
          output,
          `${width}x${height}`,
          "details-console-checked.png",
        ),
      });
      await p.goto(origin + "/library", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await ready(p, ".google-button", "onClick");
      assert.equal(new URL(p.url()).pathname, "/login");
      await check("Authentication gate");
      await p.screenshot({
        caret: "initial",
        path: path.join(
          output,
          `${width}x${height}`,
          "login-console-checked.png",
        ),
      });
      checked.push({ width, height, status: "passed" });
      console.log(`Console/hydration check passed at ${width}x${height}.`);
    } finally {
      await b.close();
    }
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  report.harnessCorrections = [
    "Screenshot caret hiding changed a React input attribute before hydration. Screenshots now use caret: initial and wait for React handlers. Original errors are retained in browser-report.screenshot-caret-race.json.",
  ];
  report.consoleRevalidation = {
    status: "passed",
    viewports: checked,
    errors: [],
  };
  report.errors = [];
  report.status = "passed";
  delete report.failure;
} catch (error) {
  report.consoleRevalidation = {
    status: "failed",
    viewports: checked,
    errors,
    failure: error.stack || String(error),
  };
  report.status = "failed";
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile(file, JSON.stringify(report, null, 2));
}
