"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Inbox,
  ChartNoAxesCombined,
  Users,
  Flag,
  Layers,
  Scale,
  LifeBuoy,
  Clapperboard,
  ListPlus,
  FilePenLine,
  CopyCheck,
  PanelsTopLeft,
  RefreshCw,
  Plug,
  Activity,
  Workflow,
  Megaphone,
  ShieldCheck,
  ScrollText,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Menu,
  Search,
  Bell,
  ArrowUpRight,
  LogOut,
  Command,
} from "lucide-react";
import {
  controlGroups,
  controlModule,
  controlModules,
} from "@/config/control-center";
import type { ControlIdentity } from "@/lib/control/runtime";
import { controlFetch, rowText } from "@/lib/control/client";
import type { ControlRow, ControlWorkspace } from "@/types/control";
import { ProductDialog } from "@/components/product/dialog";
import { signOut } from "@/lib/auth/actions";

const icons = {
  LayoutDashboard,
  Inbox,
  ChartNoAxesCombined,
  Users,
  Flag,
  Layers,
  Scale,
  LifeBuoy,
  Clapperboard,
  ListPlus,
  FilePenLine,
  CopyCheck,
  PanelsTopLeft,
  RefreshCw,
  Plug,
  Activity,
  Workflow,
  Megaphone,
  ShieldCheck,
  ScrollText,
  Settings2,
};
const ControlContext = createContext<ControlIdentity | null>(null);
export function useControlIdentity() {
  const identity = useContext(ControlContext);
  if (!identity) throw new Error("Control Center identity is missing.");
  return identity;
}
export function ControlShell({
  identity,
  name,
  children,
}: {
  identity: ControlIdentity;
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeModule = controlModule(pathname.split("/")[2] || "overview");
  const [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    [palette, setPalette] = useState(false),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [closedGroups, setClosedGroups] = useState<string[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setCollapsed(
          localStorage.getItem("scenestack:control-sidebar") === "collapsed",
        );
        const groups = JSON.parse(
          localStorage.getItem("scenestack:control-groups") || "[]",
        );
        if (Array.isArray(groups))
          setClosedGroups(
            groups.filter((g): g is string => typeof g === "string"),
          );
      } catch {}
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((p) => !p);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const summary = useQuery({
    queryKey: ["control-summary", identity.userId],
    queryFn: ({ signal }) =>
      controlFetch<ControlWorkspace>(
        "workspace",
        { section: "overview" },
        signal,
      ),
    staleTime: 30000,
  });
  const results = useQuery({
    queryKey: ["control-search", identity.userId, debounced],
    enabled: palette && debounced.length >= 2,
    queryFn: ({ signal }) =>
      controlFetch<ControlRow[]>("search", { q: debounced }, signal),
  });
  function toggleCollapse() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(
          "scenestack:control-sidebar",
          value ? "expanded" : "collapsed",
        );
      } catch {}
      return !value;
    });
  }
  function toggleGroup(label: string) {
    setClosedGroups((values) => {
      const next = values.includes(label)
        ? values.filter((v) => v !== label)
        : [...values, label];
      try {
        localStorage.setItem("scenestack:control-groups", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  const counts: Record<string, string> = {
    reports: "pendingReports",
    appeals: "pendingAppeals",
    support: "openSupport",
    "title-requests": "pendingRequests",
    corrections: "pendingCorrections",
  };
  const navigation = (mobile = false) => (
    <>
      <Link className="cc-brand" href="/admin" onClick={() => setDrawer(false)}>
        <Clapperboard size={22} />
        <span>
          SceneStack<small>Control Center</small>
        </span>
      </Link>
      <div className="cc-sidebar-role">
        <span className="cc-live-dot" />
        <span>
          {identity.role === "super_admin" ? "Super Admin" : "Moderator"}
        </span>
      </div>
      <nav aria-label="Administration navigation" className="cc-sidebar-nav">
        {controlGroups.map((group) => {
          const items = group.items.filter(
            (item) => identity.role === "super_admin" || item.moderator,
          );
          if (!items.length) return null;
          const expanded =
            !closedGroups.includes(group.label) || (!mobile && collapsed);
          return (
            <div className="cc-nav-group" key={group.label}>
              <button
                className="cc-group-label"
                aria-expanded={expanded}
                onClick={() => toggleGroup(group.label)}
              >
                <span>{group.label}</span>
                <ChevronDown size={12} />
              </button>
              {expanded && (
                <ul>
                  {items.map((item) => {
                    const Icon = icons[item.icon];
                    const count = summary.data?.metrics[counts[item.slug]];
                    return (
                      <li key={item.slug}>
                        <Link
                          href={`/admin/${item.slug}`}
                          onClick={() => setDrawer(false)}
                          className={
                            activeModule?.slug === item.slug
                              ? "cc-nav-item active"
                              : "cc-nav-item"
                          }
                          aria-current={
                            activeModule?.slug === item.slug
                              ? "page"
                              : undefined
                          }
                          title={collapsed ? item.label : undefined}
                        >
                          <Icon size={17} />
                          <span>{item.label}</span>
                          {typeof count === "number" && count > 0 && (
                            <b>{count}</b>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="cc-sidebar-bottom">
        <Link href="/">
          <ArrowUpRight size={16} />
          <span>Return to SceneStack</span>
        </Link>
        <form action={signOut}>
          <button>
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </form>
        {!mobile && (
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
            <span>Collapse sidebar</span>
          </button>
        )}
      </div>
    </>
  );
  return (
    <ControlContext.Provider value={identity}>
      <div className={`control-shell${collapsed ? " cc-collapsed" : ""}`}>
        <aside className="cc-sidebar">{navigation()}</aside>
        <div className="cc-main">
          <header className="cc-topbar">
            <button
              className="cc-icon-button cc-mobile-menu"
              onClick={() => setDrawer(true)}
              aria-label="Open administration navigation"
            >
              <Menu size={20} />
            </button>
            <div className="cc-breadcrumb">
              <Link href="/admin">Workspace</Link>
              <span>/</span>
              <strong>{activeModule?.label || "Control Center"}</strong>
            </div>
            <button
              className="cc-command-trigger"
              onClick={() => setPalette(true)}
            >
              <Search size={16} />
              <span>Search workspace</span>
              <kbd>⌘ K</kbd>
            </button>
            <Link
              className="cc-icon-button"
              href="/activity?tab=notifications"
              aria-label="Administrator notifications"
            >
              <Bell size={18} />
            </Link>
            <details className="cc-profile-menu">
              <summary aria-label="Administrator account">
                <span className="cc-avatar">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <ChevronDown size={12} />
              </summary>
              <div>
                <strong>{name}</strong>
                <span>
                  {identity.role === "super_admin"
                    ? "Super Admin"
                    : "Moderator"}
                </span>
                <Link href="/profile">SceneStack profile</Link>
                <Link href="/activity">My activity</Link>
                <form action={signOut}>
                  <button>
                    <LogOut size={15} /> Sign out
                  </button>
                </form>
              </div>
            </details>
          </header>
          <div className="cc-workspace">{children}</div>
        </div>
        <ProductDialog
          open={drawer}
          onOpenChange={setDrawer}
          title="Administration navigation"
          className="cc-navigation-drawer"
        >
          <div className="cc-drawer-content">{navigation(true)}</div>
        </ProductDialog>
        <ProductDialog
          open={palette}
          onOpenChange={setPalette}
          title="Search Control Center"
          className="cc-command-dialog"
        >
          <div className="cc-palette-input">
            <Search size={19} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search permitted users, cases, titles…"
              aria-label="Search administration"
            />
            <Command size={17} />
          </div>
          {debounced.length >= 2 ? (
            <div className="cc-command-results">
              {results.isPending ? (
                <p role="status">Searching…</p>
              ) : results.isError ? (
                <p className="form-error">{results.error.message}</p>
              ) : results.data?.length ? (
                results.data.map((row) => (
                  <Link
                    key={`${rowText(row, "resource")}:${rowText(row, "id")}`}
                    href={rowText(row, "href")}
                    onClick={() => setPalette(false)}
                  >
                    <span>{rowText(row, "label")}</span>
                    <small>{rowText(row, "resource")}</small>
                  </Link>
                ))
              ) : (
                <p>No matching permitted resources.</p>
              )}
            </div>
          ) : (
            <div className="cc-command-results">
              {controlModules
                .filter(
                  (item) => identity.role === "super_admin" || item.moderator,
                )
                .map((item) => (
                  <Link
                    key={item.slug}
                    href={`/admin/${item.slug}`}
                    onClick={() => setPalette(false)}
                  >
                    <span>{item.label}</span>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
            </div>
          )}
        </ProductDialog>
      </div>
    </ControlContext.Provider>
  );
}
