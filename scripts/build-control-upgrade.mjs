import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createTestDatabase } from "./db-harness.mjs";
import {
  schemaInventoryQuery,
  schemaStructureQuery,
} from "./schema-inventory.mjs";

const target = "supabase/deployment";
const baseVersion = "202611230024";
const report = JSON.parse(
  await readFile(
    ".release/control-center-preflight/hosted-preflight.json",
    "utf8",
  ),
);
if (
  !report.ownerPreserved ||
  report.comparison.inventoryDifferences.length ||
  report.comparison.structuralDifferences.length ||
  report.comparison.unknownHostedVersions.length
)
  throw new Error(
    "A clean read-only hosted preflight is required before generating deployment SQL.",
  );
const allFiles = (await readdir("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const files = allFiles.filter((name) => name.split("_")[0] > baseVersion);
if (files.length !== 7)
  throw new Error(
    "Review the migration range before regenerating this seven-file upgrade.",
  );
const owner = report.owners[0].user_id;
if (!/^[0-9a-f-]{36}$/.test(owner))
  throw new Error("Invalid verified owner UUID.");
const versions = files.map((file) => file.split("_")[0]);
const baselineVersions = allFiles
  .filter((file) => file.split("_")[0] <= baseVersion)
  .map((file) => file.split("_")[0]);
const arraySql = (values) =>
  `array[${values.map((value) => `'${value}'`).join(",")}]::text[]`;

// Compare schema shape, function bodies, grants, policies, indexes and triggers.
// No application/user data contributes to this fingerprint.
const schemaQuery = `select md5(jsonb_build_object('inventory',i.inventory,'structure',s.structure)::text) fingerprint
from (${schemaInventoryQuery}) i cross join (${schemaStructureQuery}) s`;
const snapshotQuery = `select jsonb_object_agg(name,jsonb_build_object('count',count,'fingerprint',fingerprint)) from (
  select 'profiles' name,count(*) count,md5(coalesce(string_agg(md5((to_jsonb(t)-array['verified_at','verified_by','username_change_required'])::text),'' order by id),'')) fingerprint from public.profiles t
  union all select 'titles',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.titles t
  union all select 'collections',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.collections t
  union all select 'tracking',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.tracking t
  union all select 'ratings',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.ratings t
  union all select 'favorites',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.favorites t
  union all select 'collection_items',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by collection_id,title_id),'')) from public.collection_items t
) preservation`;
const manifest = [];
const fingerprints = {};
const sources = [];
const sandbox = await createTestDatabase({ throughVersion: baseVersion });
try {
  await sandbox.exec("set search_path=public");
  fingerprints[baseVersion] = (
    await sandbox.query(schemaQuery)
  ).rows[0].fingerprint;
  for (const file of files) {
    const source = await readFile(`supabase/migrations/${file}`, "utf8");
    if (!/^begin;\s/i.test(source) || !/commit;\s*$/i.test(source))
      throw new Error(`${file} must have one explicit outer transaction.`);
    const body = source.replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, "");
    const delimiter = `$migration_${file.split("_")[0]}$`;
    if (
      body.includes(delimiter) ||
      body.includes("$scenestack_control_upgrade$")
    )
      throw new Error("Dollar-quote delimiter collision.");
    const sha256 = createHash("sha256").update(source).digest("hex");
    manifest.push({ file, sha256 });
    sources.push({
      file,
      body,
      delimiter,
      version: file.split("_")[0],
      name: file.replace(/^\d+_/, "").replace(/\.sql$/, ""),
      sha256,
    });
    await sandbox.exec(source);
    fingerprints[file.split("_")[0]] = (
      await sandbox.query(schemaQuery)
    ).rows[0].fingerprint;
  }
} finally {
  await sandbox.close();
}

let sql = `-- SceneStack Control Center: corrected SQL Editor upgrade / verifier, 025–031.
-- Verified target: ${report.projectRef}; original owner UUID is checked below.
-- Run this ENTIRE file as postgres. It is ONE SQL statement: all preservation
-- state lives in PL/pgSQL variables, never in temporary tables or later queries.
-- Complete installations are verified without replaying DDL. A tracked, matching
-- migration prefix resumes atomically. Untracked objects/schema drift fail closed.
do $scenestack_control_upgrade$
declare
  v_versions constant text[] := ${arraySql(versions)};
  v_baseline_versions constant text[] := ${arraySql(baselineVersions)};
  v_expected constant jsonb := '${JSON.stringify(fingerprints)}'::jsonb;
  v_schema_sql constant text := $schema_fingerprint$${schemaQuery}$schema_fingerprint$;
  v_snapshot_sql constant text := $data_fingerprint$${snapshotQuery}$data_fingerprint$;
  v_history text[];
  v_version text;
  v_latest text := '${baseVersion}';
  v_seen_missing boolean := false;
  v_before jsonb;
  v_after jsonb;
  v_actual text;
  v_applied integer := 0;
begin
  -- Catalog deparsing depends on search_path; compare under a fixed scope.
  perform set_config('search_path','public',true);
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','120s',true);
  perform pg_advisory_xact_lock(710000);
  select coalesce(array_agg(version order by version),'{}'::text[]) into v_history from supabase_migrations.schema_migrations;
  if not v_baseline_versions <@ v_history or exists(select 1 from unnest(v_history) h where h <> all(v_baseline_versions || v_versions)) then
    raise exception 'Unexpected migration history. Stop and inspect the configured project; no upgrade was applied.';
  end if;
  foreach v_version in array v_versions loop
    if v_version = any(v_history) then
      if v_seen_missing then raise exception 'Non-contiguous Control Center migration history. Stop and inspect; no upgrade was applied.'; end if;
      v_latest := v_version;
    else v_seen_missing := true;
    end if;
  end loop;
  if (select count(*) from app_private.platform_owner)<>1 or not exists(select 1 from app_private.platform_owner o join public.profiles p on p.id=o.user_id join public.admin_roles a on a.user_id=o.user_id and a.role='super_admin' where o.user_id='${owner}'::uuid and p.status='active' and coalesce(to_jsonb(a)->>'suspended_at','')='') then
    raise exception 'The verified active owner does not match. No privileges or application data were changed.';
  end if;
  execute v_schema_sql into v_actual;
  if v_actual is distinct from v_expected->>v_latest then
    raise exception 'Schema does not match recorded migration %. Untracked/partial objects or schema drift detected; no migration was replayed.', v_latest;
  end if;
  if not v_seen_missing then
    if (select count(*) from public.admin_roles where role='super_admin')<>1 or (select count(*) from public.admin_roles where role='moderator')+(select count(*) from public.admin_invitations where status='pending' and expires_at>now())>5 then raise exception 'Installed team capacity invariant failed.'; end if;
    raise notice 'Control Center 025–031 already installed: schema, RLS, grants, owner and team constraints verified. No migrations replayed.';
    return;
  end if;
  lock table supabase_migrations.schema_migrations,public.profiles,public.titles,public.collections,public.tracking,public.ratings,public.favorites,public.collection_items in share row exclusive mode;
  if v_history is distinct from (select coalesce(array_agg(version order by version),'{}'::text[]) from supabase_migrations.schema_migrations) then raise exception 'Migration history changed concurrently. Retry the entire statement.'; end if;
  execute v_snapshot_sql into v_before;
`;
for (const { file, body, delimiter, version, name, sha256 } of sources) {
  sql += `
  -- ${file}; SHA256 ${sha256}
  if not '${version}' = any(v_history) then
    execute ${delimiter}
${body}
${delimiter};
    execute v_schema_sql into v_actual;
    if v_actual is distinct from v_expected->>'${version}' then raise exception 'Migration ${version} produced an unexpected schema. The statement is rolled back.'; end if;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[]::text[]);
    v_applied := v_applied+1;
  end if;
`;
}
sql += `
  execute v_snapshot_sql into v_after;
  if v_after is distinct from v_before then raise exception 'Existing user/catalog/library data changed unexpectedly. The entire upgrade is rolled back.'; end if;
  if (select count(*) from public.admin_roles where role='super_admin')<>1 or not exists(select 1 from app_private.platform_owner o join public.profiles p on p.id=o.user_id join public.admin_roles a on a.user_id=o.user_id and a.role='super_admin' where o.user_id='${owner}'::uuid and p.status='active' and a.suspended_at is null) then raise exception 'Owner preservation check failed. The entire statement is rolled back.'; end if;
  if (select count(*) from public.admin_roles where role='moderator')+(select count(*) from public.admin_invitations where status='pending' and expires_at>now())>5 then raise exception 'Moderator capacity invariant failed.'; end if;
  execute v_schema_sql into v_actual;
  if v_actual is distinct from v_expected->>'${versions.at(-1)}' then raise exception 'Final schema/RLS/grant verification failed. The entire statement is rolled back.'; end if;
  perform pg_notify('pgrst','reload schema');
  raise notice 'Control Center verified: % migrations applied atomically; original owner and data fingerprints preserved.',v_applied;
end;
$scenestack_control_upgrade$;
`;
await mkdir(target, { recursive: true });
await writeFile(`${target}/control-center-upgrade.sql`, sql);
const verificationPath = `${target}/control-center-verify.sql`;
const verificationQueries = (await readFile(verificationPath, "utf8")).replace(
  /^-- BEGIN GENERATED ASSERTIONS[\s\S]*?-- END GENERATED ASSERTIONS\n\n/,
  "",
);
const assertions = `-- BEGIN GENERATED ASSERTIONS
-- Self-contained and read-only: no dependency on an upgrade session/snapshot.
do $scenestack_control_verify$
declare v_actual text;
begin
  perform set_config('search_path','public',true);
  if not ${arraySql([...baselineVersions, ...versions])} <@ (select coalesce(array_agg(version),'{}'::text[]) from supabase_migrations.schema_migrations) then raise exception 'Expected migrations 001–031 are not all recorded.'; end if;
  select fingerprint into v_actual from (${schemaQuery}) expected;
  if v_actual is distinct from '${fingerprints[versions.at(-1)]}' then raise exception 'Installed schema/RLS/grants do not match migration 031. Stop and inspect drift.'; end if;
  if (select count(*) from app_private.platform_owner)<>1 or (select count(*) from public.admin_roles where role='super_admin')<>1 or not exists(select 1 from app_private.platform_owner o join public.profiles p on p.id=o.user_id join public.admin_roles a on a.user_id=o.user_id and a.role='super_admin' where o.user_id='${owner}'::uuid and p.status='active' and a.suspended_at is null) then raise exception 'Original active Super Admin invariant failed.'; end if;
  if (select count(*) from public.admin_roles where role='moderator')+(select count(*) from public.admin_invitations where status='pending' and expires_at>now())>5 then raise exception 'Moderator capacity invariant failed.'; end if;
  raise notice 'Control Center schema, RLS, grants, original owner and team capacity verified.';
end;
$scenestack_control_verify$;
-- END GENERATED ASSERTIONS

`;
await writeFile(verificationPath, assertions + verificationQueries);
await writeFile(
  `${target}/control-center-manifest.json`,
  JSON.stringify(
    {
      projectRef: report.projectRef,
      baselineVersion: baseVersion,
      lastVersion: versions.at(-1),
      sourceFiles: manifest,
      schemaFingerprints: fingerprints,
      bundleSha256: createHash("sha256").update(sql).digest("hex"),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Created one-statement, rerunnable SQL Editor upgrade/verifier from ${files.length} source migrations. No temporary preservation objects.`,
);
