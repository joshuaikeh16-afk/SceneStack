import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { z } from "zod";
import { DataAccessError } from "@/lib/data/errors";
import type { ProductQuery } from "./validation";
import type { TitleFeedPage, TitleView } from "@/types/product";
import type {
  DiscoveryPage,
  DiscoverySource,
  DiscoveredTitle,
} from "@/lib/metadata/providers/discovery";

const streamSchema = z
  .object({
    source: z.enum(["tmdb.movie", "tmdb.tv", "myanimelist.anime"]),
    // MAL year discovery traverses four seasons, each with a native offset.
    page: z.number().int().min(0).max(40003),
    index: z.number().int().min(0).max(100),
    done: z.boolean(),
    limited: z.boolean().default(false),
  })
  .strict();
const positionSchema = z
  .object({
    local: z.string().max(3000).nullable(),
    localDone: z.boolean(),
    streams: z.array(streamSchema).max(3),
    turn: z.number().int().min(0).max(3),
    offset: z.number().int().min(0).max(1_000_000),
  })
  .strict();
const cursorSchema = positionSchema
  .extend({
    v: z.literal(2),
    scope: z.string().max(100),
    expires: z.number(),
    cutoff: z.iso.datetime(),
    seen: z.array(z.uuid()).max(64),
    history: z.array(positionSchema).max(12).default([]),
  })
  .strict();
export type FederatedState = z.infer<typeof cursorSchema>;
type Dependencies = {
  local: (cursor: string | null, limit: number) => Promise<TitleFeedPage>;
  remote: (source: DiscoverySource, page: number) => Promise<DiscoveryPage>;
  persist: (
    provider: "tmdb" | "myanimelist",
    titles: DiscoveredTitle[],
    cutoff: string,
  ) => Promise<string[]>;
  views: (ids: string[]) => Promise<TitleView[]>;
};
export type FeedIssue = { source: string; code: string; message: string };
export function encodeFederatedCursor(state: FederatedState, secret: string) {
  const raw = deflateRawSync(JSON.stringify(state)).toString("base64url");
  return `fed.${raw}.${createHmac("sha256", secret).update(raw).digest("base64url")}`;
}
export function decodeFederatedCursor(
  token: string | null | undefined,
  scope: string,
  sources: DiscoverySource[],
  secret: string,
): FederatedState {
  if (!token)
    return {
      v: 2,
      scope,
      expires: Date.now() + 3_600_000,
      cutoff: new Date().toISOString(),
      local: null,
      localDone: false,
      streams: sources.map((source) => ({
        source,
        page: source === "myanimelist.anime" ? 0 : 1,
        index: 0,
        done: false,
        limited: false,
      })),
      turn: 0,
      offset: 0,
      seen: [],
      history: [],
    };
  try {
    if (token.length > 8000) throw new Error();
    const [prefix, raw, signature, extra] = token.split(".");
    if (
      prefix !== "fed" ||
      !raw ||
      !signature ||
      extra ||
      !/^[\w-]+$/.test(raw)
    )
      throw new Error();
    const expected = createHmac("sha256", secret).update(raw).digest();
    const received = Buffer.from(signature, "base64url");
    if (
      received.length !== expected.length ||
      !timingSafeEqual(expected, received)
    )
      throw new Error();
    const state = cursorSchema.parse(
      JSON.parse(
        inflateRawSync(Buffer.from(raw, "base64url"), {
          maxOutputLength: 30_000,
        }).toString(),
      ),
    );
    if (
      state.scope !== scope ||
      state.expires < Date.now() ||
      state.streams.map((s) => s.source).join() !== sources.join() ||
      state.streams.some(
        (s) => s.source.startsWith("tmdb") && (s.page < 1 || s.page > 500),
      )
    )
      throw new Error();
    return state;
  } catch {
    throw new DataAccessError(
      "INVALID_INPUT",
      "These results have expired or do not match your filters. Restart this search.",
    );
  }
}
function issue(source: string, error: unknown): FeedIssue {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unavailable";
  return {
    source,
    code,
    message:
      code === "RATE_LIMITED" || code === "rate_limited"
        ? `${source} is busy. Retry shortly to continue.`
        : `${source} couldn’t load more titles. Retry to continue.`,
  };
}

