import type { ReactNode } from "react";
import { SectionHeader } from "@/components/layout/section-header";
import { TitleCard, type TitleCardData } from "./title-card";

export function HorizontalTitleRail({
  title,
  eyebrow,
  description,
  items,
  fallback,
  action,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  items: readonly TitleCardData[];
  fallback: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="title-rail-section">
      <SectionHeader
        title={title}
        eyebrow={eyebrow}
        description={description}
        action={action}
      />
      {items.length ? (
        <div
          className="horizontal-rail poster-carousel"
          tabIndex={0}
          role="region"
          aria-label={title}
        >
          {items.map((item) => (
            <TitleCard
              key={`${item.title.reference.provider}:${item.title.reference.providerId}`}
              {...item}
            />
          ))}
        </div>
      ) : (
        fallback
      )}
    </section>
  );
}
