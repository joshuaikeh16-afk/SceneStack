"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw,
  Download,
  Users,
  Clapperboard,
  Flag,
  LifeBuoy,
  Scale,
  Layers,
  Database,
  ListPlus,
  FilePenLine,
  Activity,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { controlModule, type ControlSection } from "@/config/control-center";
import type {
  ControlWorkspace as WorkspaceData,
} from "@/types/control";
import {
  controlFetch,
  dateLabel,
  rowText,
} from "@/lib/control/client";
import { useControlIdentity } from "./shell";
import { DataTable, Empty, Pager, QueryError, Status, rowsOf } from "./ui";
import { GrowthChart, Distribution } from "./charts";
import { CaseWorkspace } from "./case-workspace";
import { TeamWorkspace } from "./team-workspace";
import { CatalogWorkspace, TitleEditor } from "./catalog-workspace";
import { UserWorkspace } from "./user-workspace";
import { OperationsWorkspace } from "./operations-workspace";
import { DocumentWorkspace } from "./document-workspace";

const descriptions: Record<ControlSection, string> = {
  overview: "A clear view of the platform and the work that needs attention.",
  "action-center":
    "One operational inbox for review, requests, support, and automated flags.",
  analytics:
    "Aggregated platform measurements, with recorded history and explicit definitions.",
  users: "Public account information and relevant moderation history.",
  reports:
    "Investigate written reports, preserve context, and protect reporter confidentiality.",
  collections:
    "Review published collections. Personal collections remain private.",
  appeals:
    "Review disciplinary decisions and preserve essential member access.",
  support:
    "Private support conversations, assignments, and response templates.",
  catalog:
    "Canonical titles, source mappings, manual metadata, and protected corrections.",
  "title-requests":
    "Review community demand and fulfill requests with real published titles.",
  corrections: "Compare proposed metadata and decide each field independently.",
  duplicates:
    "Review candidate identities and preserve existing user references.",
  "content-studio":
    "Curate Home and publish helpful articles without a redeploy.",
  synchronization:
    "Resumable, bounded catalog jobs and permission-aware schedules.",
  providers: "Integration switches, attribution, and current permission gates.",
  health:
    "Observed service checks and timestamps; missing measurements remain unknown.",
  jobs: "Durable background work, execution leases, checkpoints, and retry history.",
  announcements: "Draft, schedule, publish, and expire platform notices.",
  team: "One platform owner and five transactionally managed moderator positions.",
  audit: "Immutable administrative history and documented decisions.",
  settings: "Audited platform configuration with server-side enforcement.",
};
const caseSections = [
  "action-center",
  "reports",
  "appeals",
  "support",
  "title-requests",
  "corrections",
];
function exportData(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `scenestack-${name}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ControlWorkspace({
  section,
  detailId,
}: {
  section: ControlSection;
  detailId?: string;
}) {
  const identity = useControlIdentity();
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const q = params.get("q") || "",
    status = params.get("status") || "",
    assignment = params.get("assignment") || "",
    from = params.get("from") || "",
    to = params.get("to") || "";
  const rawPage = Number(params.get("page") || 1);
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 10000 ? rawPage : 1;
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSearch(q));
    return () => cancelAnimationFrame(frame);
  }, [q]);
  function change(values: Record<string, string | number>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, String(value));
      else next.delete(key);
    }
    if (!("page" in values)) next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }
  const view = params.get("view");
  const dataSection =
    section === "content-studio" && view === "help"
      ? "help"
      : section === "support" && view === "templates"
        ? "templates"
        : section;
  const query = useQuery({
    queryKey: [
      "control",
      identity.userId,
      dataSection,
      q,
      status,
      page,
      from,
      to,
      assignment,
    ],
    enabled: !detailId,
    queryFn: ({ signal }) =>
      controlFetch<WorkspaceData>(
        "workspace",
        { section: dataSection, q, status, page, from, to, assignment },
        signal,
      ),
    retry: 1,
  });
  if (detailId) {
    if (caseSections.includes(section))
      return (
        <CaseWorkspace key={detailId} id={detailId} role={identity.role} />
      );
    if (section === "users")
      return <UserWorkspace key={detailId} id={detailId} />;
    if (section === "catalog")
      return <TitleEditor key={detailId} id={detailId} />;
  }
  const dateRange = () => (
    <div className="cc-toolbar">
      <select
        aria-label="Reporting date range"
        defaultValue="custom"
        onChange={(event) => {
          if (event.target.value !== "custom") {
            const end = new Date(),
              start = new Date();
            start.setUTCDate(end.getUTCDate() - Number(event.target.value) + 1);
            change({
              from: start.toISOString().slice(0, 10),
              to: end.toISOString().slice(0, 10),
            });
          }
        }}
      >
        <option value="1">Today</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="custom">Custom / current range</option>
      </select>
      <input
        type="date"
        aria-label="Start date"
        value={from}
        max={to || undefined}
        onChange={(event) => change({ from: event.target.value })}
      />
      <input
        type="date"
        aria-label="End date"
        value={to}
        min={from || undefined}
        onChange={(event) => change({ to: event.target.value })}
      />
    </div>
  );
  return (
    <>
      <div className="cc-page-heading">
        <div>
          <h1>{controlModule(section)?.label}</h1>
          <p>{descriptions[section]}</p>
        </div>
        <div className="cc-actions">
          {["analytics", "audit"].includes(section) && query.data && (
            <button
              className="cc-button"
              onClick={() => exportData(query.data, section)}
            >
              <Download size={14} />
              Export {section === "audit" ? "this page" : "metrics"}
            </button>
          )}
          <button
            className="cc-button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw size={14} className={query.isFetching ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>
      {["overview", "analytics"].includes(section)
        ? dateRange()
        : !["team", "health", "settings", "providers"].includes(section) && (
            <form
              className="cc-toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                change({ q: search });
              }}
            >
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={120}
                placeholder={`Search ${controlModule(section)?.label.toLowerCase()}…`}
                aria-label="Search current workspace"
              />
              <button className="cc-button">Search</button>
              <select
                aria-label="Filter status or category"
                value={status}
                onChange={(event) => change({ status: event.target.value })}
              >
                <option value="">
                  All statuses{section === "catalog" ? " / categories" : ""}
                </option>
                {filterOptions(section).map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              {caseSections.includes(section) && (
                <select
                  aria-label="Case assignment"
                  value={assignment}
                  onChange={(event) =>
                    change({ assignment: event.target.value })
                  }
                >
                  <option value="">All assignments</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="mine">Assigned to me</option>
                </select>
              )}
            </form>
          )}
      {query.isPending ? (
        <div
          className="cc-skeleton"
          role="status"
          aria-label="Loading workspace"
        />
      ) : query.isError ? (
        <QueryError
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        query.data && (
          <>
            {["overview", "analytics"].includes(section) ? (
              <Overview data={query.data} analytics={section === "analytics"} />
            ) : section === "team" ? (
              <TeamWorkspace data={query.data} />
            ) : section === "catalog" ? (
              <CatalogWorkspace data={query.data} />
            ) : ["content-studio", "announcements"].includes(section) ? (
              <DocumentWorkspace
                data={query.data}
                kind={
                  dataSection === "help"
                    ? "help"
                    : section === "announcements"
                      ? "announcement"
                      : "editorial"
                }
              />
            ) : section === "support" && view === "templates" ? (
              <DocumentWorkspace data={query.data} kind="template" />
            ) : caseSections.includes(section) ? (
              <DataTable
                rows={query.data.rows}
                columns={[
                  {
                    key: "subject",
                    label: "Case",
                    render: (row) => (
                      <Link href={`/admin/${section}/${rowText(row, "id")}`}>
                        <strong>{rowText(row, "subject")}</strong>
                        <small>
                          {rowText(row, "id").slice(0, 8).toUpperCase()} ·{" "}
                          {rowText(row, "kind").replaceAll("_", " ")}
                        </small>
                      </Link>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => <Status value={row.status} />,
                  },
                  {
                    key: "priority",
                    label: "Priority",
                    render: (row) => <Status value={row.priority} />,
                  },
                  {
                    key: "assigned_to",
                    label: "Assignment",
                    render: (row) =>
                      row.assigned_to === identity.userId
                        ? "You"
                        : row.assigned_to
                          ? "Assigned"
                          : "Unassigned",
                  },
                  {
                    key: "created_at",
                    label: "Opened",
                    render: (row) => dateLabel(row.created_at),
                  },
                  {
                    key: "actions",
                    label: "",
                    render: (row) => (
                      <Link
                        className="cc-button"
                        href={`/admin/${section}/${rowText(row, "id")}`}
                      >
                        Open
                        <ArrowUpRight size={12} />
                      </Link>
                    ),
                  },
                ]}
              />
            ) : section === "users" ? (
              <DataTable
                rows={query.data.rows}
                columns={[
                  {
                    key: "display_name",
                    label: "Member",
                    render: (row) => (
                      <Link href={`/admin/users/${rowText(row, "id")}`}>
                        <strong>{rowText(row, "display_name")}</strong>
                        <small>@{rowText(row, "username", "not set")}</small>
                      </Link>
                    ),
                  },
                  {
                    key: "status",
                    label: "Account",
                    render: (row) => <Status value={row.status} />,
                  },
                  {
                    key: "verified_at",
                    label: "Verified",
                    render: (row) => (row.verified_at ? "Verified" : "—"),
                  },
                  {
                    key: "admin_role",
                    label: "Role",
                    render: (row) =>
                      rowText(row, "admin_role", "Member").replaceAll("_", " "),
                  },
                  { key: "public_collections", label: "Public collections" },
                  {
                    key: "created_at",
                    label: "Registered",
                    render: (row) => dateLabel(row.created_at),
                  },
                ]}
              />
            ) : (
              <OperationsWorkspace
                section={section}
                data={query.data}
                detailId={detailId}
              />
            )}
            {section === "support" && (
              <div className="cc-tab-strip" style={{ marginTop: 16 }}>
                <Link
                  className={view !== "templates" ? "active" : ""}
                  href="/admin/support"
                >
                  Tickets
                </Link>
                <Link
                  className={view === "templates" ? "active" : ""}
                  href="/admin/support?view=templates"
                >
                  Response templates
                </Link>
              </div>
            )}
            {![
              "overview",
              "analytics",
              "team",
              "settings",
              "health",
              "providers",
            ].includes(section) && (
              <Pager
                page={page}
                total={query.data.total}
                hasMore={query.data.hasMore}
                onPage={(page) => change({ page })}
              />
            )}
            <p className="cc-small cc-muted" style={{ marginTop: 20 }}>
              Database checked {dateLabel(query.data.checkedAt)}. Access is
              revalidated on each request.
            </p>
          </>
        )
      )}
    </>
  );
}
function filterOptions(section: string) {
  if (section === "users")
    return [
      "active",
      "suspended",
      "banned",
      "verified",
      "restricted",
      "administrators",
    ];
  if (section === "catalog")
    return [
      "movie",
      "anime",
      "series",
      "cartoon",
      "drama",
      "documentary",
      "unavailable",
      "merged",
    ];
  if (section === "collections") return ["published", "hidden"];
  if (["jobs", "synchronization"].includes(section))
    return ["queued", "running", "paused", "failed", "completed", "cancelled"];
  if (section === "audit") return ["success", "failure"];
  if (["content-studio", "announcements"].includes(section))
    return ["draft", "published", "withdrawn"];
  return [
    "submitted",
    "under_review",
    "awaiting_information",
    "open",
    "assigned",
    "in_progress",
    "awaiting_user",
    "approved_pending_publication",
    "fulfilled",
    "resolved",
    "dismissed",
    "accepted",
    "partially_accepted",
    "rejected",
    "withdrawn",
    "reopened",
    "closed",
    "merged",
  ];
}
const metricLabels: Record<string, { label: string; icon: typeof Users }> = {
  titles: { label: "Canonical titles", icon: Clapperboard },
  users: { label: "Registered accounts", icon: Users },
  activeUsers: { label: "Active accounts in range", icon: Activity },
  publicCollections: { label: "Published collections", icon: Layers },
  pendingReports: { label: "Pending reports", icon: Flag },
  pendingRequests: { label: "Pending title requests", icon: ListPlus },
  pendingCorrections: { label: "Pending corrections", icon: FilePenLine },
  openSupport: { label: "Open support tickets", icon: LifeBuoy },
  pendingAppeals: { label: "Pending appeals", icon: Scale },
  activeJobs: { label: "Active ingestion jobs", icon: Database },
  importedToday: { label: "Titles added today", icon: Clapperboard },
  failedJobs: { label: "Failed jobs", icon: AlertTriangle },
};
function Overview({
  data,
  analytics,
}: {
  data: WorkspaceData;
  analytics: boolean;
}) {
  const identity = useControlIdentity();
  return (
    <>
      <div className="cc-metric-grid">
        {Object.entries(data.metrics).map(([key, value]) => {
          const definition = metricLabels[key];
          if (!definition) return null;
          const Icon = definition.icon;
          return (
            <article className="cc-metric" key={key}>
              <div>
                <span>{definition.label}</span>
                <Icon size={15} />
              </div>
              <strong>
                {typeof value === "number"
                  ? value.toLocaleString()
                  : "Unavailable"}
              </strong>
              <small>Database measurement</small>
            </article>
          );
        })}
      </div>
      {identity.role === "super_admin" && (
        <>
          <div className="cc-chart-grid">
            <section className="cc-panel">
              <h2>Account & catalog growth</h2>
              <GrowthChart rows={rowsOf(data.series.growth)} />
            </section>
            <section className="cc-panel">
              <h2>Catalog categories</h2>
              <Distribution rows={rowsOf(data.series.categories)} />
            </section>
          </div>
          {analytics && (
            <div className="cc-chart-grid">
              <section className="cc-panel">
                <h2>Recorded engagement snapshots</h2>
                {rowsOf(data.series.engagement).length ? (
                  <DataTable
                    rows={rowsOf(data.series.engagement)}
                    columns={[
                      { key: "day", label: "Date" },
                      { key: "collection_favorites", label: "Favorites" },
                      { key: "collection_saves", label: "Saves" },
                      { key: "collection_imports", label: "Imports" },
                    ]}
                  />
                ) : (
                  <Empty
                    title="No historical snapshots yet"
                    description="The bounded scheduled worker records daily aggregate measurements. Earlier history is unavailable."
                  />
                )}
              </section>
              <section className="cc-panel">
                <h2>Search trends</h2>
                <DataTable
                  rows={rowsOf(data.series.searches)}
                  columns={[
                    { key: "query", label: "Title search" },
                    { key: "searches", label: "Requests" },
                    { key: "no_results", label: "No results" },
                  ]}
                />
              </section>
            </div>
          )}
          <div className="cc-chart-grid">
            <section className="cc-panel">
              <h2>Moderation & support workload</h2>
              <Distribution
                rows={rowsOf(data.series.workload).map((row) => ({
                  ...row,
                  label: `${rowText(row, "kind")} · ${rowText(row, "status")}`,
                }))}
                label="label"
              />
            </section>
            <section className="cc-panel">
              <h2>Operational shortcuts</h2>
              <div className="cc-stack">
                <Link
                  className="cc-button"
                  href="/admin/action-center?assignment=unassigned"
                >
                  Review unassigned work
                  <ArrowUpRight size={14} />
                </Link>
                <Link className="cc-button" href="/admin/synchronization">
                  Catalog synchronization
                  <ArrowUpRight size={14} />
                </Link>
                <Link className="cc-button" href="/admin/health">
                  Check system health
                  <ArrowUpRight size={14} />
                </Link>
                <Link className="cc-button" href="/admin/team">
                  Manage the team
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </section>
          </div>
        </>
      )}
      <section className="cc-panel">
        <h2>Recent administrative activity</h2>
        <DataTable
          rows={data.rows}
          columns={[
            {
              key: "action",
              label: "Action",
              render: (row) => rowText(row, "action").replaceAll("_", " "),
            },
            { key: "entity_type", label: "Resource" },
            {
              key: "actor_role",
              label: "Role",
              render: (row) => rowText(row, "actor_role").replaceAll("_", " "),
            },
            {
              key: "created_at",
              label: "Time",
              render: (row) => dateLabel(row.created_at),
            },
          ]}
        />
      </section>
      <p className="cc-small cc-muted" style={{ marginTop: 16 }}>
        Growth uses account/title creation dates. Active accounts count distinct
        authenticated platform days within the selected range; tracking history
        is not used. Engagement snapshots begin only when the scheduler runs.
        Historical growth percentages and retention are unavailable until
        sufficient comparable observations exist.
      </p>
    </>
  );
}
