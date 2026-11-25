import { readdir, readFile } from "node:fs/promises";
if (
  process.argv
    .slice(2)
    .some(
      (arg) => !["--source-only", "--build-dir=.next-build-qa"].includes(arg),
    )
)
  throw new Error(
    "Use --source-only or --build-dir=.next-build-qa. Default verification requires a completed build.",
  );
const sourceOnly = process.argv.includes("--source-only");
const secrets = [];
let local = "";
try {
  local = await readFile(new URL("../.env.local", import.meta.url), "utf8");
} catch {}
for (const name of [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "TMDB_API_TOKEN",
  "TMDB_API_KEY",
  "MAL_CLIENT_ID",
  "MAL_CLIENT_SECRET",
  "VERCEL_TOKEN",
  "CATALOG_CURSOR_SECRET",
  "CRON_SECRET",
]) {
  const line = local.split(/\r?\n/).find((row) => row.startsWith(`${name}=`));
  const raw = process.env[name] || line?.slice(name.length + 1).trim() || "";
  const quoted = raw.match(/^(['"])(.*?)\1/);
  const value = quoted ? quoted[2] : raw.split(/\s+#/)[0].trim();
  if (value.length >= 12) secrets.push(value);
}
// Include untracked application source; exclude local secrets, build/cache and operator files.
const sourceDirectories = new Set([
  "src",
  "public",
  "scripts",
  "docs",
  "tests",
  "supabase",
  ".github",
]);
async function scanSource(dir, top = false) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (
        (top && sourceDirectories.has(entry.name)) ||
        (!top && !entry.name.startsWith("."))
      )
        await scanSource(path);
    } else if (
      !entry.name.endsWith(".log") &&
      !entry.name.endsWith(".tsbuildinfo") &&
      (!entry.name.startsWith(".env") || entry.name === ".env.example")
    ) {
      const source = await readFile(path, "utf8");
      if (secrets.some((value) => source.includes(value)))
        throw new Error(
          `Configured server credential found in publishable source: ${path.pathname}`,
        );
    }
  }
}
await scanSource(new URL("../", import.meta.url), true);
const example = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);
for (const name of [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "TMDB_API_TOKEN",
  "TMDB_API_KEY",
  "MAL_CLIENT_ID",
  "MAL_CLIENT_SECRET",
  "VERCEL_TOKEN",
  "CATALOG_CURSOR_SECRET",
  "CRON_SECRET",
]) {
  if (
    example.split(/\r?\n/).some(
      (line) =>
        line.startsWith(`${name}=`) &&
        line
          .slice(name.length + 1)
          .replace(/\s+#.*$/, "")
          .trim(),
    )
  )
    throw new Error(
      `The publishable environment example must leave ${name} empty.`,
    );
}
const root = new URL(
  process.argv.includes("--build-dir=.next-build-qa")
    ? "../.next-build-qa/static/"
    : "../.next/static/",
  import.meta.url,
);
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(?:js|json|map)$/.test(entry.name)) {
      const source = await readFile(path, "utf8");
      if (
        /SUPABASE_SECRET_KEY|SUPABASE_ACCESS_TOKEN|TMDB_API_TOKEN|TMDB_API_KEY|MAL_CLIENT_ID|MAL_CLIENT_SECRET|VERCEL_TOKEN|CATALOG_CURSOR_SECRET|CRON_SECRET|SCENESTACK_ENABLE_ACCOUNT_PURGE|sb_secret_[A-Za-z0-9_-]{10,}/.test(
          source,
        ) ||
        secrets.some((value) => source.includes(value))
      )
        throw new Error(
          `Server-only credential reference in client output: ${entry.name}`,
        );
    }
  }
}
if (sourceOnly) {
  console.log(
    "No configured secret literals in publishable source; environment example contains no server credentials. Client bundles were not checked (source-only mode).",
  );
} else {
  await scan(root);
  console.log(
    "No configured secret literals in publishable source or client bundles; environment example contains no server credentials.",
  );
}
