import assert from "node:assert/strict";
import test from "node:test";
import { getSupabaseConfig } from "../src/config/env";

test("setup validation fails clearly and rejects secret keys in the public key field", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_secret_test-never-a-real-key";
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_test-placeholder";
    assert.deepEqual(getSupabaseConfig(), {
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test-placeholder",
    });
    for (const url of [
      "not a URL",
      "http://remote.example",
      "https://user:password@project.supabase.co",
      "https://project.supabase.co/path",
      "https://project.supabase.co?token=secret",
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      assert.equal(getSupabaseConfig(), null, url);
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    assert.equal(getSupabaseConfig()?.url, "http://127.0.0.1:54321");
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});
