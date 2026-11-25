"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, House, LibraryBig, UserRound } from "lucide-react";
import { primaryNavigation } from "@/config/site";

const icons = {
  home: House,
  compass: Compass,
  library: LibraryBig,
  profile: UserRound,
};

export function PrimaryNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      className={mobile ? "mobile-nav" : "desktop-nav"}
      aria-label={mobile ? "Mobile primary navigation" : "Primary navigation"}
    >
      {primaryNavigation.map(({ href, label, icon }) => {
        const Icon = icons[icon];
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
