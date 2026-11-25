// Actual hosted syntax/schema validation, enforced read-only by the Management API.
// A missing migration therefore fails instead of applying any DDL.
import { loadEnvFile } from "node:process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
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
    "Configured hosted project and local operator token required. No credentials are printed.",
  );
const projectRef = origin.hostname.split(".")[0];
const results = [];
for (const file of [
  "control-center-upgrade.sql",
  "control-center-verify.sql",
]) {
  const query = await readFile(`supabase/deployment/${file}`, "utf8");
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: true }),
    },
  );
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      `${file}: HTTP ${response.status}; ${JSON.stringify(body)}`,
    );
  results.push({ file, status: response.status, result: body });
}
await mkdir(".release", { recursive: true });
await writeFile(
  ".release/control-upgrade-hosted-readonly.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      projectRef,
      mode: "read_only enforced; no migrations or data/role writes",
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    projectRef,
    readOnly: true,
    passed: results.map((row) => row.file),
  }),
);
