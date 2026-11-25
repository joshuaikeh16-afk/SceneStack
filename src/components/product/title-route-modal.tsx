"use client";
import { useRouter } from "next/navigation";
import type { TitleDetails } from "@/types/product";
import { ProductDialog, getTitleTrigger } from "./dialog";
import { TitleDetail } from "./title-detail";
export function TitleRouteModal({ details }: { details: TitleDetails }) {
  const router = useRouter();
  return (
    <ProductDialog
      open
      returnFocus={getTitleTrigger}
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
      title={`Title details · ${details.title.name}`}
      className="title-route-dialog"
    >
      <TitleDetail key={details.id} details={details} />
    </ProductDialog>
  );
}
