import {
  importTmdbTitle,
  processTmdbRefreshQueue,
} from "../src/lib/metadata/providers/tmdb-worker";
import {
  importMalTitle,
  processMalRefreshQueue,
} from "../src/lib/metadata/providers/mal-worker";
// Explicit execution only; no hosted writes happen as part of build/test/dev.
const args = process.argv.slice(2);
if (!args.includes("--execute")) {
  console.log(
    "Dry run. Use --execute only after reviewing the provider license, logo, database approval, and target environment. Modes: --import movie|tv|anime ID, --queue (TMDB), or --queue --mal.",
  );
  process.exit(0);
}
async function main() {
  try {
    if (args.includes("--import")) {
      const n = args.indexOf("--import");
      const id =
        args[n + 1] === "anime"
          ? await importMalTitle(args[n + 2])
          : await importTmdbTitle(args[n + 1], args[n + 2]);
      console.log(
        id ? "Canonical title cached successfully." : "No title was imported.",
      );
    } else if (args.includes("--queue"))
      console.log(
        args.includes("--mal")
          ? await processMalRefreshQueue()
          : await processTmdbRefreshQueue(),
      );
    else throw new Error("Select --import or --queue.");
  } catch {
    console.error(
      "Metadata operation failed. Check provider configuration and synchronization status; credentials and provider payloads are never logged.",
    );
    process.exitCode = 1;
  }
}
void main();
