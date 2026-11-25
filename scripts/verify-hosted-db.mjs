import { loadEnvFile } from "node:process";
import { createTestDatabase } from "./db-harness.mjs";
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
  throw new Error("Hosted project and local operator access token required.");
// Catalog metadata only. No user records, Auth identities, private libraries or file content.
import { schemaInventoryQuery as query } from "./schema-inventory.mjs";

const db = await createTestDatabase();
try {
  const local = (await db.query(query)).rows[0].inventory;
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${origin.hostname.split(".")[0]}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: true }),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Hosted schema inspection failed (HTTP ${response.status}).`,
    );
  const remote = (await response.json())[0]?.inventory;
  if (!remote) throw new Error("Hosted inventory response was incomplete.");
  const differences = Object.keys(local).filter(
    (key) => JSON.stringify(local[key]) !== JSON.stringify(remote[key]),
  );
  if (differences.length)
    throw new Error(
      `Hosted schema differs from reviewed migrations: ${differences.join(", ")}.`,
    );
  console.log(
    `Hosted schema matches local migrations: ${remote.tables.length} RLS tables, all columns, ${remote.functions.length} function signatures/roles, ${remote.policies.length} policies and table grants.`,
  );
} finally {
  await db.close();
}
