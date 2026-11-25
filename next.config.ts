import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  distDir:
    process.env.SCENESTACK_BUILD_QA === "true"
      ? ".next-build-qa"
      : process.env.NODE_ENV === "development" &&
          process.env.SCENESTACK_BROWSER_QA === "true"
        ? ".next-qa"
        : ".next",
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    authInterrupts: true,
    cpus: 1,
    webpackMemoryOptimizations: true,
    serverActions: { bodySizeLimit: "4mb" },
  },
  // Artwork hosts used by the explicitly approved metadata adapters.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
        pathname: "/images/anime/**",
      },
    ],
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
