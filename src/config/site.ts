export const site = {
  name: "SceneStack",
  tagline: "Your entertainment. Your universe.",
  description:
    "A home for the stories you love. Discover and organize anime, movies, series, cartoons, dramas, and documentaries.",
  origin: process.env.SCENESTACK_SITE_URL || "https://scenestack.media",
  supportEmail:
    process.env.SCENESTACK_SUPPORT_EMAIL || "scenestackcc@gmail.com",
  operator: process.env.SCENESTACK_OPERATOR_NAME || "Ikeh Joshua",
} as const;

export function siteOrigin() {
  const url = new URL(site.origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "SCENESTACK_SITE_URL must be an HTTPS origin without a path, query or credentials.",
    );
  return url.origin;
}

export function searchIndexingEnabled() {
  return (
    process.env.SCENESTACK_SEARCH_INDEXING === "true" &&
    process.env.VERCEL_ENV !== "preview"
  );
}

export const primaryNavigation = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Discover", href: "/discover", icon: "compass" },
  { label: "My Library", href: "/library", icon: "library" },
  { label: "Profile", href: "/profile", icon: "profile" },
] as const;
