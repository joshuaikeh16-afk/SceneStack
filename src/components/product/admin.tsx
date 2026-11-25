"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Shield, Database, RefreshCw } from "lucide-react";
import { useProduct, fetchData, unwrap } from "./providers";
import { ProductDialog } from "./dialog";
import {
  verifyRelationship,
  saveCatalogTitle,
  reviewSubmission,
  reviewReport,
  proposeMerge,
  refreshMetadata,
  changeAdminRole,
  moderateAccount,
} from "@/app/actions/admin";
import { categories } from "@/config/categories";
import type { ActionReply } from "@/types/product";
import { Pagination } from "./catalog-browser";
import { Confirmation } from "./confirmation";
import { z } from "zod";
import { CatalogDiagnostics } from "./catalog-diagnostics";
import type { CatalogDiagnostics as Diagnostics } from "@/lib/data/catalog-diagnostics";
const rowSchema = z.record(z.string(), z.unknown());
type AdminRow = z.infer<typeof rowSchema>;
const text = (row: AdminRow, key: string) =>
  typeof row[key] === "string"
    ? (row[key] as string)
    : typeof row[key] === "number"
      ? String(row[key])
      : "";
export function AdminConsole() {
  const { bootstrap, toast, online } = useProduct();
  const superAdmin = bootstrap.roles.includes("super_admin"),
    moderator = superAdmin || bootstrap.roles.includes("moderator"),
    editor = superAdmin || bootstrap.roles.includes("catalog_editor");
  const [section, setSection] = useState("overview"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<AdminRow | null>(null),
    [mode, setMode] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{
    work: () => Promise<ActionReply<unknown>>;
    label: string;
  } | null>(null);
  const query = useQuery({
    queryKey: ["admin", bootstrap.userId, section, page, search],
    enabled: section !== "roles",
    queryFn: ({ signal }) =>
      fetchData<unknown>("admin", { section, page, q: search }, signal),
  });
  const rows = z.array(rowSchema).safeParse(query.data);
  const object = rowSchema.safeParse(query.data);
  const tabs = [
    "overview",
    ...(moderator ? ["users", "reports"] : []),
    ...(editor
      ? ["catalog", "diagnostics", "missing", "corrections", "merges", "providers"]
      : []),
    ...(superAdmin ? ["audit", "roles"] : []),
  ];
  async function execute(
    work: () => Promise<ActionReply<unknown>>,
    message = "Changes saved.",
  ) {
    setPending(true);
    setError("");
    try {
      unwrap(await work());
      await query.refetch();
      toast(message);
      setMode("");
      setSelected(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  }
  const canReview = ["reports", "missing", "corrections", "merges"].includes(
    section,
  );
  return (
    <div className="admin-layout">
      <aside className="admin-nav">
        <span>
          <Shield size={18} />
          Workspace
        </span>
        {tabs.map((tab) => (
          <button
            key={tab}
            aria-current={section === tab ? "page" : undefined}
            onClick={() => {
              setSection(tab);
              setPage(1);
              setSelected(null);
              setError("");
            }}
          >
            {tab === "missing"
              ? "Title requests"
              : tab === "merges"
                ? "Duplicate review"
                : tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </aside>
      <div className="admin-content">
        <div className="admin-toolbar">
          <h2>
            {section === "missing"
              ? "Title requests"
              : section === "merges"
                ? "Duplicate review"
                : section[0].toUpperCase() + section.slice(1)}
          </h2>
          {section === "catalog" && (
            <button
              className="button button-primary"
              onClick={() => {
                setSelected(null);
                setMode("catalog");
              }}
            >
              <Plus size={16} />
              Add title
            </button>
          )}
          {section === "merges" && (
            <button
              className="button button-secondary"
              onClick={() => setMode("merge")}
            >
              Propose merge
            </button>
          )}
        </div>
        <p className="privacy-caption">
          Administration includes public activity and moderation records.
          Private libraries, ratings, and favorites remain inaccessible.
        </p>
        {section === "roles" ? (
          <div className="settings-section">
            <h3>Platform owner controls</h3>
            <p>
              Only the immutable platform owner can grant or revoke
              database-backed roles. A server-only secret is required. OAuth
              metadata never grants a role.
            </p>
            <form
              className="product-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setConfirm({
                  label: `${f.get("grant") === "true" ? "Grant" : "Revoke"} this role?`,
                  work: () =>
                    changeAdminRole({
                      userId: f.get("userId"),
                      role: f.get("role"),
                      grant: f.get("grant") === "true",
                    }),
                });
              }}
            >
              <label>
                Member ID
                <input
                  name="userId"
                  required
                  placeholder="Canonical member UUID"
                />
              </label>
              <label>
                Role
                <select name="role">
                  <option value="moderator">Moderator</option>
                  <option value="catalog_editor">Catalog Editor</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </label>
              <label>
                Change
                <select name="grant">
                  <option value="true">Grant role</option>
                  <option value="false">Revoke role</option>
                </select>
              </label>
              <button
                className="button button-primary"
                disabled={pending || !online}
              >
                Review role change
              </button>
            </form>
          </div>
        ) : query.isPending ? (
          <p role="status">Loading workspace…</p>
        ) : query.isError ? (
          <div className="inline-error">
            <p>{query.error.message}</p>
            <button onClick={() => query.refetch()}>Try again</button>
          </div>
        ) : section === "diagnostics" && query.data ? (
          <CatalogDiagnostics data={query.data as Diagnostics} />
        ) : section === "overview" && object.success ? (
          <div className="admin-stats">
            {Object.entries(object.data).map(([name, value]) => (
              <div key={name}>
                <Database size={20} />
                <strong>{typeof value === "number" ? value : 0}</strong>
                <span>
                  {name === "publicCollections"
                    ? "Published collections"
                    : name}
                </span>
              </div>
            ))}
          </div>
        ) : section === "providers" && object.success ? (
          <div className="provider-status">
            <p>
              Provider refresh requests are queued and audited. An approved
              provider, server token, and trusted worker are required to process
              them. Cached metadata is retained on failure.
            </p>
            {["sync", "alerts"].map((group) => (
              <section key={group}>
                <h3>{group === "sync" ? "Sync state" : "Alerts"}</h3>
                {Array.isArray(object.data[group]) &&
                object.data[group].length ? (
                  object.data[group].map((raw, i) => {
                    const r = rowSchema.parse(raw);
                    return (
                      <div className="admin-record" key={i}>
                        {Object.entries(r).map(([k, v]) => (
                          <p key={k}>
                            <strong>{k.replaceAll("_", " ")}: </strong>
                            {String(v ?? "—")}
                          </p>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <p className="muted-copy">No {group} records.</p>
                )}
              </section>
            ))}
          </div>
        ) : rows.success ? (
          <>
            <div className="admin-record-list">
              {section === "users" && (
                <label className="compact-search">
                  <input
                    value={search}
                    maxLength={120}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Search members"
                    placeholder="Search public display names"
                  />
                </label>
              )}
              {rows.data.map((r, i) => (
                <article className="admin-record" key={text(r, "id") || i}>
                  <div>
                    <h3>
                      {text(r, "display_title") ||
                        text(r, "title") ||
                        text(r, "display_name") ||
                        text(r, "field_name") ||
                        text(r, "action") ||
                        text(r, "reason") ||
                        text(r, "id")}
                    </h3>
                    {[
                      "username",
                      "kind",
                      "status",
                      "description",
                      "details",
                      "proposed_value",
                      "reason",
                      "target_user_id",
                      "collection_id",
                      "title_id",
                      "source_id",
                      "target_id",
                      "entity_type",
                      "detail",
                      "created_at",
                    ].map(
                      (k) =>
                        text(r, k) && (
                          <p key={k}>
                            <strong>{k.replaceAll("_", " ")}: </strong>
                            {text(r, k)}
                          </p>
                        ),
                    )}
                  </div>
                  <div className="admin-record-actions">
                    {section === "catalog" && (
                      <>
                        <Link
                          href={`/titles/${text(r, "id")}`}
                          className="text-link"
                        >
                          View
                        </Link>
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setSelected(r);
                            setMode("catalog");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setSelected(r);
                            setMode("relationships");
                          }}
                        >
                          Link title
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Request metadata refresh"
                          onClick={() => {
                            setSelected(r);
                            setMode("refresh");
                          }}
                        >
                          <RefreshCw size={16} />
                        </button>
                      </>
                    )}
                    {canReview && text(r, "status") === "pending" && (
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          setSelected(r);
                          setMode("review");
                        }}
                      >
                        Review
                      </button>
                    )}
                    {section === "users" &&
                      text(r, "id") !== bootstrap.userId && (
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setSelected(r);
                            setMode("moderate");
                          }}
                        >
                          Moderate
                        </button>
                      )}
                  </div>
                </article>
              ))}
              {!rows.data.length && (
                <p className="muted-copy">No records in this view.</p>
              )}
            </div>
            <Pagination
              page={page}
              hasMore={rows.data.length === 24}
              onPage={setPage}
            />
          </>
        ) : null}
        <p className="form-error" role="alert">
          {error}
        </p>
      </div>
      <ProductDialog
        open={!!mode}
        onOpenChange={(v) => {
          if (!pending && !v) setMode("");
        }}
        title={
          mode === "catalog"
            ? selected
              ? "Edit canonical title"
              : "Add a catalog title"
            : mode === "relationships"
              ? "Verify a title relationship"
              : mode === "merge"
                ? "Propose a duplicate merge"
                : mode === "refresh"
                  ? "Queue a metadata refresh"
                  : mode === "moderate"
                    ? "Moderate account"
                    : "Review submission"
        }
        className="dialog-medium"
      >
        <form
          className="dialog-body product-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const id = selected ? text(selected, "id") : null;
            if (mode === "catalog")
              await execute(() =>
                saveCatalogTitle(id, {
                  displayTitle: f.get("name"),
                  originalTitle: f.get("original") || null,
                  description: f.get("description"),
                  kind: f.get("kind"),
                  releaseYear: f.get("year") ? Number(f.get("year")) : null,
                  ageRating: f.get("age") || null,
                }),
              );
            else if (mode === "relationships")
              await execute(
                () =>
                  verifyRelationship({
                    source: id,
                    related: f.get("related"),
                    relation: f.get("relation"),
                  }),
                "Verified relationship saved. The works remain separate.",
              );
            else if (mode === "merge")
              await execute(
                () =>
                  proposeMerge({
                    source: f.get("source"),
                    target: f.get("target"),
                    reason: f.get("reason"),
                  }),
                "Duplicate submitted for review. Existing user references stay intact.",
              );
            else if (mode === "refresh")
              await execute(
                () => refreshMetadata(id, f.get("provider")),
                "Refresh request queued.",
              );
            else if (mode === "moderate") {
              setConfirm({
                label: "Apply this moderation action?",
                work: () =>
                  moderateAccount({
                    userId: id,
                    action: f.get("action"),
                    reason: f.get("reason"),
                    until: f.get("until")
                      ? new Date(String(f.get("until"))).toISOString()
                      : null,
                  }),
              });
            } else if (section === "reports")
              setConfirm({
                label: "Resolve this report?",
                work: () =>
                  reviewReport({
                    reportId: id,
                    action: f.get("action"),
                    reason: f.get("reason"),
                    ...(f.get("until") && {
                      until: new Date(String(f.get("until"))).toISOString(),
                    }),
                  }),
              });
            else
              await execute(
                () =>
                  reviewSubmission({
                    kind:
                      section === "missing"
                        ? "missing"
                        : section === "corrections"
                          ? "correction"
                          : "merge",
                    id,
                    approve: f.get("decision") === "approve",
                    notes: f.get("reason"),
                    ...(f.get("resolvedTitle") && {
                      resolvedTitle: f.get("resolvedTitle"),
                    }),
                  }),
                "Review recorded.",
              );
          }}
        >
          {mode === "catalog" ? (
            <>
              <label>
                Title
                <input
                  name="name"
                  defaultValue={selected ? text(selected, "display_title") : ""}
                  required
                  maxLength={300}
                />
              </label>
              <label>
                Original title
                <input
                  name="original"
                  defaultValue={
                    selected ? text(selected, "original_title") : ""
                  }
                  maxLength={300}
                />
              </label>
              <label>
                Category
                <select
                  name="kind"
                  defaultValue={selected ? text(selected, "kind") : "movie"}
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Release year
                <input
                  name="year"
                  type="number"
                  min="1888"
                  max="2200"
                  defaultValue={selected ? text(selected, "release_year") : ""}
                />
              </label>
              <label>
                Age classification
                <input
                  name="age"
                  maxLength={40}
                  defaultValue={selected ? text(selected, "age_rating") : ""}
                />
              </label>
              <label>
                Synopsis
                <textarea
                  name="description"
                  rows={5}
                  maxLength={20000}
                  defaultValue={selected ? text(selected, "description") : ""}
                />
              </label>
            </>
          ) : mode === "relationships" ? (
            <>
              <p className="muted-copy">
                Verify a relationship from an authoritative catalog source.
                Separate works keep their own identities.
              </p>
              <label>
                Related canonical title ID
                <input name="related" required />
              </label>
              <label>
                Relationship
                <select name="relation">
                  {[
                    "sequel",
                    "prequel",
                    "spin_off",
                    "remake",
                    "adaptation",
                    "franchise",
                    "related_series",
                    "season",
                    "other",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            </>
          ) : mode === "merge" ? (
            <>
              <label>
                Duplicate title ID
                <input name="source" required />
              </label>
              <label>
                Keep canonical title ID
                <input name="target" required />
              </label>
              <label>
                Reason
                <textarea name="reason" required maxLength={3000} />
              </label>
              <p className="muted-copy">
                A merge creates a canonical redirect. Private user records are
                retained.
              </p>
            </>
          ) : mode === "refresh" ? (
            <label>
              Approved provider ID
              <input name="provider" required />
            </label>
          ) : (
            <>
              {selected && (
                <p className="review-context">
                  {text(selected, "details") ||
                    text(selected, "proposed_value") ||
                    text(selected, "reason") ||
                    text(selected, "display_name")}
                </p>
              )}
              {mode === "moderate" || section === "reports" ? (
                <>
                  <label>
                    Action
                    <select name="action">
                      {section === "reports" && (
                        <>
                          <option value="dismissal">Dismiss report</option>
                          <option value="content_removal">
                            Remove reported collection
                          </option>
                        </>
                      )}
                      <option value="warning">Warning</option>
                      <option value="suspension">Temporary suspension</option>
                      <option value="ban">Ban</option>
                    </select>
                  </label>
                  <label>
                    Suspension ends
                    <input name="until" type="datetime-local" />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Decision
                    <select name="decision">
                      <option value="approve">Approve</option>
                      <option value="reject">Reject</option>
                    </select>
                  </label>
                  {section === "missing" && (
                    <label>
                      Canonical title ID for approval
                      <input name="resolvedTitle" />
                    </label>
                  )}
                </>
              )}
              <label>
                Review reason
                <textarea required name="reason" maxLength={3000} rows={4} />
              </label>
            </>
          )}
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="button button-primary"
            disabled={pending || !online}
          >
            {pending ? "Saving…" : "Save decision"}
          </button>
        </form>
      </ProductDialog>
      <Confirmation
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
        title={confirm?.label || "Confirm change"}
        description="This action is checked against your database role and recorded in the audit log."
        danger
        onConfirm={async () => {
          if (confirm) {
            unwrap(await confirm.work());
            await query.refetch();
            setMode("");
            toast("Decision recorded.");
          }
        }}
      />
    </div>
  );
}
