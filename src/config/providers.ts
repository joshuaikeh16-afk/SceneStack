// Server-side feature switches. A credential or local ingestion approval never
// implies permission to redistribute provider content in a public release.
export type CatalogProvider = "tmdb" | "myanimelist";
export function providerEnabled(provider: CatalogProvider) {
  const prefix = provider === "tmdb" ? "TMDB" : "MAL";
  return (
    process.env[`${prefix}_API_ENABLED`] === "true" &&
    process.env[`${prefix}_LICENSE_CONFIRMED`] === "true" &&
    (process.env.NODE_ENV !== "production" ||
      process.env[`${prefix}_PUBLIC_RELEASE_APPROVED`] === "true")
  );
}
export function providerArtworkAllowed(url: string | null) {
  if (!url || process.env.NODE_ENV !== "production") return true;
  if (url.startsWith("https://image.tmdb.org/")) return providerEnabled("tmdb");
  if (url.startsWith("https://cdn.myanimelist.net/"))
    return providerEnabled("myanimelist");
  return true;
}
