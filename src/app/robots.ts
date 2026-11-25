import type { MetadataRoute } from "next";
import { siteOrigin, searchIndexingEnabled } from "@/config/site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: searchIndexingEnabled()
      ? {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/api/",
            "/auth/",
            "/login",
            "/onboarding",
            "/library",
            "/profile",
            "/settings",
            "/admin",
            "/notifications",
            "/account/",
            "/collections/",
            "/people/",
          ],
        }
      : { userAgent: "*", disallow: "/" },
    ...(searchIndexingEnabled()
      ? { sitemap: `${siteOrigin()}/sitemap.xml` }
      : {}),
  };
}
