import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { writeFile } from "node:fs/promises";
loadEnvFile(".env.local");
const origin = process.argv[2] || "http://127.0.0.1:3100";
const database = process.env.NEXT_PUBLIC_SUPABASE_URL;
const headers = {
  apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  Prefer: "count=exact",
};
async function db(params) {
  const url = new URL("/rest/v1/titles", database);
  url.search = new URLSearchParams(params);
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  assert.ok(r.ok, "Read-only canonical lookup failed");
  return { rows: await r.json(), range: r.headers.get("content-range") };
}
const checks = [];
for (const [provider, category, terms] of [
  ["tmdb", "movie", ["Primer", "Coherence", "The Vast of Night"]],
  ["myanimelist", "anime", ["Kaiba", "Haibane Renmei", "Dennou Coil"]],
]) {
  let search;
  for (const term of terms) {
    const before = await db({
      select: "id",
      display_title: `ilike.${term}`,
      limit: "1",
    });
    if (!before.rows.length) {
      search = term;
      break;
    }
  }
  assert.ok(
    search,
    "Choose a verification search not already in the local catalog.",
  );
  const url = new URL("/api/data/catalog", origin);
  url.search = new URLSearchParams({ q: search, category, limit: "12" });
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  assert.equal(r.status, 200, `${provider} live global search status`);
  const first = await r.json();
  assert.ok(first.titles.length, `${provider}: no actual provider results`);
  assert.equal(first.catalog.mode, "federated");
  assert.ok(first.catalog.providers.includes(provider));
  const ids = first.titles.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[a-f0-9-]{36}$/.test(id)));
  const persisted = await db({
    select: "id,display_title",
    id: `in.(${ids.join(",")})`,
    limit: "24",
  });
  assert.equal(
    persisted.rows.length,
    ids.length,
    "Discovered cards must refer to real canonical database rows.",
  );
  const repeated = await fetch(url, { signal: AbortSignal.timeout(60000) });
  assert.equal(repeated.status, 200);
  const again = await repeated.json();
  assert.ok(
    again.titles.some((t) => ids.includes(t.id)),
    "Repeated discovery must reuse canonical UUIDs.",
  );
  checks.push({
    provider,
    search,
    absentBeforeRequest: true,
    status: r.status,
    returned: first.titles.length,
    persisted: ids.length,
    stableIdentityOnRepeat: true,
    examples: first.titles
      .slice(0, 2)
      .map((t) => ({ id: t.id, title: t.title.name })),
  });
}
const count = await db({ select: "id", status: "neq.merged", limit: "1" });
const report = {
  origin,
  checks,
  canonicalRange: count.range,
  productionPermissionsChanged: false,
};
await writeFile(
  ".release/qa/2026-11-25/catalog-live-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
