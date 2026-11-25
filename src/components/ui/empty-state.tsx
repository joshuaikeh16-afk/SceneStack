import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <div className="empty-copy">{children}</div>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
