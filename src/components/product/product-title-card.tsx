"use client";
import {
  TitleCard as Poster,
  type TitleCardData,
} from "@/components/catalog/title-card";
import { rememberTitleTrigger } from "./dialog";
import type { TitleView } from "@/types/product";
export function TitleCard({
  view,
  ...props
}: TitleCardData & { view: TitleView }) {
  return (
    <article className="interactive-title-card" data-title-id={view.id}>
      <Poster
        {...props}
        onOpenDetails={(event) => rememberTitleTrigger(event.currentTarget)}
      />
    </article>
  );
}
