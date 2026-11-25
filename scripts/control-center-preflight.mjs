import { loadEnvFile } from "node:process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createTestDatabase } from "./db-harness.mjs";
import {
  schemaInventoryQuery,
  schemaStructureQuery as structureQuery,
} from "./schema-inventory.mjs";
try {
  loadEnvFile(".env.local");
} catch {}
const origin = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid.local",
);
if (
  !/^[a-z]{20}\.supabase\.co$/.test(origin.hostname) ||
  !process.env.SUPABASE_ACCESS_TOKEN
)
  throw new Error(
    "Configured hosted project and a local operator access token are required. No credentials are printed.",
  );
const projectRef = origin.hostname.split(".")[0];
const outputDir = ".release/control-center-preflight";
await mkdir(outputDir, { recursive: true });
async function remote(query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: true }),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Read-only hosted inspection failed (HTTP ${response.status}).`,
    );
  return response.json();
}
const safetyQuery = `select jsonb_build_object(
  'serverVersion',current_setting('server_version'),
  'history',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]') from supabase_migrations.schema_migrations),
  'owners',(select coalesce(jsonb_agg(jsonb_build_object('user_id',o.user_id,'profile_status',p.status,'owner_role_present',exists(select 1 from public.admin_roles a where a.user_id=o.user_id and a.role='super_admin'))),'[]') from app_private.platform_owner o left join public.profiles p on p.id=o.user_id),
  'roles',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'role',role,'granted_at',granted_at)),'[]') from public.admin_roles),
  'preservation',(select jsonb_object_agg(name,jsonb_build_object('count',count,'fingerprint',fingerprint)) from (
    select 'profiles' name,count(*) count,md5(coalesce(string_agg(md5((to_jsonb(t)-array['verified_at','verified_by','username_change_required'])::text),'' order by id),'')) fingerprint from public.profiles t
    union all select 'titles',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.titles t
    union all select 'collections',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.collections t
    union all select 'tracking',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.tracking t
    union all select 'ratings',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.ratings t
    union all select 'favorites',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.favorites t
    union all select 'collection_items',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by collection_id,title_id),'')) from public.collection_items t
  ) p),
  'readiness',jsonb_build_object('control_identity',to_regprocedure('public.control_identity()') is not null,'control_workspace',to_regprocedure('public.control_workspace(text,text,text,integer,date,date,text)') is not null,'admin_invitations',to_regclass('public.admin_invitations') is not null)
) inspection`;

const responses = await Promise.allSettled([
  remote(safetyQuery),
  remote(schemaInventoryQuery),
  remote(structureQuery),
]);
for (const response of responses)
  if (response.status === "rejected") throw response.reason;
const [safety, hosted, structure] = responses.map(
  (response) => response.value[0],
);
const inspection = safety.inspection,
  inventory = hosted.inventory;
if (!inspection || !inventory || !structure.structure)
  throw new Error("Hosted schema response was incomplete.");
const filenames = (await readdir("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const known = new Set(filenames.map((name) => name.split("_")[0]));
const applied = new Set(inspection.history.map((row) => row.version));
const unknown = [...applied].filter((version) => !known.has(version));
const pending = filenames.filter((name) => !applied.has(name.split("_")[0]));
const latest = [...applied].sort().at(-1);
const baseline = await createTestDatabase({ throughVersion: latest });
let comparison;
try {
  const expected = (await baseline.query(schemaInventoryQuery)).rows[0]
    .inventory;
  const expectedStructure = (await baseline.query(structureQuery)).rows[0]
    .structure;
  comparison = {
    baselineVersion: latest,
    unknownHostedVersions: unknown,
    inventoryDifferences: Object.keys(expected).filter(
      (key) => JSON.stringify(expected[key]) !== JSON.stringify(inventory[key]),
    ),
    structuralDifferences: Object.keys(expectedStructure).filter(
      (key) =>
        JSON.stringify(expectedStructure[key]) !==
        JSON.stringify(structure.structure[key]),
    ),
  };
} finally {
  await baseline.close();
}
const checksums = [];
for (const file of pending) {
  const text = await readFile(`supabase/migrations/${file}`, "utf8");
  checksums.push({
    file,
    sha256: createHash("sha256").update(text).digest("hex"),
  });
}
const ownerPreserved =
  inspection.owners.length === 1 &&
  inspection.owners[0].owner_role_present &&
  inspection.owners[0].profile_status === "active" &&
  inspection.roles
    .filter((row) => row.role === "super_admin")
    .every((row) => row.user_id === inspection.owners[0].user_id);
const report = {
  checkedAt: new Date().toISOString(),
  mode: "read-only; no migrations, role changes, ingestion, or deployment",
  projectRef,
  serverVersion: inspection.serverVersion,
  comparison,
  ownerPreserved,
  roles: inspection.roles,
  owners: inspection.owners,
  preservation: inspection.preservation,
  readiness: inspection.readiness,
  pending: checksums,
};
await writeFile(
  `${outputDir}/hosted-preflight.json`,
  JSON.stringify(report, null, 2) + "\n",
);
await writeFile(
  `${outputDir}/hosted-inventory.json`,
  JSON.stringify({ inventory, structure: structure.structure }, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      checkedAt: report.checkedAt,
      projectRef,
      comparison,
      ownerPreserved,
      roleCounts: inspection.roles.reduce(
        (counts, row) => ({
          ...counts,
          [row.role]: (counts[row.role] ?? 0) + 1,
        }),
        {},
      ),
      canonicalTitleCount: inspection.preservation.titles.count,
      readiness: inspection.readiness,
      pending: pending,
      artifact: `${outputDir}/hosted-preflight.json`,
    },
    null,
    2,
  ),
);
if (
  unknown.length ||
  comparison.inventoryDifferences.length ||
  comparison.structuralDifferences.length ||
  !ownerPreserved
)
  process.exitCode = 2;
