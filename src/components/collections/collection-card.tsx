import Link from "next/link";
import { Layers3, LockKeyhole, Globe2 } from "lucide-react";

export type CollectionCardData = {
  id: string;
  name: string;
  description: string | null;
  titleCount: number | null;
  visibility: "private" | "published";
};

export function CollectionCard({
  collection,
}: {
  collection: CollectionCardData;
}) {
  const validId = /^[a-zA-Z0-9_-]+$/.test(collection.id);
  const content = (
    <>
      <span className="collection-cover">
        <Layers3 size={35} strokeWidth={1.3} aria-hidden="true" />
      </span>
      <div>
        <span className="collection-visibility">
          {collection.visibility === "private" ? (
            <LockKeyhole size={12} aria-hidden="true" />
          ) : (
            <Globe2 size={12} aria-hidden="true" />
          )}
          {collection.visibility === "private"
            ? "Private collection"
            : "Published collection"}
        </span>
        <h3>{collection.name}</h3>
        {collection.description && <p>{collection.description}</p>}
        {collection.titleCount !== null && (
          <span className="meta-text">{collection.titleCount} titles</span>
        )}
      </div>
    </>
  );
  return validId ? (
    <Link className="collection-card" href={`/collections/${collection.id}`}>
      {content}
    </Link>
  ) : (
    <div className="collection-card">{content}</div>
  );
}
