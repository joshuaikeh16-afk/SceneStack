import type { MetadataRoute } from "next";
import { siteOrigin, searchIndexingEnabled } from "@/config/site";
export default function sitemap(): MetadataRoute.Sitemap {
  if (!searchIndexingEnabled()) return [];
  return ["/", "/discover", "/credits", "/privacy", "/terms", "/contact"].map(
    (path) => ({
      url: `${siteOrigin()}${path}`,
      changeFrequency:
        path === "/" || path === "/discover" ? "daily" : "monthly",
    }),
  );
}
