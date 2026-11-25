import { readFile, readdir, writeFile } from "node:fs/promises";
import { createTestDatabase } from "./db-harness.mjs";
const files = (
  await readdir(new URL("../supabase/migrations/", import.meta.url))
)
  .filter((name) => name.endsWith(".sql"))
  .sort();
for (const file of files) {
  const text = await readFile(
    new URL(`../supabase/migrations/${file}`, import.meta.url),
    "utf8",
  );
  if (!/^begin;/i.test(text.trim()) || !/commit;$/i.test(text.trim()))
    throw new Error(`Migration must be atomic: ${file}`);
  if (
    /(?:insert\s+into|update|delete\s+from|alter\s+table)\s+auth\./i.test(text)
  )
    throw new Error(`Managed Auth DML is forbidden: ${file}`);
}
const db = await createTestDatabase();
try {
  const tables = (
    await db.query(
      "select n.nspname schema,c.relname name,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r' order by 1,2",
    )
  ).rows;
  if (tables.some((table) => !table.rls))
    throw new Error("An application table has RLS disabled.");
  const functions = (
    await db.query(
      "select n.nspname schema,p.proname name,p.oid::regprocedure::text signature,p.prosecdef definer,p.proconfig config,has_function_privilege('anon',p.oid,'EXECUTE') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') order by 1,2",
    )
  ).rows;
  if (
    functions.some((fn) => fn.definer && !fn.config?.includes('search_path=""'))
  )
    throw new Error("A privileged function has an unsafe search_path.");
  if (
    functions.some(
      (fn) =>
        fn.anon &&
        ![
          "catalog_title_extras",
          "catalog_freshness",
          "public_title_cache_allowed",
          "browse_catalog",
          "title_card_data",
          "community_rating",
          "resolve_title",
          "read_avatar",
          "write_avatar",
          "read_cover",
          "write_cover",
        ].includes(fn.name),
    )
  )
    throw new Error("An unexpected function is callable by anonymous users.");
  const policies = (
    await db.query(
      "select schemaname,tablename,policyname,roles,cmd,permissive from pg_policies where schemaname in ('public','app_private') or (schemaname='storage' and policyname like 'scenestack_%') order by schemaname,tablename,policyname",
    )
  ).rows;
  console.log(
    `Validated ${files.length} migrations, ${tables.length} RLS-protected application tables, ${functions.length} functions, and ${policies.length} policies in isolated PostgreSQL.`,
  );
  if (process.argv.includes("--inventory")) {
    let md =
      "# Database inventory\n\nGenerated from the local migrations with `npm run db:inventory`. This is not a hosted-project inspection.\n\n## Migrations\n\n" +
      files.map((file) => `- \`${file}\``).join("\n") +
      "\n\n## Tables\n\n| Schema | Table | RLS |\n|---|---|---|\n" +
      tables.map((t) => `| ${t.schema} | ${t.name} | Enabled |`).join("\n") +
      "\n\n## Functions\n\n| Signature | Security | Anonymous execute |\n|---|---|---|\n" +
      functions
        .map(
          (f) =>
            `| \`${f.signature}\` | ${f.definer ? "Definer; fixed empty search path" : "Invoker"} | ${f.anon ? (f.schema === "public" ? "Yes; public catalog only" : "Policy helper; false without active identity") : "No"} |`,
        )
        .join("\n") +
      "\n\n## Policies\n\n| Table | Policy | Operation | Roles | Mode |\n|---|---|---|---|---|\n" +
      policies
        .map(
          (p) =>
            `| ${p.schemaname}.${p.tablename} | ${p.policyname} | ${p.cmd} | ${p.roles.join(", ")} | ${p.permissive} |`,
        )
        .join("\n") +
      "\n";
    await writeFile(
      new URL("../docs/database-inventory.md", import.meta.url),
      md,
    );
  }
} finally {
  await db.close();
}
