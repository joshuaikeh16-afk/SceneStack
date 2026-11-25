import assert from "node:assert/strict";
import { test } from "node:test";
import Module from "node:module";

test("large covers go directly to private Storage, are finalized without file payloads, and clean up validation failures", async (t) => {
  const owner = "50000000-0000-4000-8000-000000000001",
    collection = "50000000-0000-4000-8000-000000000002";
  const calls: { path: string; file: File; options: unknown }[] = [];
  const verified: { collectionId: string; path: string }[] = [];
  const removed: string[][] = [];
  let valid = true,
    storageFails = false;
  const loader = Module as unknown as {
    _load: (...args: unknown[]) => unknown;
    _resolveFilename: (...args: unknown[]) => string;
  };
  const original = loader._load;
  t.after(() => {
    loader._load = original;
  });
  loader._load = function (this: unknown, ...args: unknown[]) {
    const path = loader._resolveFilename(...args);
    if (path.endsWith("/src/lib/supabase/client.ts"))
      return {
        createClient: () => ({
          auth: {
            getUser: async () => ({
              data: { user: { id: owner } },
              error: null,
            }),
          },
          storage: {
            from: (bucket: string) => {
              assert.equal(bucket, "scenestack-collection-covers");
              return {
                upload: async (path: string, file: File, options: unknown) => {
                  calls.push({ path, file, options });
                  return { error: storageFails ? {} : null };
                },
                remove: async (paths: string[]) => {
                  removed.push(paths);
                  return { error: null };
                },
              };
            },
          },
        }),
      };
    if (path.endsWith("/src/app/actions/profile.ts"))
      return {
        validatePersonalCover: async (input: {
          collectionId: string;
          path: string;
        }) => {
          verified.push(input);
          return valid
            ? {
                ok: true,
                data: {
                  bucket: "scenestack-collection-covers",
                  path: input.path,
                },
              }
            : { ok: false, code: "INVALID_INPUT", message: "Invalid image" };
        },
      };
    return Reflect.apply(original, this, args);
  };
  const { uploadPersonalImage } = await import("../src/lib/media/cover-upload");
  const file = new File([new Uint8Array(8 * 1024 * 1024)], "large.png", {
    type: "image/png",
  });
  const form = new FormData();
  form.set("kind", "collection-cover");
  form.set("collectionId", collection);
  form.set("file", file);
  assert.equal((await uploadPersonalImage(form)).ok, true);
  assert.equal(calls[0].file.size, 8388608);
  assert.ok(calls[0].path.startsWith(`${owner}/${collection}/`));
  assert.deepEqual(Object.keys(verified[0]).sort(), ["collectionId", "path"]);
  assert.deepEqual(calls[0].options, {
    contentType: "image/png",
    upsert: false,
    cacheControl: "0",
  });
  valid = false;
  assert.equal((await uploadPersonalImage(form)).ok, false);
  assert.deepEqual(removed[0], [calls[1].path]);
  storageFails = true;
  const prior = verified.length;
  assert.equal((await uploadPersonalImage(form)).ok, false);
  assert.equal(verified.length, prior);
  form.set(
    "file",
    new File([new Uint8Array(8388609)], "too-large.png", { type: "image/png" }),
  );
  assert.equal((await uploadPersonalImage(form)).ok, false);
  assert.equal(calls.length, 3);
});
