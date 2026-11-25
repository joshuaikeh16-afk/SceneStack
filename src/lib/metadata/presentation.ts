import type { TitleReference } from "@/types/title";

// Remote artwork is restricted to the licensed catalog adapter’s image host.
export function approvedImagePath(path: string | null): string | null {
  if (
    path &&
    /^https:\/\/image\.tmdb\.org\/t\/p\/(?:w185|w342|w500|w780|w1280|original)\/[a-zA-Z0-9_-]+\.(?:jpg|png|webp)$/.test(
      path,
    )
  )
    return path;
  if (
    path &&
    /^https:\/\/cdn\.myanimelist\.net\/images\/anime\/[0-9]+\/[0-9]+\.(?:jpg|png|webp)$/.test(
      path,
    )
  )
    return path;
  if (
    !path ||
    !/^\/(?!\/)[a-zA-Z0-9/_-]+\.(?:svg|webp|png|jpe?g|avif)$/.test(path)
  )
    return null;
  return path;
}

export function titleHref(reference: TitleReference): string | null {
  if (
    ![reference.provider, reference.providerId].every((part) =>
      /^[a-zA-Z0-9_-]+$/.test(part),
    )
  )
    return null;
  return reference.provider === "scenestack"
    ? `/titles/${reference.providerId}`
    : `/titles/${reference.provider}--${reference.providerId}`;
}
