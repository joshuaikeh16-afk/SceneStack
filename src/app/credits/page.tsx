import Image from "next/image";
import { PageContainer } from "@/components/layout/page-container";
import { providerEnabled } from "@/config/providers";
export const metadata = { title: "Credits" };
export default async function Credits() {
  return (
    <PageContainer className="account-page narrow-page">
      <header className="compact-heading">
        <p className="eyebrow">THE PEOPLE BEHIND THE PICTURE</p>
        <h1>A few well-earned credits.</h1>
      </header>
      <section className="settings-section">
        <h2>Artwork & typography</h2>
        <p>
          The editorial landscapes are original SceneStack SVG artwork. Geist is
          distributed under the SIL Open Font License, included with this
          project. Icons use Lucide.
        </p>
      </section>
      <section className="settings-section">
        <h2>Metadata</h2>
        <a
          href="https://www.themoviedb.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/providers/tmdb.svg"
            alt="TMDB"
            width={110}
            height={35}
            unoptimized
          />
        </a>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
        <p>
          When enabled, film and television metadata is supplied by The Movie
          Database and anime metadata by MyAnimeList. SceneStack community
          ratings come only from eligible SceneStack votes.
        </p>
        <p>
          Provider access is controlled independently. Enabled integrations
          supply metadata under their applicable terms and attribution
          requirements.
        </p>
        <p>
          In this environment: TMDB{" "}
          {providerEnabled("tmdb") ? "enabled" : "disabled"}; MyAnimeList{" "}
          {providerEnabled("myanimelist") ? "enabled" : "disabled"}.
        </p>
        <a className="text-link" href="https://www.themoviedb.org">
          The Movie Database
        </a>
        <a className="text-link" href="https://myanimelist.net">
          MyAnimeList
        </a>
      </section>
    </PageContainer>
  );
}
