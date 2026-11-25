"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Plus,
  Play,
  Pause,
  RefreshCw,
  Plug,
  Activity,
  Database,
  ShieldCheck,
} from "lucide-react";
import type { ControlSection } from "@/config/control-center";
import type { ControlRow, ControlWorkspace } from "@/types/control";
import type { CatalogDiagnostics } from "@/lib/data/catalog-diagnostics";
import {
  controlFetch,
  dateLabel,
  rowNumber,
  rowText,
} from "@/lib/control/client";
import {
  controlMutation,
  controlProviderProbe,
  controlRunCatalogBatch,
} from "@/app/actions/control";
import { useProduct, unwrap } from "@/components/product/providers";
import { useControlIdentity } from "./shell";
import {
  ActionDialog,
  DataTable,
  Empty,
  QueryError,
  SelectField,
  Status,
  TextField,
  formText,
  rowsOf,
} from "./ui";

export function OperationsWorkspace({
  section,
  data,
  detailId,
}: {
  section: ControlSection;
  data: ControlWorkspace;
  detailId?: string;
}) {
  const identity = useControlIdentity(),
    { toast } = useProduct();
  const [mode, setMode] = useState(""),
    [selected, setSelected] = useState<ControlRow | null>(null),
    [probe, setProbe] = useState<Record<string, ControlRow>>({}),
    [busy, setBusy] = useState("");
  const infrastructure = [
    "jobs",
    "synchronization",
    "providers",
    "health",
  ].includes(section);
  const providers = useQuery({
    queryKey: ["control", identity.userId, "provider-options"],
    enabled: infrastructure,
    queryFn: ({ signal }) =>
      controlFetch<ControlWorkspace>(
        "workspace",
        { section: "providers" },
        signal,
      ),
  });
  const diagnostics = useQuery({
    queryKey: ["control-diagnostics", identity.userId],
    enabled: ["providers", "health"].includes(section),
    queryFn: ({ signal }) =>
      controlFetch<CatalogDiagnostics>("diagnostics", {}, signal),
  });
  const open = (mode: string, row: ControlRow | null = null) => {
    setSelected(row);
    setMode(mode);
  };
  const jobRows = detailId
    ? data.rows.filter((row) => row.id === detailId)
    : data.rows;
  const providerOptions = rowsOf(providers.data?.rows).map((row) => ({
    value: rowText(row, "id"),
    label: `${rowText(row, "name")}${row.bulk_approved ? "" : " · bulk permission unconfirmed"}`,
  }));
  const infrastructureView = (
    <>
      <div className="cc-warning">
        Bulk ingestion requires enabled server permission flags and an approved
        database registration for each provider. Jobs run in bounded batches;
        progress and recoverable failures are recorded below.
      </div>
      <div className="cc-actions" style={{ marginBottom: 18 }}>
        <button className="cc-button primary" onClick={() => open("new_job")}>
          <Plus size={14} />
          Create bounded ingestion job
        </button>
        <button className="cc-button" onClick={() => open("schedule")}>
          <Plus size={14} />
          Configure schedule
        </button>
        <button
          className="cc-button"
          disabled={!!busy}
          onClick={async () => {
            setBusy("batch");
            try {
              const result = unwrap(await controlRunCatalogBatch());
              toast(`Batch finished: ${JSON.stringify(result)}`);
            } catch (error) {
              toast(
                error instanceof Error
                  ? error.message
                  : "The bounded batch could not run.",
                true,
              );
            } finally {
              setBusy("");
            }
          }}
        >
          <Play size={14} />
          {busy === "batch"
            ? "Processing one batch…"
            : "Run one authorized batch"}
        </button>
      </div>
      {section === "synchronization" && (
        <div className="cc-metric-grid">
          <article className="cc-metric">
            <div>
              <span>Canonical titles</span>
              <Database size={14} />
            </div>
            <strong>
              {rowNumber(data.metrics, "canonicalTitles").toLocaleString()}
            </strong>
            <small>Unique identities, merged sources excluded</small>
          </article>
          <article className="cc-metric">
            <div>
              <span>Planning target</span>
              <Activity size={14} />
            </div>
            <strong>50,000</strong>
            <small>Subject to provider permissions and capacity</small>
          </article>
          <article className="cc-metric">
            <div>
              <span>Coverage toward target</span>
              <Database size={14} />
            </div>
            <strong>
              {(
                (rowNumber(data.metrics, "canonicalTitles") / 50000) *
                100
              ).toFixed(2)}
              %
            </strong>
            <small>Actual title count divided by planning target</small>
          </article>
        </div>
      )}
      <DataTable
        rows={jobRows}
        columns={[
          {
            key: "kind",
            label: "Job",
            render: (row) => (
              <button
                className="cc-button"
                onClick={() => open("job_detail", row)}
              >
                {rowText(row, "kind")}
                <small>{rowText(row, "provider_name")}</small>
              </button>
            ),
          },
          {
            key: "state",
            label: "State",
            render: (row) => <Status value={row.state} />,
          },
          { key: "processed", label: "Processed" },
          { key: "imported", label: "Imported" },
          { key: "updated", label: "Updated" },
          { key: "skipped", label: "Duplicates" },
          { key: "failed", label: "Failed" },
          {
            key: "available_at",
            label: "Next attempt",
            render: (row) => dateLabel(row.available_at),
          },
          {
            key: "controls",
            label: "Controls",
            render: (row) => (
              <div className="cc-actions">
                {["running", "queued"].includes(rowText(row, "state")) && (
                  <button
                    className="cc-button"
                    onClick={() => open("pause", row)}
                  >
                    <Pause size={12} />
                    Pause
                  </button>
                )}
                {row.state === "paused" && (
                  <button
                    className="cc-button"
                    onClick={() => open("resume", row)}
                  >
                    <Play size={12} />
                    Resume
                  </button>
                )}
                {row.state === "failed" && (
                  <button
                    className="cc-button"
                    onClick={() => open("retry", row)}
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                )}
                {!["completed", "cancelled"].includes(
                  rowText(row, "state"),
                ) && (
                  <button
                    className="cc-button danger"
                    onClick={() => open("cancel", row)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      <div className="cc-chart-grid" style={{ marginTop: 20 }}>
        <section className="cc-panel">
          <h2>Synchronization schedules</h2>
          {rowsOf(data.metrics.schedules).length ? (
            rowsOf(data.metrics.schedules).map((schedule) => (
              <div
                className="cc-panel"
                style={{ marginTop: 12 }}
                key={rowText(schedule, "id")}
              >
                <strong>{rowText(schedule, "name")}</strong>
                <p className="cc-small cc-muted">
                  Every {rowText(schedule, "interval_minutes")} minutes · Next
                  due {dateLabel(schedule.next_run_at)}
                </p>
                <div className="cc-actions">
                  <Status value={schedule.enabled ? "enabled" : "disabled"} />
                  <button
                    className="cc-button"
                    onClick={() => open("schedule", schedule)}
                  >
                    Edit schedule
                  </button>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="No schedules configured"
              description="Schedules remain disabled until provider permission and an authenticated scheduler are available."
            />
          )}
        </section>
        <section className="cc-panel">
          <h2>Unresolved import failures</h2>
          <DataTable
            rows={rowsOf(data.metrics.failures)}
            columns={[
              { key: "external_id", label: "Provider ID" },
              { key: "code", label: "Error" },
              { key: "attempts", label: "Attempts" },
              {
                key: "retry",
                label: "",
                render: (row) => (
                  <button
                    className="cc-button"
                    onClick={() => open("retry_records", row)}
                  >
                    Queue retry
                  </button>
                ),
              },
            ]}
          />
        </section>
      </div>
      <p className="cc-form-note">
        Jobs use two-minute execution leases, bounded batches, persisted
        checkpoints, and backoff. Hourly schedules require a scheduler capable
        of invoking the protected worker that often. Existing metadata refresh
        and account lifecycle workers remain separate; irreversible account
        purge is still gated.
      </p>
    </>
  );
  const providerView = (
    <>
      {providers.isError && (
        <QueryError
          message={providers.error.message}
          retry={() => void providers.refetch()}
        />
      )}
      <div className="cc-chart-grid">
        {data.rows.map((row) => {
          const runtime = diagnostics.data?.providers.find(
            (provider) => provider.key === row.key,
          );
          const lastError = runtime?.errors.at(-1);
          const lastSuccess = runtime?.lastSuccess;
          const observation = probe[rowText(row, "key")];
          const observedStatus =
            observation?.status ??
            (!runtime?.environmentEnabled
              ? "disabled"
              : lastError &&
                  (!lastSuccess ||
                    Date.parse(lastError.at) > Date.parse(lastSuccess))
                ? "degraded"
                : lastSuccess &&
                    Date.parse(data.checkedAt) - Date.parse(lastSuccess) <
                      300000
                  ? "operational"
                  : "unknown");
          return (
            <section className="cc-panel" key={rowText(row, "id")}>
              <div className="cc-panel-header">
                <h2>
                  <Plug
                    size={16}
                    style={{ display: "inline", marginRight: 7 }}
                  />
                  {rowText(row, "name")}
                </h2>
                <Status value={observedStatus} />
              </div>
              <dl className="cc-detail-facts">
                <dt>DB registration</dt>
                <dd>
                  {row.enabled ? "Enabled" : "Disabled"} ·{" "}
                  {row.approved
                    ? "Local registration approved"
                    : "Not approved"}
                </dd>
                <dt>Production release</dt>
                <dd>
                  {runtime?.publicReleaseApproved
                    ? "Operator-confirmed flag"
                    : "Unconfirmed · production blocked"}
                </dd>
                <dt>Bulk use</dt>
                <dd>
                  {row.bulk_approved
                    ? "Database confirmation recorded"
                    : "Unconfirmed"}
                </dd>
                <dt>Credential</dt>
                <dd>
                  {runtime?.credentialConfigured
                    ? "Configured · value hidden"
                    : "Not configured / unavailable"}
                </dd>
                <dt>Last success</dt>
                <dd>{dateLabel(lastSuccess)}</dd>
                <dt>Last probe</dt>
                <dd>
                  {dateLabel(observation?.checkedAt)}
                  {typeof observation?.responseMs === "number"
                    ? ` · ${observation.responseMs} ms`
                    : ""}
                </dd>
              </dl>
              <p className="cc-form-note" style={{ marginTop: 15 }}>
                {rowText(row, "attribution", "")}
              </p>
              {typeof row.terms_url === "string" &&
                /^https:\/\//.test(row.terms_url) && (
                  <a
                    href={row.terms_url}
                    rel="noreferrer"
                    target="_blank"
                    className="cc-small"
                  >
                    Provider terms ↗
                  </a>
                )}
              <div className="cc-actions" style={{ marginTop: 16 }}>
                <button
                  className="cc-button"
                  onClick={() => open("provider", row)}
                >
                  {row.enabled ? "Disable registration" : "Review enablement"}
                </button>
                <button
                  className="cc-button"
                  disabled={!!busy || !runtime?.environmentEnabled}
                  onClick={async () => {
                    setBusy(rowText(row, "key"));
                    try {
                      const result = unwrap(
                        await controlProviderProbe(row.key),
                      );
                      setProbe((previous) => ({
                        ...previous,
                        [rowText(row, "key")]: result,
                      }));
                      await diagnostics.refetch();
                    } catch (error) {
                      toast(
                        error instanceof Error
                          ? error.message
                          : "Provider check failed.",
                        true,
                      );
                      setProbe((previous) => ({
                        ...previous,
                        [rowText(row, "key")]: {
                          status: "unavailable",
                          checkedAt: new Date().toISOString(),
                        },
                      }));
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {busy === row.key ? "Checking…" : "Check actual response"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <p className="cc-form-note">
        A configured credential is not an operational health check or a license
        approval. Public-release and bulk-use permission flags are managed in
        trusted server configuration, not granted by these switches.
      </p>
    </>
  );
  return (
    <>
      {["jobs", "synchronization"].includes(section) ? (
        infrastructureView
      ) : section === "providers" ? (
        providerView
      ) : section === "health" ? (
        <>
          <div className="cc-chart-grid">
            <section className="cc-panel">
              <div className="cc-panel-header">
                <h2>
                  <Database
                    size={16}
                    style={{ display: "inline", marginRight: 7 }}
                  />
                  Database
                </h2>
                <Status
                  value={
                    data.metrics.database &&
                    typeof data.metrics.database === "object"
                      ? (data.metrics.database as ControlRow).status
                      : "unknown"
                  }
                />
              </div>
              <p className="cc-small cc-muted">
                The workspace RPC completed against PostgreSQL at{" "}
                {dateLabel(data.checkedAt)}.
              </p>
            </section>
            <section className="cc-panel">
              <div className="cc-panel-header">
                <h2>
                  <ShieldCheck
                    size={16}
                    style={{ display: "inline", marginRight: 7 }}
                  />
                  Current admin session
                </h2>
                <Status value="verified" />
              </div>
              <p className="cc-small cc-muted">
                Supabase Auth verified this request, and the database rechecked
                your role. This does not measure platform-wide authentication
                availability.
              </p>
            </section>
            <section className="cc-panel">
              <h2>Capacity & Storage</h2>
              <Status value="unknown" />
              <p className="cc-form-note" style={{ marginTop: 12 }}>
                No plan capacity or Storage usage API is connected. Values are
                unavailable.
              </p>
            </section>
            <section className="cc-panel">
              <h2>Scheduler observation</h2>
              <p className="cc-small">
                Last daily snapshot:{" "}
                {dateLabel(data.metrics.schedulerLastMetricCapture)}
              </p>
              <p className="cc-form-note">
                A missing timestamp means no successful scheduled snapshot has
                been recorded.
              </p>
            </section>
          </div>
          {diagnostics.isError ? (
            <QueryError
              message={diagnostics.error.message}
              retry={() => void diagnostics.refetch()}
            />
          ) : (
            diagnostics.data && (
              <div className="cc-chart-grid">
                {diagnostics.data.providers.map((provider) => (
                  <section className="cc-panel" key={provider.key}>
                    <h2>{provider.key} request diagnostics</h2>
                    <p className="cc-small cc-muted">
                      Last success: {dateLabel(provider.lastSuccess)}
                    </p>
                    <p className="cc-small">
                      {provider.requests} requests · {provider.hits} cache hits
                      · {provider.misses} misses · {provider.paginationFailures}{" "}
                      pagination failures
                    </p>
                    {provider.errors.length ? (
                      <DataTable
                        rows={provider.errors}
                        columns={[
                          { key: "operation", label: "Operation" },
                          { key: "code", label: "Error" },
                          {
                            key: "at",
                            label: "Time",
                            render: (row) => dateLabel(row.at),
                          },
                        ]}
                      />
                    ) : (
                      <p className="cc-small cc-muted">
                        No request errors recorded on this instance.
                      </p>
                    )}
                  </section>
                ))}
              </div>
            )
          )}
          <section className="cc-panel">
            <h2>Cache observation</h2>
            {diagnostics.data ? (
              <>
                <p>
                  {diagnostics.data.cache.entries} cached responses ·{" "}
                  {Math.round(diagnostics.data.cache.bytes / 1024)} KiB ·{" "}
                  {diagnostics.data.cache.pending} in flight
                </p>
                <p className="cc-form-note">{diagnostics.data.scope}</p>
              </>
            ) : (
              <p className="cc-muted">
                Cache diagnostics are unavailable until the request succeeds.
              </p>
            )}
          </section>
        </>
      ) : section === "settings" ? (
        <section className="cc-panel">
          <h2>Current platform configuration</h2>
          <dl className="cc-detail-facts">
            {Object.entries(data.metrics).map(([key, value]) => (
              <div key={key} style={{ display: "contents" }}>
                <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                <dd>
                  {typeof value === "boolean"
                    ? value
                      ? "Enabled"
                      : "Disabled"
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
          <button
            className="cc-button primary"
            style={{ marginTop: 20 }}
            onClick={() => open("settings")}
          >
            Review settings change
          </button>
          <p className="cc-form-note" style={{ marginTop: 16 }}>
            Maintenance blocks ordinary data mutations. Authorized
            administrators, essential support, appeals, and account rights
            remain accessible. Provider secrets are never stored in this
            settings record.
          </p>
        </section>
      ) : section === "collections" ? (
        <DataTable
          rows={data.rows}
          columns={[
            {
              key: "title",
              label: "Public collection",
              render: (row) => (
                <Link href={`/collections/${rowText(row, "id")}`}>
                  {rowText(row, "title")}
                  <small>@{rowText(row, "creator")}</small>
                </Link>
              ),
            },
            { key: "title_count", label: "Titles" },
            { key: "favorites", label: "Favorites" },
            { key: "saves", label: "Saves" },
            { key: "imports", label: "Imports" },
            { key: "reports", label: "Reports" },
            {
              key: "removed_at",
              label: "Moderation",
              render: (row) => (
                <Status value={row.removed_at ? "hidden" : "published"} />
              ),
            },
            {
              key: "actions",
              label: "",
              render: (row) => (
                <button
                  className="cc-button"
                  onClick={() => open("collection", row)}
                >
                  {row.removed_at ? "Restore" : "Hide"}
                </button>
              ),
            },
          ]}
        />
      ) : section === "duplicates" ? (
        <>
          <div className="cc-actions" style={{ marginBottom: 18 }}>
            <button className="cc-button" onClick={() => open("merge")}>
              Review explicit title pair
            </button>
          </div>
          <h2>Possible duplicate identities</h2>
          <p className="cc-form-note">
            Similar name, category, and year suggest review only. Provider IDs
            and actual work identity must be checked before a merge.
          </p>
          <DataTable
            rows={rowsOf(data.metrics.candidates)}
            columns={[
              { key: "display_title", label: "Shared title" },
              { key: "kind", label: "Category" },
              { key: "release_year", label: "Year" },
              {
                key: "review",
                label: "",
                render: (row) => (
                  <button
                    className="cc-button"
                    onClick={() => open("merge", row)}
                  >
                    Review pair
                  </button>
                ),
              },
            ]}
          />
          <h2 style={{ marginTop: 24 }}>Merge review history</h2>
          <DataTable
            rows={data.rows}
            columns={[
              { key: "source_title", label: "Source" },
              { key: "target_title", label: "Canonical target" },
              {
                key: "status",
                label: "Review",
                render: (row) => <Status value={row.status} />,
              },
              { key: "reason", label: "Reason" },
            ]}
          />
        </>
      ) : section === "audit" ? (
        <DataTable
          rows={data.rows}
          columns={[
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <button
                  className="cc-button"
                  onClick={() => open("audit", row)}
                >
                  {rowText(row, "action").replaceAll("_", " ")}
                </button>
              ),
            },
            {
              key: "actor_id",
              label: "Administrator",
              render: (row) => (
                <span>
                  {rowText(row, "actor_role").replaceAll("_", " ")}
                  <small>{rowText(row, "actor_id")}</small>
                </span>
              ),
            },
            { key: "entity_type", label: "Resource" },
            { key: "reason", label: "Reason" },
            {
              key: "outcome",
              label: "Outcome",
              render: (row) => <Status value={row.outcome} />,
            },
            {
              key: "created_at",
              label: "Time",
              render: (row) => dateLabel(row.created_at),
            },
          ]}
        />
      ) : (
        <Empty title="No records available" />
      )}
      <ActionDialog
        key={mode + rowText(selected ?? {}, "id")}
        noSubmit={["audit", "job_detail"].includes(mode)}
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) setMode("");
        }}
        title={
          mode === "new_job"
            ? "Create resumable catalog job"
            : mode === "schedule"
              ? "Configure synchronization schedule"
              : mode === "job_detail"
                ? "Job execution details"
                : mode === "settings"
                  ? "Review platform settings"
                  : mode === "merge"
                    ? "Review canonical title merge"
                    : mode === "provider"
                      ? "Review provider registration"
                      : mode === "collection"
                        ? "Review public collection moderation"
                        : mode === "audit"
                          ? "Audit event"
                          : `${mode.replaceAll("_", " ")} catalog job`
        }
        danger={["cancel", "merge", "collection", "settings"].includes(mode)}
        submit={async (form) => {
          const reason = formText(form, "reason");
          if (mode === "settings")
            return controlMutation({
              operation: "settings",
              reason,
              values: {
                maintenance: form.get("maintenance") === "on",
                registration: form.get("registration") === "on",
                community: form.get("community") === "on",
                ingestionBatchSize: Number(formText(form, "batch")),
                requestsPerMinute: Number(formText(form, "rate")),
                supportWelcome: formText(form, "welcome"),
              },
            });
          if (mode === "collection")
            return controlMutation({
              operation: "collection",
              id: rowText(selected ?? {}, "id"),
              hidden: !selected?.removed_at,
              reason,
            });
          if (mode === "provider")
            return controlMutation({
              operation: "provider",
              id: rowText(selected ?? {}, "id"),
              enabled: !selected?.enabled,
              reason,
            });
          if (mode === "merge")
            return controlMutation({
              operation: "merge",
              sourceId: formText(form, "source"),
              targetId: formText(form, "target"),
              reason,
            });
          if (mode === "retry_records")
            return controlMutation({
              operation: "retry_failures",
              id: rowText(selected ?? {}, "job_id"),
              reason,
            });
          const query = {
            category: formText(form, "category"),
            yearStart: Number(formText(form, "start")),
            yearEnd: Number(formText(form, "end")),
          };
          if (mode === "schedule")
            return controlMutation({
              operation: "schedule",
              id: selected?.id ?? null,
              providerId: formText(form, "provider"),
              name: formText(form, "name"),
              kind: formText(form, "kind"),
              query,
              interval: Number(formText(form, "interval")),
              enabled: form.get("enabled") === "on",
              reason,
            });
          return controlMutation({
            operation: "job",
            id: mode === "new_job" ? null : rowText(selected ?? {}, "id"),
            action: mode === "new_job" ? "create" : mode,
            providerId: mode === "new_job" ? formText(form, "provider") : null,
            kind: mode === "new_job" ? formText(form, "kind") : "popular",
            query: mode === "new_job" ? query : {},
            reason,
          });
        }}
      >
        {mode === "settings" ? (
          <>
            <label className="cc-inline-check">
              <input
                type="checkbox"
                name="maintenance"
                defaultChecked={data.metrics.maintenance === true}
              />
              Maintenance mode
            </label>
            <label className="cc-inline-check">
              <input
                type="checkbox"
                name="registration"
                defaultChecked={data.metrics.registration !== false}
              />
              New registrations
            </label>
            <label className="cc-inline-check">
              <input
                type="checkbox"
                name="community"
                defaultChecked={data.metrics.community !== false}
              />
              Optional community interactions
            </label>
            <TextField
              label="Titles per ingestion batch (1–20)"
              name="batch"
              type="number"
              value={rowNumber(data.metrics, "ingestionBatchSize") || 10}
              required
            />
            <TextField
              label="Conservative provider request units per minute (1–90)"
              name="rate"
              type="number"
              value={rowNumber(data.metrics, "requestsPerMinute") || 30}
              required
            />
            <TextField
              label="Support welcome text"
              name="welcome"
              type="textarea"
              value={rowText(data.metrics, "supportWelcome", "")}
              maxLength={2000}
            />
            <TextField
              label="Documented change reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
          </>
        ) : mode === "new_job" || mode === "schedule" ? (
          <>
            {providerOptions.length ? (
              <SelectField
                label="Approved provider registration"
                name="provider"
                options={providerOptions}
                value={selected ? rowText(selected, "provider_id") : undefined}
              />
            ) : (
              <p className="cc-warning">
                No provider registrations are available. Complete provider
                configuration and permission review first.
              </p>
            )}
            {mode === "schedule" && (
              <TextField
                label="Schedule name"
                name="name"
                required
                value={selected ? rowText(selected, "name") : undefined}
              />
            )}
            <SelectField
              label="Job purpose"
              name="kind"
              options={
                mode === "new_job"
                  ? [
                      "initial",
                      "historical",
                      "popular",
                      "trending",
                      "recent",
                      "upcoming",
                      "refresh",
                    ]
                  : [
                      "historical",
                      "popular",
                      "trending",
                      "recent",
                      "upcoming",
                      "refresh",
                    ]
              }
              value={selected ? rowText(selected, "kind") : undefined}
            />
            <SelectField
              label="Canonical category"
              name="category"
              options={[
                "movie",
                "anime",
                "series",
                "cartoon",
                "drama",
                "documentary",
              ]}
              value={
                selected?.query &&
                typeof selected.query === "object" &&
                !Array.isArray(selected.query)
                  ? rowText(selected.query as ControlRow, "category", "movie")
                  : undefined
              }
            />
            <div className="cc-form-grid">
              <TextField
                label="First release year partition"
                name="start"
                type="number"
                required
                value={
                  selected?.query &&
                  typeof selected.query === "object" &&
                  !Array.isArray(selected.query)
                    ? rowText(selected.query as ControlRow, "yearStart")
                    : new Date(data.checkedAt).getUTCFullYear()
                }
              />
              <TextField
                label="Last release year partition"
                name="end"
                type="number"
                required
                value={
                  selected?.query &&
                  typeof selected.query === "object" &&
                  !Array.isArray(selected.query)
                    ? rowText(selected.query as ControlRow, "yearEnd")
                    : new Date(data.checkedAt).getUTCFullYear()
                }
              />
            </div>
            {mode === "schedule" && (
              <>
                <TextField
                  label="Interval in minutes (60–10080)"
                  name="interval"
                  type="number"
                  required
                  value={
                    selected ? rowText(selected, "interval_minutes") : 1440
                  }
                />
                <label className="cc-inline-check">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={selected?.enabled === true}
                  />
                  Enable after permission and scheduler configuration
                </label>
              </>
            )}
            <TextField
              label="Documented reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
            <p className="cc-form-note">
              Only bounded batches run per worker invocation. No entire catalog
              is fetched into this browser.
            </p>
          </>
        ) : mode === "merge" ? (
          <>
            <TextField
              label="Duplicate source title ID"
              name="source"
              required
              value={selected ? rowText(selected, "source_id") : undefined}
            />
            <TextField
              label="Canonical title ID to retain"
              name="target"
              required
              value={selected ? rowText(selected, "target_id") : undefined}
            />
            <p className="cc-warning">
              Review both provider identities, category, and release information
              before confirming. Existing tracking, ratings, favorites, and
              collection references are retained through canonical redirects.
            </p>
            <TextField
              label="Documented identity evidence and reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
          </>
        ) : mode === "job_detail" || mode === "audit" ? (
          <>
            <pre className="cc-json">{JSON.stringify(selected, null, 2)}</pre>
            {mode === "job_detail" && (
              <p className="cc-form-note">
                Progress counts and checkpoints are persisted by actual worker
                batches. A total or ETA is omitted when it is not known.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="cc-form-note">
              {mode === "provider"
                ? `${selected?.enabled ? "Disable" : "Enable"} this provider’s database registration? Environment and release permission gates remain authoritative.`
                : mode === "collection"
                  ? `${selected?.removed_at ? "Restore" : "Hide"} the published collection “${rowText(selected ?? {}, "title")}”? Independent imported copies retain their own identities.`
                  : mode === "retry_records"
                    ? "Create a permission-gated retry job for the recorded failed provider identities."
                    : `Confirm ${mode} for this durable catalog job? Paused and cancelled jobs reject outstanding lease completion.`}
            </p>
            <TextField
              label="Documented reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
          </>
        )}
      </ActionDialog>
    </>
  );
}
