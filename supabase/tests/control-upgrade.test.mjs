import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { createTestDatabase, asUser } from "../../scripts/db-harness.mjs";
test("SQL Editor bundle upgrades the actual 024 baseline atomically, preserves owner/user data, and registers all seven versions", async () => {
  const sql = await readFile(
    new URL("../deployment/control-center-upgrade.sql", import.meta.url),
    "utf8",
  );
  const owner = sql.match(/where o\.user_id='([0-9a-f-]{36})'/)?.[1];
  assert.ok(owner, "Bundle must bind to the verified owner UUID.");
  const member = "71003200-0000-4000-8000-000000000001";
  const db = await createTestDatabase({ throughVersion: "202611230024" });
  try {
    // Reproduce the reported lifetime failure: an ON COMMIT DROP snapshot
    // cannot be used by a later transaction. The corrected bundle has no such dependency.
    await db.exec(
      "begin; create temporary table control_preservation_before on commit drop as select 1 snapshot; commit;",
    );
    await assert.rejects(
      () => db.query("select * from control_preservation_before"),
      (error) => error.code === "42P01",
    );
    await db.exec(
      "create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);",
    );
    for (const name of (
      await readdir(new URL("../migrations/", import.meta.url))
    ).filter(
      (name) => name.endsWith(".sql") && name.split("_")[0] <= "202611230024",
    ))
      await db.query(
        "insert into supabase_migrations.schema_migrations(version,name) values($1,$2)",
        [name.split("_")[0], name.replace(/^\d+_/, "").replace(/\.sql$/, "")],
      );
    await db.query("insert into auth.users(id) values($1),($2)", [
      owner,
      member,
    ]);
    await db.query("select public.bootstrap_platform_owner($1)", [owner]);
    const title = (
      await db.query(
        "insert into public.titles(display_title,kind,status) values('Isolated upgrade preservation fixture','movie','released') returning id",
      )
    ).rows[0].id;
    await asUser(
      db,
      member,
      "select public.change_personal_title($1,'track','planned',null,null,null)",
      [title],
    );
    await asUser(
      db,
      member,
      "select public.change_personal_title($1,'rate',null,8.4,null,null)",
      [title],
    );
    const collection = (
      await asUser(
        db,
        member,
        "insert into public.collections(title) values('Isolated preserved private collection') returning id",
      )
    ).rows[0].id;
    await asUser(db, member, "select public.add_titles_to_collections($1,$2)", [
      [collection],
      [title],
    ]);
    const before = (
      await db.query("select to_jsonb(t) row from public.tracking t")
    ).rows;
    assert.ok(
      !sql.includes("create temporary table control_preservation_before"),
    );
    assert.ok(!sql.includes("pg_temp.control_preservation"));
    // Force a data-preservation mismatch after DDL: the single DO statement
    // must roll back every migration, its history, and the injected data change.
    const corrupted = sql.replace(
      "  execute v_snapshot_sql into v_after;",
      "  update public.titles set display_title='Injected preservation failure';\n  execute v_snapshot_sql into v_after;",
    );
    assert.notEqual(corrupted, sql);
    await assert.rejects(
      () => db.exec(corrupted),
      /Existing user\/catalog\/library data changed unexpectedly/,
    );
    assert.equal(
      (await db.query("select to_regclass('public.admin_invitations') id"))
        .rows[0].id,
      null,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from supabase_migrations.schema_migrations",
        )
      ).rows[0].n,
      24,
    );
    assert.equal(
      (
        await db.query("select display_title from public.titles where id=$1", [
          title,
        ])
      ).rows[0].display_title,
      "Isolated upgrade preservation fixture",
    );
    await db.exec(sql);
    const after = (
      await db.query("select to_jsonb(t) row from public.tracking t")
    ).rows;
    assert.deepEqual(after, before);
    assert.equal(
      (await db.query("select user_id from app_private.platform_owner")).rows[0]
        .user_id,
      owner,
    );
    assert.equal(
      (
        await db.query(
          "select user_id from public.admin_roles where role='super_admin'",
        )
      ).rows[0].user_id,
      owner,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int count from supabase_migrations.schema_migrations",
        )
      ).rows[0].count,
      31,
    );
    assert.equal(
      (await asUser(db, owner, "select public.control_identity() identity"))
        .rows[0].identity.role,
      "super_admin",
    );
    const overview = (
      await asUser(
        db,
        owner,
        "select public.control_workspace('overview') data",
      )
    ).rows[0].data;
    assert.equal(overview.metrics.titles, 1);
    for (const section of [
      "team",
      "catalog",
      "users",
      "reports",
      "appeals",
      "support",
      "title-requests",
      "corrections",
      "duplicates",
      "content-studio",
      "announcements",
      "synchronization",
      "providers",
      "health",
      "jobs",
      "audit",
      "settings",
      "analytics",
    ]) {
      const result = (
        await asUser(db, owner, "select public.control_workspace($1) data", [
          section,
        ])
      ).rows[0].data;
      assert.ok(Array.isArray(result.rows), section);
    }
    assert.equal(
      (await asUser(db, member, "select public.control_identity() identity"))
        .rows[0].identity,
      null,
    );
    await assert.rejects(
      () => asUser(db, member, "select public.control_workspace('overview')"),
      (error) => error.code === "42501",
    );
    const verification = await readFile(
      new URL("../deployment/control-center-verify.sql", import.meta.url),
      "utf8",
    );
    await db.exec(`begin read only; ${verification} commit;`);
    // Completed installs are safely verified in a new transaction, including
    // a search path that cannot resolve unqualified application relations.
    const installed = (
      await db.query(
        "select md5(string_agg(to_jsonb(a)::text,'' order by user_id,role)) fingerprint from public.admin_roles a",
      )
    ).rows[0].fingerprint;
    await db.exec(`begin read only; set local search_path=''; ${sql} commit;`);
    assert.equal(
      (
        await db.query(
          "select md5(string_agg(to_jsonb(a)::text,'' order by user_id,role)) fingerprint from public.admin_roles a",
        )
      ).rows[0].fingerprint,
      installed,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from supabase_migrations.schema_migrations",
        )
      ).rows[0].n,
      31,
    );
    // Drift is rejected instead of hidden with CREATE ... IF NOT EXISTS.
    await db.exec(
      "alter table public.control_cases disable row level security",
    );
    await assert.rejects(
      () => db.exec(sql),
      /Schema does not match recorded migration/,
    );
    await db.exec("alter table public.control_cases enable row level security");
    await db.exec(sql);
    await db.exec(
      "delete from supabase_migrations.schema_migrations where version='202611250027'",
    );
    await assert.rejects(
      () => db.exec(sql),
      /Non-contiguous Control Center migration history/,
    );
    await db.exec(
      "insert into supabase_migrations.schema_migrations(version,name) values('202611250027','control_operations')",
    );
  } finally {
    await db.close();
  }
});

