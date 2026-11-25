"use client";
export async function controlFetch<T>(
  resource: string,
  params: Record<string, string | number | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== "") query.set(key, String(value));
  const response = await fetch(`/api/control/${resource}?${query}`, {
    cache: "no-store",
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof data.message === "string"
          ? data.message
          : "This workspace is unavailable.",
      ),
      { status: response.status, code: data.code },
    );
  return data as T;
}
export const rowText = (
  row: Record<string, unknown>,
  key: string,
  fallback = "—",
) =>
  typeof row[key] === "string" || typeof row[key] === "number"
    ? String(row[key])
    : fallback;
export const rowNumber = (row: Record<string, unknown>, key: string) =>
  typeof row[key] === "number" ? (row[key] as number) : 0;
export function dateLabel(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not recorded";
}
