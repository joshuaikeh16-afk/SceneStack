"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, useId, type ReactNode } from "react";
export function ProductDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  returnFocus?: () => HTMLElement | null;
}) {
  const descriptionId = useId();
  const origin = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement)
      origin.current = document.activeElement;
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const body = document.body;
    const count = Number(body.dataset.modalCount || 0) + 1;
    body.dataset.modalCount = String(count);
    return () => {
      const remaining = Math.max(0, Number(body.dataset.modalCount || 1) - 1);
      if (remaining) body.dataset.modalCount = String(remaining);
      else delete body.dataset.modalCount;
    };
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`product-dialog ${className}`}
          aria-describedby={description ? descriptionId : undefined}
          onEscapeKeyDown={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest(".inline-rating-editor")
            )
              event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = returnFocus?.() ?? origin.current;
            if (target?.isConnected) target.focus({ preventScroll: true });
          }}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id={descriptionId}>
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="icon-button dialog-close"
              aria-label="Close dialog"
            >
              <X size={21} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

let titleTrigger: HTMLElement | null = null;
export function rememberTitleTrigger(element: HTMLElement) {
  titleTrigger = element;
}
export function getTitleTrigger() {
  return titleTrigger;
}
