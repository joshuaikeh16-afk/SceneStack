import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Always in memory. This harness has no remote/database-URL option and never reads .env.
export async function createTestDatabase({ throughVersion } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner_id text, metadata jsonb, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to authenticated;
    grant all on storage.objects,storage.buckets to service_role;
  `);
  const dir = fileURLToPath(
    new URL("../supabase/migrations/", import.meta.url),
  );
  const files = (await readdir(dir))
    .filter(
      (name) =>
        name.endsWith(".sql") &&
        (!throughVersion || name.split("_")[0] <= throughVersion),
    )
    .sort();
  for (const name of files) {
    try {
      await db.exec(await readFile(`${dir}/${name}`, "utf8"));
    } catch (error) {
      await db.close();
      throw new Error(`Migration ${name}: ${error.message}`, { cause: error });
    }
  }
  return db;
}

export async function asUser(db, id, sql, params = [], claims = {}) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [id || "", JSON.stringify({ sub: id, ...claims })],
  );
  await db.exec(id ? "set role authenticated" : "set role anon");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
