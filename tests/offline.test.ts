import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("service worker caches only its static shell and explicitly allowed public title copies", async () => {
  type Stored = Map<string, Response>;
  const buckets = new Map<string, Stored>();
  const listeners = new Map<string, (event: unknown) => void>();
  const origin = "https://scenestack.invalid";
  let offline = false;
  const calls: { url: string; credentials?: string }[] = [];
  const now = Date.now();
  const cacheApi = {
    async open(name: string) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const values = buckets.get(name)!;
      return {
        async addAll(paths: string[]) {
          for (const path of paths)
            values.set(
              path,
              new Response(
                path === "/offline.html"
                  ? "Public offline shell"
                  : "Public static asset",
              ),
            );
        },
        async match(input: Request | string) {
          return values
            .get(
              typeof input === "string" ? input : new URL(input.url).pathname,
            )
            ?.clone();
        },
        async put(input: Request | string, value: Response) {
          values.set(
            typeof input === "string" ? input : new URL(input.url).pathname,
            value.clone(),
          );
        },
        async keys() {
          return [...values.keys()].map(
            (path) => new Request(new URL(path, origin)),
          );
        },
        async delete(input: Request | string) {
          return values.delete(
            typeof input === "string" ? input : new URL(input.url).pathname,
          );
        },
      };
    },
    async keys() {
      return [...buckets.keys()];
    },
    async delete(name: string) {
      return buckets.delete(name);
    },
  };
  let allowed = true;
  const fetcher = async (
    input: Request | string,
    options?: { credentials?: string },
  ) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, credentials: options?.credentials });
    if (offline) throw new Error("offline");
    return new Response(
      JSON.stringify({ title: { name: "Isolated public fixture" } }),
      {
        headers: {
          "Content-Type": "application/json",
          "X-SceneStack-Public-Cache": allowed ? "allowed" : "disallowed",
        },
      },
    );
  };
  const source = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  runInNewContext(source, {
    self: {
      location: { origin },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        listeners.set(name, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: cacheApi,
    fetch: fetcher,
    Response,
    Request,
    URL,
    Headers,
    Date,
  });
  let install: Promise<unknown> | undefined;
  listeners.get("install")!({
    waitUntil: (p: Promise<unknown>) => (install = p),
  });
  await install;
  buckets.set("scenestack-shell-v1", new Map());
  buckets.set("scenestack-public-v1", new Map());
  let activate: Promise<unknown> | undefined;
  listeners.get("activate")!({
    waitUntil: (p: Promise<unknown>) => (activate = p),
  });
  await activate;
  assert.equal(buckets.has("scenestack-shell-v1"), false);
  assert.equal(buckets.has("scenestack-public-v1"), false);
  const assets = buckets.get("scenestack-shell-v2")!;
  assert.ok(assets.has("/offline.html"));
  assert.ok(
    [...assets.keys()].every(
      (p) => p.startsWith("/offline") || p.startsWith("/app-icons/"),
    ),
  );
  function dispatch(path: string, { method = "GET", navigation = false } = {}) {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: {
        url: origin + path,
        method,
        mode: navigation ? "navigate" : "cors",
      },
      respondWith: (p: Promise<Response>) => (response = p),
    });
    return response;
  }
  for (const path of [
    "/api/data/library",
    "/api/data/title-state",
    "/api/assets/scenestack-avatars/private.jpg",
    "/auth/callback",
    "/_next/static/private.js",
  ]) {
    assert.equal(dispatch(path), undefined);
    assert.equal(dispatch(path, { method: "POST" }), undefined);
  }
  const path = "/api/public/title/10000000-0000-4000-8000-000000000001";
  assert.equal((await dispatch(path)!).status, 200);
  const publicPages = buckets.get("scenestack-public-v2")!;
  assert.ok(publicPages.has(path));
  assert.equal(calls.at(-1)?.credentials, "omit");
  assert.ok(!JSON.stringify([...publicPages.keys()]).includes("user"));
  offline = true;
  const cached = await dispatch(path)!;
  assert.equal((await cached.json()).title.name, "Isolated public fixture");
  const shell = await dispatch("/library", { navigation: true })!;
  assert.equal(await shell.text(), "Public offline shell");
  assert.equal(publicPages.size, 1);
  const stored = publicPages.get(path)!;
  const headers = new Headers(stored.headers);
  headers.set("X-SceneStack-Cached-At", String(now - 8 * 86400000));
  publicPages.set(path, new Response(await stored.text(), { headers }));
  assert.equal((await dispatch(path)!).status, 503);
  assert.equal(publicPages.has(path), false);
  offline = false;
  allowed = false;
  await dispatch(path);
  assert.equal(publicPages.has(path), false);
  allowed = true;
  await dispatch(path);
  let clearing: Promise<unknown> | undefined;
  listeners.get("message")!({
    data: { type: "CLEAR_PUBLIC_PAGES" },
    waitUntil: (p: Promise<unknown>) => (clearing = p),
  });
  await clearing;
  assert.equal(buckets.has("scenestack-public-v2"), false);
});
