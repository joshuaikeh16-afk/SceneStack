"use client";
import { useState } from "react";
import { useProduct } from "./providers";
import { ProductDialog } from "./dialog";
export function Confirmation({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  danger = false,
  connected = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  danger?: boolean;
  connected?: boolean;
}) {
  const { online } = useProduct();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <ProductDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
      title={title}
      description={description}
      className="dialog-small"
    >
      <div className="dialog-body">
        <p className="form-error" role="alert">
          {error}
        </p>
        {connected && !online && (
          <p className="form-error" role="status">
            Reconnect to confirm this change.
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            className={`button ${danger ? "button-danger" : "button-primary"}`}
            disabled={pending || (connected && !online)}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : "Please try again.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </ProductDialog>
  );
}
