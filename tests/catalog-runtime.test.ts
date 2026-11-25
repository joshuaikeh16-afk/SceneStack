import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";

test("catalog requests single-flight, cache public metadata, and limit upstream concurrency", async () => {
  const loader = Module as unknown as {
    _load: (...args: unknown[]) => unknown;
  };
  const original = loader._load;
  loader._load = function (this: unknown, ...args: unknown[]) {
    if (args[0] === "server-only") return {};
    return Reflect.apply(original, this, args);
  };
  try {
    const { cachedCatalogRequest, catalogRuntimeDiagnostics } =
      await import("../src/lib/metadata/catalog-runtime");
    let release!: () => void;
    let calls = 0;
    const work = async () => {
      calls++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { title: "Isolated public fixture" };
    };
    const first = cachedCatalogRequest("tmdb", "test", "single-flight", work);
    const same = cachedCatalogRequest("tmdb", "test", "single-flight", work);
    release();
    assert.deepEqual(await first, await same);
    assert.equal(calls, 1);
    await cachedCatalogRequest("tmdb", "test", "single-flight", work);
    assert.equal(calls, 1);
    let active = 0,
      peak = 0;
    const pending: (() => void)[] = [];
    const jobs = Array.from({ length: 6 }, (_, i) =>
      cachedCatalogRequest("tmdb", "test", `concurrency-${i}`, async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => pending.push(resolve));
        active--;
        return i;
      }),
    );
    while (pending.length || active) {
      const batch = pending.splice(0);
      batch.forEach((resolve) => resolve());
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4, 5]);
    assert.equal(peak, 2);
    const diagnostics = catalogRuntimeDiagnostics();
    assert.ok(diagnostics.cache.entries <= 96);
    assert.ok(diagnostics.cache.bytes <= 6_000_000);
    assert.equal(diagnostics.cache.pending, 0);
    let attempts = 0;
    await assert.rejects(
      cachedCatalogRequest("tmdb", "test", "failed-response", async () => {
        attempts++;
        throw new Error("isolated failure");
      }),
    );
    assert.equal(
      await cachedCatalogRequest(
        "tmdb",
        "test",
        "failed-response",
        async () => {
          attempts++;
          return "recovered";
        },
      ),
      "recovered",
    );
    assert.equal(attempts, 2);
  } finally {
    loader._load = original;
  }
});
