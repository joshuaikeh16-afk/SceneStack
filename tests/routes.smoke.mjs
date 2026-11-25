import assert from "node:assert/strict";

// Guest-only checks. Default mode expects no Supabase variables; --auto accepts existing public config:
// node tests/routes.smoke.mjs [http://localhost:3000]
const origin = process.argv[2] || "http://localhost:3000";
// --auto skips invalid-code exchange and accepts either setup or Google UI.
// It makes guest-only production smoke checks safe with existing local config.
const auto = process.argv[3] === "--auto";
// HTML-limited crawler mode keeps dynamic metadata/404 assertions meaningful;
// ordinary streamed Next.js navigations may already have committed HTTP 200.
const request = (path) =>
  fetch(new URL(path, origin), {
    redirect: "manual",
    headers: { "User-Agent": "Twitterbot/1.0" },
  });
let checked = 0;
const home = await request("/");
assert.equal(home.status, 200);
assert.match(await home.text(), /Your entertainment/);
checked++;
for (const path of [
  "/library",
  "/profile",
  "/settings",
  "/notifications",
  "/onboarding",
  "/admin",
  "/people/fixture",
  "/collections/10000000-0000-4000-8000-000000000001",
]) {
  const response = await request(path);
  assert.equal(response.status, 307, path);
  const destination = new URL(response.headers.get("location"), origin);
  assert.equal(destination.pathname, "/login");
  assert.equal(
    destination.searchParams.get("next"),
    path === "/onboarding" ? "/library" : path,
  );
  assert.match(response.headers.get("cache-control"), /no-store/);
  checked++;
}
for (const category of [
  "anime",
  "movie",
  "series",
  "cartoon",
  "drama",
  "documentary",
]) {
  const next = `/discover?category=${category}&q=quiet+worlds`;
  const response = await request(next);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /What will you find next/);
  checked++;
}
for (const path of [
  "/login",
  "/login?next=//evil.example",
  "/login?error=callback",
  "/login?error=denied",
  "/login?signed_out=1",
]) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  if (auto)
    assert.match(html, /One quick setup before sign-in|Continue with Google/);
  else {
    assert.match(html, /One quick setup before sign-in/);
    assert.match(html, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  }
  if (path.includes("error=callback"))
    assert.match(html, /sign-in link may have expired/);
  if (path.includes("error=denied")) assert.match(html, /wasn’t completed/);
  if (path.includes("signed_out=1")) assert.match(html, /You’re signed out/);
  checked++;
}
for (const [path, expectedError] of [
  ["/auth/callback", "callback"],
  ["/auth/callback?error=access_denied", "denied"],
  ["/auth/callback?code=invalid&next=https://evil.example", "unavailable"],
]) {
  if (auto && path.includes("code=")) continue;
  const response = await request(path);
  assert.equal(response.status, 307, path);
  const destination = new URL(response.headers.get("location"), origin);
  assert.equal(destination.origin, new URL(origin).origin);
  assert.equal(destination.pathname, "/login");
  assert.equal(destination.searchParams.get("next"), "/library");
  assert.equal(destination.searchParams.get("error"), expectedError);
  checked++;
}
for (const path of ["/titles/no-catalog-yet", "/missing-page"]) {
  const response = await request(path);
  assert.equal(response.status, 404, path);
  assert.match(await response.text(), /This story isn’t here yet/);
  checked++;
}
for (const path of [
  "/discover",
  "/credits",
  "/privacy",
  "/terms",
  "/contact",
  "/robots.txt",
  "/sitemap.xml",
]) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  checked++;
}
for (const path of [
  "/api/data/title-state?ids=10000000-0000-4000-8000-000000000001",
  "/api/data/notifications",
  "/api/data/admin",
  "/api/control/identity",
  "/api/control/workspace?section=overview",
  "/api/jobs/catalog",
]) {
  const response = await request(path);
  assert.equal(response.status, 401, path);
  assert.match(response.headers.get("cache-control"), /no-store/);
  checked++;
}
assert.equal((await request("/api/data/catalog?limit=9999")).status, 400);
checked++;
assert.equal(
  (
    await request(
      "/api/assets/scenestack-avatars/10000000-0000-4000-8000-000000000001/image.jpg",
    )
  ).status,
  404,
);
checked++;
for (const path of [
  "/art/universe.svg",
  "/art/grain.svg",
  "/art/city.svg",
  "/art/orbit.svg",
  "/art/grove.svg",
  "/icon.svg",
  "/offline.html",
  "/offline.css",
  "/offline.js",
  "/app-icons/icon-192.png",
  "/app-icons/icon-512.png",
  "/app-icons/maskable-512.png",
  "/providers/tmdb.svg",
]) {
  assert.equal((await request(path)).status, 200, path);
  checked++;
}
const manifestResponse = await request("/manifest.webmanifest");
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
checked++;
const worker = await request("/sw.js");
assert.equal(worker.status, 200);
assert.match(worker.headers.get("cache-control"), /no-store/);
assert.match(await worker.text(), /X-SceneStack-Public-Cache/);
checked++;
for (const path of [
  "/api/data/history",
  "/api/data/continue",
  "/api/data/feed",
]) {
  assert.equal((await request(path)).status, 401, path);
  checked++;
}
assert.equal((await request("/api/public/title/invalid-id")).status, 404);
checked++;
console.log(
  `Passed ${checked} HTTP route and asset checks (${auto ? "guest-only; existing configuration" : "unconfigured environment"}).`,
);
