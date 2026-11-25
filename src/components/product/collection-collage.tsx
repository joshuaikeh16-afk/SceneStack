"use client";
import Image from "next/image";
import { Layers3, Film } from "lucide-react";
export function CollectionCollage({ posters }: { posters: (string | null)[] }) {
  const slots = posters.slice(0, 4);
  if (!slots.length)
    return (
      <div className="collection-art-empty" aria-label="Collection cover">
        <Layers3 size={42} strokeWidth={1} aria-hidden="true" />
      </div>
    );
  return (
    <div
      className={`poster-collage collage-${slots.length}`}
      data-count={slots.length}
      aria-hidden="true"
    >
      {slots.map((poster, i) => (
        <div key={`${poster}-${i}`} className="collage-tile">
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              sizes="(max-width:600px) 40vw, 220px"
            />
          ) : (
            <span className="collage-fallback">
              <Film size={24} />
            </span>
          )}
        </div>
      ))}
      <span className="collage-gradient" />
    </div>
  );
}
