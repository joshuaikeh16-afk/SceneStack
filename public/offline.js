(() => {
  const retry = document.getElementById("retry"),
    connection = document.getElementById("connection");
  retry.addEventListener("click", () => window.location.reload());
  window.addEventListener("online", () => {
    connection.textContent =
      "Connection restored. Try again to return to SceneStack.";
  });
  const match = window.location.pathname.match(/^\/titles\/([a-f0-9-]{36})$/);
  if (!match || !("caches" in window)) return;
  caches
    .open("scenestack-public-v1")
    .then((cache) => cache.match(`/api/public/title/${match[1]}`))
    .then(async (response) => {
      if (
        !response ||
        Date.now() - Number(response.headers.get("X-SceneStack-Cached-At")) >=
          7 * 86400000
      )
        return;
      const data = await response.json();
      if (!data?.title?.name) return;
      document.getElementById("title").textContent = data.title.name;
      document.getElementById("message").textContent =
        "A previously viewed public title, available as an authorized offline copy.";
      document.getElementById("metadata").textContent = [
        data.title.releaseYear,
        data.title.kind,
        data.runtimeMinutes ? `${data.runtimeMinutes} min` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      document.getElementById("synopsis").textContent =
        data.title.synopsis || "Synopsis unavailable in this copy.";
      document.getElementById("public-title").hidden = false;
    })
    .catch(() => {});
})();
