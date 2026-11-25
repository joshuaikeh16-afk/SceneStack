"use client";
import { useRouter } from "next/navigation";
import { ProductDialog, getTitleTrigger } from "./dialog";

export function TitleDetailSkeleton() {
  return (
    <div className="title-detail-skeleton" role="status" aria-live="polite">
      <span className="sr-only">Loading title details…</span>
      <div className="skeleton detail-loading-backdrop" />
      <div className="detail-loading-content">
        <div className="skeleton detail-loading-poster" />
        <div>
          <div className="skeleton skeleton-heading" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      </div>
    </div>
  );
}
export function TitleModalLoading() {
  const router = useRouter();
  return (
    <ProductDialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
      title="Loading title details"
      returnFocus={getTitleTrigger}
      className="title-route-dialog"
    >
      <TitleDetailSkeleton />
    </ProductDialog>
  );
}
