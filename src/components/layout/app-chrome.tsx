"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
export function AppChrome({
  children,
  header,
  footer,
  dock,
  modal,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  dock: ReactNode;
  modal: ReactNode;
}) {
  const pathname = usePathname();
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <div
      className={
        admin ? "application-frame control-frame" : "application-frame"
      }
    >
      {!admin && header}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      {!admin && footer}
      {!admin && dock}
      {modal}
    </div>
  );
}
