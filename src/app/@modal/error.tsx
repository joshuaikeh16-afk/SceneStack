"use client";
import { useRouter } from "next/navigation";
import { ProductDialog, getTitleTrigger } from "@/components/product/dialog";
export default function TitleModalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const router = useRouter();
  return (
    <ProductDialog
      open
      title="A brief intermission"
      returnFocus={getTitleTrigger}
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
      className="dialog-medium"
    >
      <div className="dialog-body">
        <p className="muted-copy">
          This title couldn’t be loaded. Your browsing position is still here.
          Try again, or close this window to keep exploring.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => router.back()}
          >
            Keep exploring
          </button>
          <button className="button button-primary" onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    </ProductDialog>
  );
}
