"use client";
import { useId, useRef, useState } from "react";
import {
  Bookmark,
  Heart,
  Layers3,
  Download,
  LibraryBig,
  LockKeyhole,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { TitlePosterGrid } from "@/components/catalog/title-poster-grid";
import {
  CollectionCard,
  type CollectionCardData,
} from "@/components/collections/collection-card";
const views = [
  {
    id: "tracking",
    label: "Tracking",
    icon: Bookmark,
    title: "Your library starts with\none great title.",
    text: "The ones you’re watching. The ones you can’t wait to start. This is where your watching life will come together.",
    note: "Personal tracking becomes available when library storage is connected.",
  },
  {
    id: "favorites",
    label: "Favorites",
    icon: Heart,
    title: "For the ones you’ll\nalways come back to.",
    text: "Some stories become part of you. Your private favorites will have a home here.",
    note: "Saving favorites arrives with personal library storage.",
  },
  {
    id: "collections",
    label: "My Collections",
    icon: Layers3,
    title: "Your taste.\nYour little worlds.",
    text: "A rainy-day mood. A favorite director. A universe of your own. Collections will let you bring stories together your way.",
    note: "Collection creation is coming later. New collections will be private by default.",
  },
  {
    id: "saved",
    label: "Saved Collections",
    icon: LibraryBig,
    title: "Good taste is\nworth keeping.",
    text: "When public collections arrive, the ones you save will live here, ready for your next quiet evening.",
    note: "Saving community collections is not available yet.",
  },
  {
    id: "imported",
    label: "Imported Collections",
    icon: Download,
    title: "Bring your\nwatching world along.",
    text: "A future home for collections brought into SceneStack. Your imported collections will stay separate and easy to find.",
    note: "Importing is planned for a later phase. No import tool is active.",
  },
] as const;
const statuses = [
  "Planned",
  "Watching",
  "Completed",
  "On Hold",
  "Dropped",
] as const;
export function LibraryBrowser({
  collections = [],
}: {
  collections?: readonly CollectionCardData[];
}) {
  const [selected, setSelected] =
    useState<(typeof views)[number]["id"]>("tracking");
  const [status, setStatus] = useState<(typeof statuses)[number]>("Planned");
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const view = views.find((view) => view.id === selected)!;
  const Icon = view.icon;
  const emptyState = (
    <div className="library-empty">
      <div className="library-art" aria-hidden="true">
        <div className="library-art-frame" />
        <div className="library-art-frame" />
        <span>
          <Icon size={28} strokeWidth={1.4} />
        </span>
      </div>
      <div>
        <p className="overline">
          {selected === "tracking"
            ? `${status.toUpperCase()} · YOUR PRIVATE SPACE`
            : "A PLACE FOR WHAT MATTERS"}
        </p>
        <h2>
          {view.title.split("\n").map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </h2>
        <p>{view.text}</p>
        <ButtonLink href="/discover">Find your first story</ButtonLink>
        <span className="inline-note">{view.note}</span>
      </div>
    </div>
  );
  return (
    <section className="library-browser">
      <div
        className="library-tabs"
        role="tablist"
        aria-label="Library sections"
      >
        {views.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            id={`${id}-${item.id}`}
            role="tab"
            type="button"
            aria-selected={item.id === selected}
            aria-controls={`${id}-panel`}
            tabIndex={item.id === selected ? 0 : -1}
            onClick={() => setSelected(item.id)}
            onKeyDown={(event) => {
              let target = index;
              if (event.key === "ArrowRight")
                target = (index + 1) % views.length;
              else if (event.key === "ArrowLeft")
                target = (index - 1 + views.length) % views.length;
              else if (event.key === "Home") target = 0;
              else if (event.key === "End") target = views.length - 1;
              else return;
              event.preventDefault();
              setSelected(views[target].id);
              refs.current[target]?.focus();
            }}
          >
            <item.icon size={16} strokeWidth={1.6} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${selected}`}
        tabIndex={0}
        className="library-tabpanel"
      >
        {selected === "tracking" && (
          <div
            className="library-statuses"
            role="group"
            aria-label="Tracking status"
          >
            {statuses.map((item) => (
              <button
                type="button"
                aria-pressed={item === status}
                key={item}
                onClick={() => setStatus(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        {selected === "collections" && collections.length ? (
          <div className="collection-grid">
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        ) : (
          <TitlePosterGrid items={[]} emptyState={emptyState} />
        )}
        <p className="library-privacy">
          <LockKeyhole size={13} aria-hidden="true" />
          {selected === "collections"
            ? "Your collections start private. Publishing will always be your choice."
            : "Your tracking, favorites, and ratings are visible only to you."}
        </p>
      </div>
    </section>
  );
}
