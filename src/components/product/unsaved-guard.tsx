"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Confirmation } from "./confirmation";
export function UnsavedGuard({
  dirty,
  onDiscard,
}: {
  dirty: boolean;
  onDiscard?: () => void;
}) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    function unload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function click(event: MouseEvent) {
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.download ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const url = new URL(anchor.href, window.location.href);
      if (
        url.href === window.location.href ||
        (url.origin === window.location.origin &&
          url.pathname === window.location.pathname &&
          url.search === window.location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(url.href);
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  return (
    <Confirmation
      connected={false}
      open={!!destination}
      onOpenChange={(open) => {
        if (!open) setDestination(null);
      }}
      title="Leave with unsaved changes?"
      description="Your last saved version is safe. Recent edits on this screen may be lost."
      confirmLabel="Discard edits and leave"
      danger
      onConfirm={async () => {
        if (destination) {
          onDiscard?.();
          const url = new URL(destination);
          if (url.origin === window.location.origin)
            router.push(url.pathname + url.search + url.hash);
          else window.location.assign(url.href);
        }
      }}
    />
  );
}