// Forward cursors contain source positions, never provider payloads or credentials.
// Both native pages and inspected candidates are bounded, including empty pages.
export async function federatedFeedPage(
  q: ProductQuery,
  input: FederatedState,
  deps: Dependencies,
) {
  const state = structuredClone(input);
  const issues: FeedIssue[] = [];
  const selected: TitleView[] = [];
  const seen = new Set(state.seen);
  const localLimit =
    q.limit === 1 ? (state.offset % 2 === 0 ? 1 : 0) : Math.ceil(q.limit / 2);
  if (!state.localDone && localLimit) {
    try {
      const local = await deps.local(state.local, localLimit);
      if (local.availability !== "ready")
        throw new DataAccessError(
          "UNAVAILABLE",
          "Cached titles are unavailable.",
        );
      for (const title of local.titles)
        if (!seen.has(title.id)) {
          selected.push(title);
          seen.add(title.id);
        }
      state.local = local.nextCursor;
      state.localDone = !local.nextCursor;
    } catch (error) {
      issues.push(issue("Local catalog", error));
    }
  }
  const pages = new Map<string, DiscoveryPage>();
  const blocked = new Set<DiscoverySource>();
  const checkpoints = new Map<DiscoverySource, z.infer<typeof streamSchema>>();
  const candidates: { source: DiscoverySource; title: DiscoveredTitle }[] = [];
  const candidateIds = new Set<string>();
  const maximumCandidates = Math.min(24, q.limit - selected.length);
  for (
    let inspected = 0;
    inspected < 120 && candidates.length < maximumCandidates;
    inspected++
  ) {
    const remaining = state.streams.filter(
      (s) => !s.done && !blocked.has(s.source),
    );
    if (!remaining.length) break;
    const stream = state.streams[state.turn % state.streams.length];
    state.turn = (state.turn + 1) % state.streams.length;
    if (stream.done || blocked.has(stream.source)) continue;
    const key = `${stream.source}:${stream.page}`;
    let page = pages.get(key);
    if (!page) {
      if (pages.size >= 6) break;
      try {
        page = await deps.remote(stream.source, stream.page);
        pages.set(key, page);
      } catch (error) {
        issues.push(issue(stream.source, error));
        blocked.add(stream.source);
        continue;
      }
    }
    if (stream.index >= page.items.length) {
      if (page.next === null) {
        stream.done = true;
        stream.limited = !!page.limited;
      } else {
        if (page.next <= stream.page) {
          issues.push(issue(stream.source, { code: "invalid_pagination" }));
          blocked.add(stream.source);
          continue;
        }
        stream.page = page.next;
        stream.index = 0;
      }
      continue;
    }
    if (!checkpoints.has(stream.source))
      checkpoints.set(stream.source, structuredClone(stream));
    const title = page.items[stream.index++];
    const reference = `${stream.source}:${title.externalId}`;
    if (!candidateIds.has(reference)) {
      candidates.push({ source: stream.source, title });
      candidateIds.add(reference);
    }
  }
  for (const provider of ["tmdb", "myanimelist"] as const) {
    const group = candidates.filter((c) => c.source.startsWith(provider));
    if (!group.length) continue;
    try {
      const ids = await deps.persist(
        provider,
        group.map((c) => c.title),
        state.cutoff,
      );
      for (const title of await deps.views(ids))
        if (!seen.has(title.id)) {
          selected.push(title);
          seen.add(title.id);
        }
    } catch (error) {
      issues.push(issue(provider, error));
      // Ingestion may have committed some canonical rows. Retry their original
      // positions; identity lookup reuses those UUIDs rather than creating copies.
      for (const source of new Set(group.map((c) => c.source))) {
        const index = state.streams.findIndex((s) => s.source === source);
        state.streams[index] = checkpoints.get(source)!;
      }
    }
  }
  state.seen = [...seen].slice(-64);
  const more =
    !state.localDone || state.streams.some((s) => !s.done) || !!issues.length;
  if (!selected.length && issues.length)
    throw new DataAccessError(
      issues.some((i) => ["RATE_LIMITED", "rate_limited"].includes(i.code))
        ? "RATE_LIMITED"
        : "UNAVAILABLE",
      issues.map((i) => i.message).join(" "),
    );
  const offset = state.offset;
  const { local, localDone, streams, turn } = input;
  state.history = [
    ...input.history,
    structuredClone({ local, localDone, streams, turn, offset: input.offset }),
  ].slice(-12);
  state.offset += q.limit;
  return {
    state,
    titles: selected,
    issues,
    more,
    offset,
    limited: state.streams.some((s) => s.limited),
  };
}
