/* Public assets and explicitly licensed public metadata only. Never cache app HTML,
   private APIs, account images, authentication, RSC, or mutating requests. */
const SHELL = "scenestack-shell-v2",
  PAGES = "scenestack-public-v2";
const ASSETS = [
  "/offline.html",
  "/offline.css",
  "/offline.js",
  "/app-icons/icon-192.png",
  "/app-icons/icon-512.png",
  "/app-icons/maskable-512.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("scenestack-") && ![SHELL, PAGES].includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PUBLIC_PAGES")
    event.waitUntil(caches.delete(PAGES));
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL);
        return (
          (await cache.match("/offline.html")) ||
          new Response("You’re offline. Reconnect to open SceneStack.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      }),
    );
    return;
  }
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(SHELL)
        .then(
          async (cache) => (await cache.match(url.pathname)) || fetch(request),
        ),
    );
    return;
  }
  if (
    /^\/api\/public\/title\/[a-f0-9-]{36}$/.test(url.pathname) &&
    !url.search
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const response = await fetch(request, { credentials: "omit" });
          if (
            response.ok &&
            response.headers.get("X-SceneStack-Public-Cache") === "allowed"
          ) {
            const headers = new Headers(response.headers);
            headers.set("X-SceneStack-Cached-At", String(Date.now()));
            await cache.put(
              url.pathname,
              new Response(await response.clone().blob(), {
                status: response.status,
                headers,
              }),
            );
            const keys = await cache.keys();
            for (const key of keys.slice(0, Math.max(0, keys.length - 20)))
              await cache.delete(key);
          } else if (response.status !== 503) await cache.delete(url.pathname);
          return response;
        } catch {
          const cached = await cache.match(url.pathname);
          if (
            cached &&
            Date.now() - Number(cached.headers.get("X-SceneStack-Cached-At")) <
              7 * 86400000
          )
            return cached;
          if (cached) await cache.delete(url.pathname);
          return new Response(
            JSON.stringify({ message: "Reconnect to load this public title." }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }
      })(),
    );
  }
});
