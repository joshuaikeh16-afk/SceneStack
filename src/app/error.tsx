"use client";

import { Clapperboard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="state-page content-width">
      <p className="eyebrow">AN UNEXPECTED INTERMISSION</p>
      <EmptyState
        icon={Clapperboard}
        title="Let’s take that scene again."
        action={
          <div className="state-actions">
            <button className="button button-primary" onClick={retry}>
              Try again
            </button>
            <ButtonLink href="/" variant="secondary">
              Return home
            </ButtonLink>
          </div>
        }
      >
        <p>
          Something interrupted this page. Try loading it again, or return home
          and come back in a moment.
        </p>
      </EmptyState>
    </div>
  );
}