test("SQL Editor bundle resumes a verified tracked prefix without replaying installed migrations", async () => {
  const sql = await readFile(
    new URL("../deployment/control-center-upgrade.sql", import.meta.url),
    "utf8",
  );
  const owner = sql.match(/where o\.user_id='([0-9a-f-]{36})'/)[1];
  const db = await createTestDatabase({ throughVersion: "202611250027" });
  try {
    await db.exec(
      "create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])",
    );
    const files = (
      await readdir(new URL("../migrations/", import.meta.url))
    ).filter(
      (name) => name.endsWith(".sql") && name.split("_")[0] <= "202611250027",
    );
    for (const file of files)
      await db.query(
        "insert into supabase_migrations.schema_migrations(version,name) values($1,$2)",
        [file.split("_")[0], file],
      );
    await db.query("insert into auth.users(id) values($1)", [owner]);
    await db.query("select public.bootstrap_platform_owner($1)", [owner]);
    await db.exec(sql);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from supabase_migrations.schema_migrations",
        )
      ).rows[0].n,
      31,
    );
    assert.equal(
      (await db.query("select user_id from app_private.platform_owner")).rows[0]
        .user_id,
      owner,
    );
    await db.exec(`begin read only; ${sql} commit;`);
  } finally {
    await db.close();
  }
});
