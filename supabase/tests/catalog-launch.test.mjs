import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "../../scripts/db-harness.mjs";
import {
  schemaInventoryQuery,
  schemaStructureQuery,
} from "../../scripts/schema-inventory.mjs";

test("operator permission configuration is atomic, idempotent and preserves owner, data, schema and RLS", async () => {
  const sql = await readFile(
    new URL("../deployment/catalog-permission-and-queue.sql", import.meta.url),
    "utf8",
  );
  const owner = "973543d2-96d9-498b-b9b4-3adf237bd507";
  const db = await createTestDatabase();
  try {
    await db.exec(
      "create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key); insert into supabase_migrations.schema_migrations values('202611250031');",
    );
    await db.query("insert into auth.users(id) values($1)", [owner]);
    await db.query("select public.bootstrap_platform_owner($1)", [owner]);
    await db.exec(
      "insert into public.metadata_providers(key,name,approved,enabled) values('tmdb','TMDB',true,true)",
    );
    await assert.rejects(
      () => db.exec(sql),
      /Expected both existing provider registrations/,
    );
    assert.equal(
      (await db.query("select bulk_approved from public.metadata_providers"))
        .rows[0].bulk_approved,
      false,
    );
    await db.exec(
      "insert into public.metadata_providers(key,name) values('myanimelist','MyAnimeList'); insert into public.titles(display_title,kind) values('Preserved existing title','movie')",
    );
    const before = (await db.query(schemaInventoryQuery)).rows;
    const structure = (await db.query(schemaStructureQuery)).rows;
    const roles = (await db.query("select * from public.admin_roles")).rows;
    await db.exec(sql);
    await db.exec(sql);
    assert.deepEqual((await db.query(schemaInventoryQuery)).rows, before);
    assert.deepEqual((await db.query(schemaStructureQuery)).rows, structure);
    assert.deepEqual(
      (await db.query("select * from public.admin_roles")).rows,
      roles,
    );
    assert.equal(
      (await db.query("select count(*)::int n from public.catalog_jobs"))
        .rows[0].n,
      6,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.metadata_providers where approved and enabled and bulk_approved",
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.audit_logs where action='provider_permission_confirmed'",
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.audit_logs where action='catalog_launch_job_queued'",
        )
      ).rows[0].n,
      6,
    );
    assert.equal(
      (await db.query("select display_title from public.titles")).rows[0]
        .display_title,
      "Preserved existing title",
    );
    assert.equal(
      (await db.query("select user_id from app_private.platform_owner")).rows[0]
        .user_id,
      owner,
    );
  } finally {
    await db.close();
  }
});
