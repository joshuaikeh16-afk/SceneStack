import { writeFile, readFile } from "node:fs/promises";
import { format } from "prettier";
import { createTestDatabase } from "./db-harness.mjs";
const db = await createTestDatabase();
try {
  const enums = (
    await db.query(
      `select t.typname,array_agg(e.enumlabel order by e.enumsortorder) labels from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname`,
    )
  ).rows;
  const enumMap = new Map(enums.map((e) => [e.typname, e.labels]));
  function type(sql) {
    if (sql.endsWith("[]")) return `(${type(sql.slice(0, -2))})[]`;
    const name = sql.replace(/^public\./, "");
    if (enumMap.has(name))
      return enumMap
        .get(name)
        .map((v) => JSON.stringify(v))
        .join(" | ");
    if (
      [
        "smallint",
        "integer",
        "bigint",
        "numeric",
        "real",
        "double precision",
      ].includes(name)
    )
      return "number";
    if (name === "boolean") return "boolean";
    if (name === "jsonb" || name === "json") return "Json";
    if (name === "void") return "undefined";
    return "string";
  }
  let out =
    "// Generated from local migrations by npm run db:types. Do not edit by hand.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n";
  const tables = (
    await db.query(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
    )
  ).rows;
  for (const { table_name: name } of tables) {
    const columns = (
      await db.query(
        `select a.attname name,format_type(a.atttypid,a.atttypmod) sql_type,a.attnotnull required,a.atthasdef has_default,a.attgenerated generated from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=$1 and a.attnum>0 and not a.attisdropped order by a.attnum`,
        [name],
      )
    ).rows;
    out += `${JSON.stringify(name)}: {\n`;
    for (const mode of ["Row", "Insert", "Update"]) {
      out += `${mode}: {\n`;
      for (const col of columns) {
        if (mode !== "Row" && col.generated) continue;
        const optional =
          mode === "Update" ||
          (mode === "Insert" && (!col.required || col.has_default));
        out += `${JSON.stringify(col.name)}${optional ? "?" : ""}: ${type(col.sql_type)}${col.required ? "" : " | null"};\n`;
      }
      out += "};\n";
    }
    const relationships = (
      await db.query(
        `
      select c.conname name,ref.relname target,
        array(select a.attname from unnest(c.conkey) with ordinality k(num,pos) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num order by k.pos) columns,
        array(select a.attname from unnest(c.confkey) with ordinality k(num,pos) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num order by k.pos) target_columns,
        exists(select 1 from pg_constraint u where u.conrelid=c.conrelid and u.contype in ('p','u') and u.conkey=c.conkey) one_to_one
      from pg_constraint c join pg_class src on src.oid=c.conrelid join pg_namespace ns on ns.oid=src.relnamespace
      join pg_class ref on ref.oid=c.confrelid join pg_namespace rn on rn.oid=ref.relnamespace
      where c.contype='f' and ns.nspname='public' and rn.nspname='public' and src.relname=$1 order by c.conname
    `,
        [name],
      )
    ).rows;
    out += "Relationships: [\n";
    for (const relationship of relationships)
      out += `{ foreignKeyName: ${JSON.stringify(relationship.name)}; columns: ${JSON.stringify(relationship.columns)}; isOneToOne: ${relationship.one_to_one}; referencedRelation: ${JSON.stringify(relationship.target)}; referencedColumns: ${JSON.stringify(relationship.target_columns)} },\n`;
    out += "];\n};\n";
  }
  out += "}; Views: { [_ in never]: never }; Functions: {\n";
  const funcs = (
    await db.query(
      `select p.proname name,p.proargnames names,p.pronargdefaults defaults,pg_get_function_result(p.oid) result,array(select format_type(x,null) from unnest(p.proargtypes::oid[]) x) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.proname`,
    )
  ).rows;
  for (const f of funcs) {
    if (!f.args?.length) {
      out += `${JSON.stringify(f.name)}: { Args: Record<PropertyKey, never>; Returns: ${type(f.result)} };\n`;
      continue;
    }
    out += `${JSON.stringify(f.name)}: { Args: { `;
    (f.args || []).forEach((arg, i) => {
      out += `${JSON.stringify(f.names[i])}${i >= f.args.length - f.defaults ? "?" : ""}: ${type(arg)} | null; `;
    });
    out += `}; Returns: ${/^SETOF (?:public\.)?[a-z_]+$/.test(f.result) ? 'Database["public"]["Tables"]["' + f.result.replace(/^SETOF (?:public\.)?/, "") + '"]["Row"][]' : type(f.result)} };\n`;
  }
  out += "}; Enums: {\n";
  for (const e of enums)
    out += `${JSON.stringify(e.typname)}: ${e.labels.map((v) => JSON.stringify(v)).join(" | ")};\n`;
  out +=
    '}; CompositeTypes: { [_ in never]: never }; }; };\nexport type TableName = keyof Database["public"]["Tables"];\nexport type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];\n';
  out = await format(out, { parser: "typescript" });
  const target = new URL("../src/types/database.ts", import.meta.url);
  if (process.argv.includes("--check")) {
    const existing = await readFile(target, "utf8");
    if (existing !== out)
      throw new Error("Database types differ. Run npm run db:types.");
    console.log("Database types match all local migrations.");
  } else {
    await writeFile(target, out);
    console.log(
      `Generated types for ${tables.length} tables and ${funcs.length} RPCs.`,
    );
  }
} finally {
  await db.close();
}
