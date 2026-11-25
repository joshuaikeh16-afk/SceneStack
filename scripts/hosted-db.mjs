import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";
try {
  loadEnvFile(".env.local");
} catch {}
const mode = process.argv[2] || "preview";
if (!["preview", "apply"].includes(mode))
  throw new Error("Use preview or apply.");
const url = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid.local",
);
if (
  !/^[a-z]{20}\.supabase\.co$/.test(url.hostname) ||
  !process.env.SUPABASE_ACCESS_TOKEN
)
  throw new Error(
    "A configured hosted project and SUPABASE_ACCESS_TOKEN are required.",
  );
const ref = url.hostname.split(".")[0];
if (mode === "apply" && process.argv[3] !== `--confirm=${ref}`)
  throw new Error(
    "Apply requires --confirm=<configured-project-ref> after reviewing preview and backup state.",
  );
const names = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_PASSWORD",
  "DATABASE_URL",
  "TMDB_API_TOKEN",
  "TMDB_API_KEY",
  "MAL_CLIENT_ID",
  "MAL_CLIENT_SECRET",
  "VERCEL_TOKEN",
];
const secrets = names
  .map((n) => process.env[n])
  .filter((s) => s && s.length >= 8);
const redact = (s) =>
  secrets
    .reduce((out, key) => out.split(key).join("[REDACTED]"), s)
    .replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[REDACTED DATABASE URL]");
console.log(
  `${mode === "preview" ? "Previewing" : "Applying"} migrations for ${ref}. No reset, repair, role seed, or catalog seed is performed.`,
);
const args = [
  "exec",
  "--yes",
  "--package=supabase@3.3.0",
  "--",
  "supabase",
  "db",
  "push",
  `--remote=${ref}`,
  "--skip-vault",
  ...(mode === "preview" ? ["--dry-run"] : ["--yes"]),
];
const child = spawn("npm", args, {
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (s) => {
  output += s;
});
child.stderr.on("data", (s) => {
  output += s;
});
child.on("error", () => {
  console.error("Could not start the official Supabase CLI.");
  process.exitCode = 1;
});
child.on("close", (code) => {
  console.log(redact(output));
  process.exitCode = code || 0;
});
