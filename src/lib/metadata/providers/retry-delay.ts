// A worker request can wait up to five seconds between attempts. If the
// provider asks for longer, return control to the worker without retrying early.
export function providerRetryDelay(
  header: string | null,
  attempt: number,
  now = Date.now(),
) {
  let delay = 500 * 2 ** attempt;
  if (header !== null) {
    const seconds = /^\d+$/.test(header.trim()) ? Number(header) : NaN;
    const requested = Number.isNaN(seconds)
      ? Date.parse(header) - now
      : seconds * 1000;
    if (!Number.isNaN(requested)) delay = Math.max(500, requested);
  }
  return delay > 5000 ? null : delay;
}
