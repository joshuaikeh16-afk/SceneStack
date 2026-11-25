import {
  productQuerySchema,
  titleIntentSchema,
  libraryQuerySchema,
} from "@/lib/product/validation";
const destinations = new Set([
  "/",
  "/discover",
  "/library",
  "/profile",
  "/settings",
  "/notifications",
  "/collections/new",
  "/account/recovery",
  "/admin",
  "/activity",
  "/requests",
  "/help",
  "/announcements",
]);
/** Allowlisted relative routes only; no nested return URLs or OAuth loops. */
export function safeRedirect(value: unknown, fallback = "/library"): string {
  if (typeof value !== "string" || /[\\\u0000-\u001f\u007f]/.test(value))
    return fallback;
  if (
    destinations.has(value) ||
    /^\/(?:titles\/[a-zA-Z0-9_-]+|collections\/[a-f0-9-]{36}|people\/[a-zA-Z0-9_-]+|activity\/[a-f0-9-]{36}|admin\/(?:overview|action-center|analytics|users|reports|collections|appeals|support|catalog|title-requests|corrections|duplicates|content-studio|synchronization|providers|health|jobs|announcements|team|audit|settings)(?:\/[a-f0-9-]{36})?)$/.test(
      value,
    )
  )
    return value;
  if (
    !value.startsWith("/discover?") &&
    !value.startsWith("/library?") &&
    !value.startsWith("/titles/")
  )
    return fallback;
  const url = new URL(value, "https://scenestack.invalid");
  const keys = [...url.searchParams.keys()];
  if (
    [...url.searchParams.values()].some((v) =>
      /[\\\u0000-\u001f\u007f]/.test(v),
    )
  )
    return fallback;
  if (url.hash || new Set(keys).size !== keys.length) return fallback;
  if (url.pathname === "/library") {
    const parsed = libraryQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    return parsed.success ? `/library?${url.searchParams}` : fallback;
  }
  if (
    /^\/titles\/[a-f0-9-]{36}$/.test(url.pathname) &&
    keys.length === 2 &&
    keys.every((k) => ["intent", "nonce"].includes(k)) &&
    titleIntentSchema.safeParse(url.searchParams.get("intent")).success &&
    /^[a-f0-9-]{36}$/.test(url.searchParams.get("nonce") || "")
  )
    return `${url.pathname}?${url.searchParams}`;
  if (url.pathname !== "/discover") return fallback;
  const parsed = productQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) return fallback;
  const params = new URLSearchParams(); // Retain only supplied, validated filters.
  for (const key of [
    "category",
    "q",
    "tab",
    "genre",
    "year",
    "country",
    "language",
    "rating",
    "sort",
    "status",
    "page",
    "limit",
  ]) {
    const entry = url.searchParams.get(key);
    if (entry) params.set(key, entry);
  }
  return `/discover${params.size ? `?${params}` : ""}`;
}
