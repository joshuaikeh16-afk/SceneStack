"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { rememberTitle } from "@/app/actions/discovery";
import { useProduct } from "./providers";
export function TitleVisit({ id }: { id: string }) {
  const { bootstrap } = useProduct();
  const client = useQueryClient();
  useEffect(() => {
    if (
      navigator.onLine &&
      bootstrap.userId &&
      bootstrap.availability === "ready"
    )
      void rememberTitle(id).then((reply) => {
        if (reply.ok)
          void client.invalidateQueries({
            queryKey: ["continue", bootstrap.userId, "title-feed", "recent"],
            // Keep the visible shelf in place behind the detail dialog.
            refetchType: "none",
          });
      });
    if (navigator.onLine && "serviceWorker" in navigator)
      void fetch(`/api/public/title/${id}`, { credentials: "omit" }).catch(
        () => {},
      );
  }, [id, bootstrap.userId, bootstrap.availability, client]);
  return null;
}
