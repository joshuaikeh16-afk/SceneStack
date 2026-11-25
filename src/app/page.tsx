import Link from "next/link";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { FeaturedTitle } from "@/components/home/featured-title";
import { CategorySelector } from "@/components/catalog/category-selector";
import { getBootstrap } from "@/lib/product/runtime";
import { discoverData } from "@/lib/product/queries";
import { titleFeedPage } from "@/lib/product/title-feed";
import { InfiniteTitleFeed } from "@/components/product/infinite-title-feed";
import { CollectionCard } from "@/components/product/collection-card";
import { Recommendations } from "@/components/product/recommendations";
import {
  ContinueExploring,
  FollowedCreatorsFeed,
} from "@/components/product/continue-exploring";
import { DataNotice } from "@/components/product/availability";

const categories = [
  { category: "movie", label: "Popular movies" },
  { category: "anime", label: "Anime picks" },
  { category: "series", label: "TV series" },
  { category: "documentary", label: "Documentaries" },
  { category: "drama", label: "Drama essentials" },
  { category: "cartoon", label: "Animation favorites" },
] as const;

async function CommunityCollections() {
  const { collections } = await discoverData({ tab: "collections", limit: 6 });
  if (!collections?.length) return null;
  return (
    <section className="product-shelf">
      <div className="shelf-heading">
        <div>
          <p className="eyebrow">CURATED BY THE COMMUNITY</p>
          <h2>Collections to explore</h2>
        </div>
        <Link href="/discover?tab=collections">Explore collections →</Link>
      </div>
      <div className="product-collection-grid">
        {collections.map((collection) => (
          <CollectionCard key={collection.record.id} view={collection} />
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const [bootstrap, popular] = await Promise.all([
    getBootstrap(),
    titleFeedPage("catalog", { limit: 12 }),
  ]);
  const personalShelves =
    !!bootstrap.userId &&
    bootstrap.availability === "ready" &&
    bootstrap.profile?.status === "active";
  const featured = popular.titles.length > 0;
  const featuredTitles = [...popular.titles]
    .sort(
      (a, b) => Number(!!b.title.backdropUrl) - Number(!!a.title.backdropUrl),
    )
    .slice(0, 5);

  return (
    <PageContainer className="home-page">
      {bootstrap.userId && (
        <div className="welcome-line">
          <span>
            Good to have you back,{" "}
            <strong>
              {
                (bootstrap.profile?.display_name || bootstrap.name).split(
                  " ",
                )[0]
              }
              .
            </strong>
          </span>
          <Link href="/library">Your universe awaits</Link>
        </div>
      )}
      {featured ? (
        <FeaturedTitle views={featuredTitles} />
      ) : (
        <header className="home-catalog-empty">
          <h1>Find your next story.</h1>
          <DataNotice state={popular.availability} />
          {popular.availability === "ready" && (
            <p className="muted-copy">
              The catalog is taking shape. Real titles will appear here as they
              become available.
            </p>
          )}
        </header>
      )}
      <section className="category-section">
        <h2 className="sr-only">Browse by category</h2>
        <CategorySelector compact />
      </section>
      {(featured || popular.availability === "unavailable") && (
        <InfiniteTitleFeed
          layout="rail"
          label="Popular now"
          source="catalog"
          query={{ limit: 12 }}
          initial={popular}
          heading={
            <div className="shelf-heading">
              <h2>Popular now</h2>
              <Link href="/discover">Explore all →</Link>
            </div>
          }
        />
      )}
      {personalShelves && (
        <>
          <InfiniteTitleFeed
            layout="rail"
            label="Continue watching"
            source="watching"
            query={{ limit: 12 }}
            heading={
              <div className="shelf-heading">
                <h2>Continue watching</h2>
                <Link href="/library">My Library →</Link>
              </div>
            }
          />
          <Recommendations />
        </>
      )}
      {featured &&
        categories.map(({ category, label }) => (
          <InfiniteTitleFeed
            key={category}
            layout="rail"
            source="catalog"
            label={label}
            query={{ category, limit: 12 }}
            heading={
              <div className="shelf-heading">
                <h2>{label}</h2>
                <Link
                  href={`/discover?category=${category}`}
                  aria-label={`Explore all ${label.toLowerCase()}`}
                >
                  Explore all →
                </Link>
              </div>
            }
          />
        ))}
      {personalShelves && (
        <>
          <ContinueExploring />
          <FollowedCreatorsFeed />
          <Suspense fallback={null}>
            <CommunityCollections />
          </Suspense>
        </>
      )}
    </PageContainer>
  );
}
