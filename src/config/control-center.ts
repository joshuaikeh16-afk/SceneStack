export type ControlRole = "super_admin" | "moderator";
export const controlGroups = [
  {
    label: "Workspace",
    items: [
      {
        slug: "overview",
        label: "Overview",
        icon: "LayoutDashboard",
        moderator: true,
      },
      {
        slug: "action-center",
        label: "Action Center",
        icon: "Inbox",
        moderator: true,
      },
      {
        slug: "analytics",
        label: "Analytics",
        icon: "ChartNoAxesCombined",
        moderator: false,
      },
    ],
  },
  {
    label: "Community",
    items: [
      { slug: "users", label: "Users", icon: "Users", moderator: true },
      { slug: "reports", label: "Reports", icon: "Flag", moderator: true },
      {
        slug: "collections",
        label: "Collections",
        icon: "Layers",
        moderator: true,
      },
      { slug: "appeals", label: "Appeals", icon: "Scale", moderator: true },
      {
        slug: "support",
        label: "Support Center",
        icon: "LifeBuoy",
        moderator: true,
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        slug: "catalog",
        label: "Catalog",
        icon: "Clapperboard",
        moderator: false,
      },
      {
        slug: "title-requests",
        label: "Title Requests",
        icon: "ListPlus",
        moderator: false,
      },
      {
        slug: "corrections",
        label: "Metadata Corrections",
        icon: "FilePenLine",
        moderator: false,
      },
      {
        slug: "duplicates",
        label: "Duplicate Review",
        icon: "CopyCheck",
        moderator: false,
      },
      {
        slug: "content-studio",
        label: "Content Studio",
        icon: "PanelsTopLeft",
        moderator: false,
      },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      {
        slug: "synchronization",
        label: "Catalog Synchronization",
        icon: "RefreshCw",
        moderator: false,
      },
      {
        slug: "providers",
        label: "API Providers",
        icon: "Plug",
        moderator: false,
      },
      {
        slug: "health",
        label: "System Health",
        icon: "Activity",
        moderator: false,
      },
      {
        slug: "jobs",
        label: "Background Jobs",
        icon: "Workflow",
        moderator: false,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        slug: "announcements",
        label: "Announcements",
        icon: "Megaphone",
        moderator: false,
      },
      {
        slug: "team",
        label: "Team Management",
        icon: "ShieldCheck",
        moderator: false,
      },
      {
        slug: "audit",
        label: "Audit Logs",
        icon: "ScrollText",
        moderator: true,
      },
      {
        slug: "settings",
        label: "Platform Settings",
        icon: "Settings2",
        moderator: false,
      },
    ],
  },
] as const;
export type ControlModule = (typeof controlGroups)[number]["items"][number];
export const controlModules = controlGroups.flatMap<ControlModule>((group) => [
  ...group.items,
]);
export type ControlSection = (typeof controlModules)[number]["slug"];
export function controlModule(slug: string) {
  return controlModules.find((item) => item.slug === slug);
}
export function canOpenControl(role: ControlRole, slug: string) {
  const activeModule = controlModule(slug);
  return !!activeModule && (role === "super_admin" || activeModule.moderator);
}
