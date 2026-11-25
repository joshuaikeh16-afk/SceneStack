import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const port = process.argv[2] || "3100";
const directory = ".release/qa/2026-11-25";
await mkdir(directory, { recursive: true });
const log = createWriteStream(`${directory}/dev-server.log`);
const server = spawn(
  process.execPath,
  [
    "--max-old-space-size=512",
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    env: {
      ...process.env,
      NODE_ENV: "development",
      SCENESTACK_BROWSER_QA: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout.pipe(log, { end: false });
server.stderr.pipe(log, { end: false });
let child;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw new Error(
        `QA development server exited (${server.exitCode}); see ${directory}/dev-server.log`,
      );
    try {
      const r = await fetch(`http://127.0.0.1:${port}/icon.svg`, {
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error("Isolated QA server did not become ready.");
  console.log(`Isolated QA server ready on port ${port}.`);
  child = spawn(
    process.execPath,
    [
      "--max-old-space-size=192",
      process.argv.includes("--catalog-only")
        ? "tests/catalog.live.mjs"
        : process.argv.includes("--console-only")
          ? "tests/console.browser.mjs"
          : "tests/carousel.browser.mjs",
      `http://127.0.0.1:${port}`,
      ...process.argv.slice(3),
    ],
    { stdio: "inherit" },
  );
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally {
  child?.kill("SIGTERM");
  server.kill("SIGTERM");
  log.end();
  // Next may add its generated QA type directory to tsconfig during development.
  // Remove only those generated-directory entries, preserving concurrent edits.
  const config = JSON.parse(await readFile("tsconfig.json", "utf8"));
  const includes = config.include?.filter((p) => !p.startsWith(".next-qa/"));
  if (includes && includes.length !== config.include.length) {
    config.include = includes;
    await writeFile("tsconfig.json", JSON.stringify(config, null, 2) + "\n");
  }
}
