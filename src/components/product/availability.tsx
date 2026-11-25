import { PlugZap, SearchX } from "lucide-react";
import Link from "next/link";
import type { Availability } from "@/types/product";
export function DataNotice({
  state,
  compact = false,
}: {
  state: Availability;
  compact?: boolean;
}) {
  if (state === "ready") return null;
  return (
    <div className={`data-notice ${compact ? "compact" : ""}`} role="status">
      <PlugZap size={19} aria-hidden="true" />
      <div>
        <h2>
          {state === "unconfigured"
            ? "A connection is all that’s missing."
            : state === "migration_required"
              ? "Your universe is ready for its database."
              : "A brief intermission."}
        </h2>
        <p>
          {state === "unconfigured"
            ? "Sign-in and saved changes need the workspace’s Supabase connection."
            : state === "migration_required"
              ? "The database setup is still pending. Changes won’t be saved until the reviewed migrations are applied."
              : "We couldn’t reach the catalog right now. Please try again in a moment."}
        </p>
      </div>
    </div>
  );
}
export function QuietEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="quiet-empty">
      <SearchX size={25} strokeWidth={1.4} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="button button-secondary" href={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
