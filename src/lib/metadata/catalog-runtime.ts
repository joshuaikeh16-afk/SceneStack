import "server-only";
import type { CatalogProvider } from "@/config/providers";
import { DataAccessError } from "@/lib/data/errors";

type Event = { at: string; code: string; operation: string };
type Metrics = {
  requests: number;
  hits: number;
  misses: number;
  lastSuccess: string | null;
  errors: Event[];
  paginationFailures: number;
  imported: number;
};
type Entry = { value: unknown; expires: number; bytes: number };
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const backoff: Partial<Record<CatalogProvider, number>> = {};
const metrics: Record<CatalogProvider, Metrics> = {
  tmdb: {
    requests: 0,
    hits: 0,
    misses: 0,
    lastSuccess: null,
    errors: [],
    paginationFailures: 0,
    imported: 0,
  },
  myanimelist: {
    requests: 0,
    hits: 0,
    misses: 0,
    lastSuccess: null,
    errors: [],
    paginationFailures: 0,
    imported: 0,
  },
};
let bytes = 0,
  active = 0;
let windowStart = Date.now(),
  requests = 0,
  imports = 0;
const waiting: (() => void)[] = [];
function windowBudget(kind: "request" | "import") {
  if (Date.now() - windowStart >= 60_000) {
    windowStart = Date.now();
    requests = 0;
    imports = 0;
  }
  if (kind === "request" ? requests >= 90 : imports >= 120)
    throw new DataAccessError(
      "RATE_LIMITED",
      "Catalog discovery is busy. Please retry shortly.",
    );
  if (kind === "request") requests++;
  else imports++;
}
export function catalogError(
  provider: CatalogProvider,
  operation: string,
  code: string,
) {
  const m = metrics[provider];
  m.errors = [
    ...m.errors.slice(-9),
    { at: new Date().toISOString(), operation, code },
  ];
  if (operation === "pagination") m.paginationFailures++;
  if (code === "rate_limited" || code === "RATE_LIMITED")
    backoff[provider] = Date.now() + 30_000;
}
export function invalidateCatalogResponses(provider: CatalogProvider) {
  for (const [key, entry] of cache)
    if (key.startsWith(`${provider}:`)) {
      cache.delete(key);
      bytes -= entry.bytes;
    }
}
export function reserveCatalogImport(provider: CatalogProvider) {
  windowBudget("import");
  metrics[provider].imported++;
}
// Public metadata only. No user state, credentials, raw URLs or query strings in diagnostics.
export async function cachedCatalogRequest<T>(
  provider: CatalogProvider,
  operation: string,
  key: string,
  work: () => Promise<T>,
  ttl = 300_000,
): Promise<T> {
  const identity = `${provider}:${key}`;
  const hit = cache.get(identity);
  if (hit && hit.expires > Date.now()) {
    metrics[provider].hits++;
    return hit.value as T;
  }
  if (hit) {
    bytes -= hit.bytes;
    cache.delete(identity);
  }
  if (pending.has(identity)) {
    metrics[provider].hits++;
    return pending.get(identity) as Promise<T>;
  }
  if ((backoff[provider] ?? 0) > Date.now())
    throw new DataAccessError(
      "RATE_LIMITED",
      "This provider has asked us to pause. Retry shortly.",
    );
  metrics[provider].misses++;
  const task = (async () => {
    if (active >= 2) {
      if (waiting.length >= 20)
        throw new DataAccessError(
          "RATE_LIMITED",
          "Catalog discovery is busy. Please retry shortly.",
        );
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else active++;
    try {
      windowBudget("request");
      metrics[provider].requests++;
      const value = await work();
      metrics[provider].lastSuccess = new Date().toISOString();
      const size = Buffer.byteLength(JSON.stringify(value) ?? "null");
      if (size <= 1_000_000) {
        for (const [name, item] of cache) {
          if (cache.size < 96 && bytes + size <= 6_000_000) break;
          cache.delete(name);
          bytes -= item.bytes;
        }
        cache.set(identity, { value, bytes: size, expires: Date.now() + ttl });
        bytes += size;
      }
      return value;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "unavailable";
      catalogError(provider, operation, code);
      throw error;
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  })();
  pending.set(identity, task);
  try {
    return await task;
  } finally {
    pending.delete(identity);
  }
}
export function catalogRuntimeDiagnostics() {
  return {
    scope:
      "Current server instance; counters reset on restart and are not fleet-wide quotas.",
    cache: {
      entries: cache.size,
      bytes,
      maximumEntries: 96,
      maximumBytes: 6_000_000,
      pending: pending.size,
    },
    providers: structuredClone(metrics),
  };
}
