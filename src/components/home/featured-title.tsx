"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import type { TitleView } from "@/types/product";
import { categoryLabel } from "@/config/categories";
import { TitleActions } from "@/components/product/title-actions";
import { rememberTitleTrigger } from "@/components/product/dialog";

export function FeaturedTitle({ views }: { views: TitleView[] }) {
  const [index, setIndex] = useState(0);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const view = views[index] ?? views[0];
  if (!view) return null;
  const artwork = view.title.backdropUrl || view.title.posterUrl;
  function select(next: number) {
    setIndex((next + views.length) % views.length);
  }
  return (
    <section
      className="featured-title"
      aria-roledescription="carousel"
      aria-label="Featured titles"
    >
      {artwork && artwork !== failedImage && (
        <Image
          key={artwork}
          src={artwork}
          alt=""
          fill
          priority={index === 0}
          sizes="(max-width: 767px) 100vw, 1400px"
          onError={() => setFailedImage(artwork)}
        />
      )}
      <div className="featured-title-shade" />
      <div
        className="featured-title-copy"
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${views.length}`}
        aria-live="polite"
      >
        <p className="eyebrow">
          <span className="spotlight-mark" /> THE SPOTLIGHT
        </p>
        <h1 id="featured-title-name">{view.title.name}</h1>
        <p className="featured-title-meta">
          {[
            view.title.releaseYear,
            categoryLabel(view.title.kind),
            ...view.genres.slice(0, 2).map((g) => g.name),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {view.title.synopsis && (
          <p className="featured-title-synopsis">{view.title.synopsis}</p>
        )}
        <div className="featured-title-actions">
          <TitleActions key={view.id} view={view} hero />
          <Link
            className="button button-secondary"
            href={`/titles/${view.id}`}
            scroll={false}
            onClick={(e) => rememberTitleTrigger(e.currentTarget)}
          >
            <Info size={17} aria-hidden="true" />
            View Details
          </Link>
        </div>
      </div>
      {views.length > 1 && (
        <div className="featured-carousel-controls">
          <div
            className="featured-pagination"
            role="group"
            aria-label="Choose featured title"
          >
            {views.map((title, slide) => (
              <button
                key={title.id}
                type="button"
                aria-label={`Show ${title.title.name}`}
                aria-pressed={index === slide}
                onClick={() => select(slide)}
              >
                <span />
              </button>
            ))}
          </div>
          <div className="featured-arrows">
            <button
              className="icon-button"
              type="button"
              aria-label="Previous featured title"
              onClick={() => select(index - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Next featured title"
              onClick={() => select(index + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
