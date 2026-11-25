import { Telescope } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="state-page content-width">
      <p className="eyebrow">A LITTLE OUTSIDE THE FRAME · 404</p>
      <EmptyState
        icon={Telescope}
        title="This story isn’t here yet."
        action={<ButtonLink href="/">Back to your universe</ButtonLink>}
      >
        <p>
          The page may have moved, or this title is no longer available. Try
          searching Discover for another story.
        </p>
      </EmptyState>
    </div>
  );
}
