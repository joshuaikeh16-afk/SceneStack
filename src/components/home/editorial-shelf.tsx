import Link from "next/link";
import { discoverHref } from "@/lib/utils/discover";
import type { EntertainmentKind } from "@/types/title";
const editions: {
  category: EntertainmentKind;
  label: string;
  title: string;
  art: string;
}[] = [
  {
    category: "anime",
    label: "ANIME & IMAGINATION",
    title: "For the world\nbuilders.",
    art: "city",
  },
  {
    category: "movie",
    label: "MOVIES & POSSIBILITY",
    title: "Somewhere\nelse entirely.",
    art: "orbit",
  },
  {
    category: "drama",
    label: "SERIES & DRAMAS",
    title: "Just one\nmore feeling.",
    art: "grove",
  },
  {
    category: "documentary",
    label: "LIFE & DOCUMENTARIES",
    title: "The world is\nstill a wonder.",
    art: "universe",
  },
];
export function EditorialShelf() {
  return (
    <>
      <div className="editorial-shelf">
        {editions.map((edition) => (
          <Link
            className="editorial-card"
            href={discoverHref({ category: edition.category })}
            key={edition.category}
          >
            <div
              className="editorial-art"
              style={{ backgroundImage: `url('/art/${edition.art}.svg')` }}
              aria-hidden="true"
            />
            <span className="edition-label">A SCENESTACK MOOD</span>
            <div className="edition-copy">
              <p>{edition.label}</p>
              <h3>
                {edition.title.split("\n").map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </h3>
              <span className="edition-action">
                Explore{" "}
                {edition.category === "movie"
                  ? "movies"
                  : edition.category === "drama"
                    ? "dramas"
                    : edition.category === "documentary"
                      ? "documentaries"
                      : "anime"}
              </span>
            </div>
          </Link>
        ))}
      </div>
      <p className="art-disclaimer">
        Editorial category guides with original artwork. Live trending titles
        and personalized recommendations aren’t connected yet.
      </p>
    </>
  );
}
