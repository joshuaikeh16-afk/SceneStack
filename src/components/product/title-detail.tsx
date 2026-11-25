"use client";
import Image from "next/image";
import { useState } from "react";
import { useProduct } from "./providers";
import { TitleVisit } from "./title-visit";
import { TitleFeedback } from "./title-feedback";
import { CorrectionDialog } from "./submissions";
import Link from "next/link";
import { Film, Play, Star, ShieldAlert } from "lucide-react";
import type { TitleDetails } from "@/types/product";
import { categoryLabel } from "@/config/categories";
import { TitleActions } from "./title-actions";
import { TitleCard } from "@/components/product/product-title-card";
export function TitleDetail({
  details,
  asPage = false,
}: {
  details: TitleDetails;
  asPage?: boolean;
}) {
  const { bootstrap } = useProduct();
  const [correction, setCorrection] = useState(false);
  const [failedArtwork, setFailedArtwork] = useState<string[]>([]);
  const backdrop = details.title.backdropUrl || details.title.posterUrl;
  const Heading = asPage ? "h1" : "h2";
  return (
    <article className="title-detail">
      <TitleVisit id={details.id} />
      <div className="detail-backdrop">
        {backdrop && !failedArtwork.includes(backdrop) ? (
          <Image
            src={backdrop}
            alt=""
            fill
            sizes="(max-width: 600px) 100vw, 1000px"
            priority={asPage}
            onError={() => setFailedArtwork((old) => [...old, backdrop])}
          />
        ) : (
          <div className="detail-art-fallback" />
        )}
        <div className="backdrop-gradient" />
      </div>
      <div className="detail-main">
        <div className="detail-poster">
          {details.title.posterUrl &&
          !failedArtwork.includes(details.title.posterUrl) ? (
            <Image
              src={details.title.posterUrl}
              alt=""
              fill
              sizes="(max-width:600px) 110px,180px"
              onError={() =>
                setFailedArtwork((old) => [...old, details.title.posterUrl!])
              }
            />
          ) : (
            <div className="missing-poster">
              <Film size={34} />
              <span>Poster unavailable</span>
            </div>
          )}
        </div>
        <div className="detail-heading">
          <p className="eyebrow">
            {categoryLabel(details.title.kind)}
            {details.edition === "season" ? " · Season" : ""}
          </p>
          <Heading>{details.title.name}</Heading>
          {details.originalTitle &&
            details.originalTitle !== details.title.name && (
              <p className="original-title">{details.originalTitle}</p>
            )}
          <div className="detail-metadata">
            {details.title.releaseYear && (
              <span>{details.title.releaseYear}</span>
            )}
            {details.ageRating && <span>{details.ageRating}</span>}
            <span>{details.status}</span>
          </div>
          <div className="detail-genres">
            {details.genres.map((g) => (
              <Link href={`/discover?genre=${g.id}`} key={g.id}>
                {g.name}
              </Link>
            ))}
          </div>
          <div className="community-line">
            <Star size={16} />
            <strong>
              {details.communityRating
                ? details.communityRating.score.toFixed(1)
                : "Not rated"}
            </strong>
            <span>
              SceneStack community
              {details.communityRating
                ? ` · ${details.voteCount} ratings`
                : details.voteCount
                  ? ` · Awaiting ${Math.max(0, 5 - details.voteCount)} more ratings`
                  : ""}
            </span>
          </div>
        </div>
        <section className="detail-synopsis">
          <h3>The story</h3>
          <p>
            {details.title.synopsis ||
              "A synopsis hasn’t been added to the catalog yet."}
          </p>
        </section>
        <div className="detail-interactions">
          <p className="eyebrow">YOUR LIBRARY</p>
          <TitleActions key={details.id} view={details} />
        </div>
        {details.freshness?.stale && (
          <p className="metadata-stale" role="status">
            Showing saved catalog metadata. A refresh is due.
            {details.freshness.lastSuccessAt &&
              ` Last refreshed ${new Date(details.freshness.lastSuccessAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}.`}
          </p>
        )}
        {(details.releaseDate ||
          details.runtimeMinutes ||
          details.countries.length > 0 ||
          details.languages.length > 0 ||
          details.companies.length > 0 ||
          details.warnings.length > 0 ||
          details.aliases.length > 0) && (
          <section className="detail-facts">
            <h3>A little more about this story</h3>
            <dl>
              {details.releaseDate && (
                <div>
                  <dt>Release date</dt>
                  <dd>
                    {new Date(
                      `${details.releaseDate}T00:00:00Z`,
                    ).toLocaleDateString("en-GB", {
                      timeZone: "UTC",
                      dateStyle: "long",
                    })}
                  </dd>
                </div>
              )}
              {details.runtimeMinutes && (
                <div>
                  <dt>
                    {details.edition === "series"
                      ? "Typical episode runtime"
                      : "Runtime"}
                  </dt>
                  <dd>{details.runtimeMinutes} minutes</dd>
                </div>
              )}
              {details.countries.length > 0 && (
                <div>
                  <dt>Countries</dt>
                  <dd>{details.countries.join(", ")}</dd>
                </div>
              )}
              {details.languages.length > 0 && (
                <div>
                  <dt>Languages</dt>
                  <dd>{details.languages.join(", ")}</dd>
                </div>
              )}
              {details.companies.length > 0 && (
                <div>
                  <dt>Studios & production</dt>
                  <dd>{details.companies.join(", ")}</dd>
                </div>
              )}
              {details.aliases.length > 0 && (
                <div className="wide-fact">
                  <dt>Also known as</dt>
                  <dd>{details.aliases.join(" · ")}</dd>
                </div>
              )}
              {details.warnings.length > 0 && (
                <div className="wide-fact content-warnings">
                  <dt>Content warnings</dt>
                  <dd>{details.warnings.join(" · ")}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
        {details.trailers.length > 0 && (
          <div className="detail-trailers">
            {details.trailers.map((t) => (
              <a
                className="button button-secondary"
                href={t.url}
                key={t.id}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Play size={16} />
                {t.label || "Watch trailer"}
                <span className="sr-only"> (opens a new tab)</span>
              </a>
            ))}
          </div>
        )}
        {details.credits.length > 0 && (
          <section className="detail-credits">
            <h3>Cast & creators</h3>
            <div>
              {details.credits.map((c) => (
                <div key={c.id}>
                  <strong>{c.name}</strong>
                  <span>{c.role || c.department}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {details.related.length > 0 && (
          <section className="detail-related">
            <h3>Stay in this universe</h3>

            <div className="horizontal-rail poster-carousel">
              {details.related.map((t) => (
                <div key={t.id} className="related-work">
                  <p className="relationship-label">
                    {(
                      {
                        sequel: "Sequel",
                        prequel: "Prequel",
                        spin_off: "Spin-off",
                        remake: "Remake",
                        adaptation: "Adaptation",
                        franchise: "Shared franchise",
                        related_series: "Related series",
                        season: "Related season",
                        other: "Verified related work",
                      } as Record<string, string>
                    )[details.relationshipLabels[t.id]] ??
                      "Verified related work"}
                  </p>
                  <TitleCard
                    title={t.title}
                    communityRating={t.communityRating}
                    view={t}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        <TitleFeedback id={details.id} />
        {bootstrap.userId && (
          <div className="detail-correction">
            <button className="text-link" onClick={() => setCorrection(true)}>
              Suggest a metadata correction
            </button>
            <CorrectionDialog
              open={correction}
              onOpenChange={setCorrection}
              titleId={details.id}
            />
          </div>
        )}
        <div className="detail-privacy">
          <ShieldAlert size={14} />
          <span>
            Your tracking, favorites, and ratings are private. Published
            collections are visible to members.
          </span>
        </div>
        {details.providerAttributions.length > 0 && (
          <div className="provider-attributions">
            {details.providerAttributions.map((p) => (
              <p key={p.name}>
                {p.attribution || `Metadata supplied by ${p.name}.`}
              </p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
