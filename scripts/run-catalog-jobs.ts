import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { writeFile, mkdir } from "node:fs/promises";
import { runCatalogCycle } from "../src/lib/control/catalog-worker";
import { createPrivilegedClient } from "../src/lib/supabase/admin";
import { z } from "zod";

// Explicit, finite execution; build/dev never runs catalog jobs.
const option = (name: string, fallback: string) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.split("=")[1] ??
  fallback;
const cycles = z.coerce
  .number()
  .int()
  .min(1)
  .max(120)
  .parse(option("cycles", "1"));
const interval = z.coerce
  .number()
  .int()
  .min(15000)
  .max(60000)
  .parse(option("interval-ms", "15000"));
const target = z.coerce
  .number()
  .int()
  .min(1)
  .max(100000)
  .parse(option("target", "50000"));
async function main() {
  if (!process.argv.includes("--execute")) {
    console.log(
      "Dry run. Add --execute to process existing authorized catalog jobs; --cycles=1..120, --interval-ms=15000..60000, --target=50000.",
    );
    return;
  }
  if (process.env.SCENESTACK_JOBS_ENABLED !== "true")
    throw new Error(
      "Enable SCENESTACK_JOBS_ENABLED only after reviewing provider gates and queued jobs.",
    );
  const client = createPrivilegedClient();
  let interrupted = false;
  const stop = () => {
    interrupted = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const report: { at: string; canonicalTitles: number; cycle: unknown }[] = [];
  const count = async () => {
    const result = await client
      .from("titles")
      .select("id", { count: "exact", head: true })
      .neq("status", "merged");
    if (result.error || result.count === null)
      throw new Error(
        "Canonical catalog count unavailable; stopped before further work.",
      );
    return result.count;
  };
  const initial = await count();
  try {
    for (let n = 0; n < cycles && !interrupted; n++) {
      const canonicalTitles = await count();
      if (canonicalTitles >= target) {
        console.log(
          JSON.stringify({ status: "target_reached", canonicalTitles, target }),
        );
        break;
      }
      const cycle = await runCatalogCycle({ platformTasks: false });
      report.push({ at: new Date().toISOString(), canonicalTitles, cycle });
      console.log(JSON.stringify(report.at(-1)));
      if (!cycle.processedJobs) break;
      if (n < cycles - 1 && !interrupted) await delay(interval);
    }
  } finally {
    const final = await count();
    await mkdir(".release", { recursive: true });
    await writeFile(
      ".release/catalog-job-run.json",
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          initial,
          final,
          target,
          cycles: report,
          interrupted,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        status: "bounded_run_finished",
        initial,
        final,
        netNew: final - initial,
        target,
        interrupted,
      }),
    );
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
main().catch(() => {
  console.error(
    "Catalog run stopped. Check authorized job diagnostics and provider configuration. Secrets and raw responses are not logged.",
  );
  process.exitCode = 1;
});
