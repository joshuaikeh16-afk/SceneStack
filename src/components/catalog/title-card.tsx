"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Film } from "lucide-react";
import { categoryLabel } from "@/config/categories";
import { approvedImagePath, titleHref } from "@/lib/metadata/presentation";
import type { Title } from "@/types/title";

export type CommunityRating = {
  source: "scenestack";
  score: number;
  voteCount: number;
};
export type TitleCardData = {
  title: Title;
  onOpenDetails?: React.MouseEventHandler<HTMLAnchorElement>;
  communityRating?: CommunityRating | null;
};

export function TitleCard({ title, onOpenDetails }: TitleCardData) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = approvedImagePath(title.posterUrl);
  const href = titleHref(title.reference);
  const content = (
    <>
      <div className="title-poster">
        {image && failedImage !== image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 600px) 45vw, (max-width: 1000px) 25vw, 16vw"
            onError={() => setFailedImage(image)}
          />
        ) : (
          <span className="missing-poster">
            <Film size={28} strokeWidth={1.3} aria-hidden="true" />
            <span>Poster unavailable</span>
          </span>
        )}
      </div>
      <h3>{title.name}</h3>
      <p>
        {categoryLabel(title.kind)}
        {title.releaseYear !== null && (
          <>
            {" "}
            <span>·</span> {title.releaseYear}
          </>
        )}
      </p>
    </>
  );
  const card = href ? (
    <Link
      href={href}
      className="title-card"
      onClick={onOpenDetails}
      scroll={false}
    >
      {content}
    </Link>
  ) : (
    <div className="title-card">{content}</div>
  );
  return card;
}
