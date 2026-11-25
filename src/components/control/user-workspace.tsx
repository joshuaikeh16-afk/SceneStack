"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, UserRound, FileText } from "lucide-react";
import type { ControlRow } from "@/types/control";
import { controlFetch, dateLabel, rowText } from "@/lib/control/client";
import { controlMutation } from "@/app/actions/control";
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
  formDate,
  rowsOf,
} from "./ui";

type UserDetail = {
  profile: ControlRow | null;
  roles: ControlRow[];
  collections: ControlRow[];
  enforcements: ControlRow[];
  cases: ControlRow[];
  notes?: ControlRow[];
  lastActiveDay?: string | null;
};
export function UserWorkspace({ id }: { id: string }) {
  const identity = useControlIdentity();
  const [mode, setMode] = useState(""),
    [kind, setKind] = useState("warning"),
    [selected, setSelected] = useState<ControlRow | null>(null);
  const query = useQuery({
    queryKey: ["control-user", identity.userId, id],
    queryFn: ({ signal }) => controlFetch<UserDetail>("user", { id }, signal),
  });
  if (query.isPending)
    return (
      <div
        className="cc-skeleton"
        role="status"
        aria-label="Loading member investigation"
      />
    );
  if (query.isError)
    return (
      <QueryError
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  if (!query.data.profile) return <Empty title="Account unavailable" />;
  const { profile, roles, collections, enforcements, cases } = query.data;
  const protectedAccount = roles.length > 0;
  const superAdmin = identity.role === "super_admin";
  return (
    <>
      <div className="cc-page-heading">
        <div>
          <Link className="cc-small cc-muted" href="/admin/users">
            <ArrowLeft size={12} style={{ display: "inline" }} /> User directory
          </Link>
          <h1 style={{ marginTop: 10 }}>{rowText(profile, "display_name")}</h1>
          <p>
            @{rowText(profile, "username", "not set")} · {id}
          </p>
        </div>
        <div className="cc-actions">
          <Status value={profile.status} />
          {!!profile.verified_at && <Status value="verified" />}
          {!protectedAccount && (
            <button
              className="cc-button danger"
              onClick={() => setMode("enforce")}
            >
              <ShieldAlert size={14} />
              Account enforcement
            </button>
          )}
          <button className="cc-button" onClick={() => setMode("note")}>
            <FileText size={14} />
            Add staff note
          </button>
        </div>
      </div>
      {protectedAccount && (
        <div className="cc-warning">
          This member holds an administrative position. Ordinary disciplinary
          controls are unavailable. Team access is managed separately.
        </div>
      )}
      <div className="cc-two-column">
        <div className="cc-stack">
          <section className="cc-panel">
            <h2>
              <UserRound
                size={15}
                style={{ display: "inline", marginRight: 7 }}
              />
              Public profile information
            </h2>
            <dl className="cc-detail-facts">
              <dt>Registered</dt>
              <dd>{dateLabel(profile.created_at)}</dd>
              <dt>Last activity</dt>
              <dd>{query.data.lastActiveDay || "Not recorded"}</dd>
              <dt>Role</dt>
              <dd>
                {roles.length
                  ? roles
                      .map((role) => rowText(role, "role").replaceAll("_", " "))
                      .join(", ")
                  : "Member"}
              </dd>
              <dt>Biography</dt>
              <dd className="cc-detail-copy">
                {rowText(profile, "bio", "No public biography")}
              </dd>
            </dl>
            <p className="cc-form-note" style={{ marginTop: 18 }}>
              Private tracking, personal ratings, favorites, and unpublished
              collections are not available in this workspace.
            </p>
            {superAdmin &&
              !roles.some((role) => role.role === "super_admin") && (
                <div className="cc-actions">
                  <button
                    className="cc-button"
                    onClick={() =>
                      setMode(profile.verified_at ? "unverify" : "verify")
                    }
                  >
                    {profile.verified_at
                      ? "Revoke verification"
                      : "Award verification"}
                  </button>
                  <button
                    className="cc-button"
                    onClick={() => setMode("clear_bio")}
                  >
                    Clear biography
                  </button>
                  <button
                    className="cc-button"
                    onClick={() => setMode("clear_avatar")}
                  >
                    Clear avatar
                  </button>
                  <button
                    className="cc-button"
                    onClick={() => setMode("clear_cover")}
                  >
                    Clear cover
                  </button>
                  <button
                    className="cc-button"
                    onClick={() => setMode("display_name")}
                  >
                    Edit display name
                  </button>
                  <button
                    className="cc-button"
                    onClick={() => setMode("force_username")}
                  >
                    Require username change
                  </button>
                  {!protectedAccount && (
                    <button
                      className="cc-button danger"
                      onClick={() => setMode("delete")}
                    >
                      Schedule account deletion
                    </button>
                  )}
                </div>
              )}
          </section>
          <section className="cc-panel">
            <h2>Disciplinary history</h2>
            <DataTable
              rows={enforcements}
              columns={[
                {
                  key: "kind",
                  label: "Action",
                  render: (row) => <Status value={row.kind} />,
                },
                { key: "explanation", label: "Member explanation" },
                {
                  key: "expires_at",
                  label: "Expiry",
                  render: (row) => dateLabel(row.expires_at),
                },
                {
                  key: "state",
                  label: "State",
                  render: (row) => (
                    <Status
                      value={
                        row.revoked_at
                          ? "revoked"
                          : typeof row.expires_at === "string" &&
                              Date.parse(row.expires_at) <= Date.now()
                            ? "expired"
                            : "active"
                      }
                    />
                  ),
                },
                {
                  key: "actions",
                  label: "Manage",
                  render: (row) =>
                    !protectedAccount && !row.revoked_at ? (
                      <div className="cc-actions">
                        <button
                          className="cc-button"
                          onClick={() => {
                            setSelected(row);
                            setMode("revoke");
                          }}
                        >
                          Revoke
                        </button>
                        <button
                          className="cc-button"
                          onClick={() => {
                            setSelected(row);
                            setMode("expiry");
                          }}
                        >
                          Change expiry
                        </button>
                      </div>
                    ) : (
                      "—"
                    ),
                },
              ]}
            />
            {!protectedAccount && (
              <button
                className="cc-button"
                style={{ marginTop: 14 }}
                onClick={() => setMode("restore_account")}
              >
                Restore ordinary account access
              </button>
            )}
          </section>
          <section className="cc-panel">
            <h2>Relevant cases</h2>
            <DataTable
              rows={cases}
              columns={[
                {
                  key: "subject",
                  label: "Case",
                  render: (row) => (
                    <Link href={`/admin/action-center/${rowText(row, "id")}`}>
                      {rowText(row, "subject")}
                    </Link>
                  ),
                },
                { key: "kind", label: "Type" },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <Status value={row.status} />,
                },
              ]}
            />
          </section>
          <section className="cc-panel">
            <h2>Staff notes</h2>
            {rowsOf(query.data.notes).length ? (
              <div className="cc-thread">
                {rowsOf(query.data.notes).map((note) => (
                  <article
                    className="cc-message internal"
                    key={rowText(note, "id")}
                  >
                    <header>
                      <span>Confidential administrative note</span>
                      <time>{dateLabel(note.created_at)}</time>
                    </header>
                    <p>{rowText(note, "body")}</p>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="No staff notes recorded"
                description="Notes are visible only to authorized administrators."
              />
            )}
          </section>
        </div>
        <aside className="cc-panel">
          <h2>Published collections</h2>
          {collections.length ? (
            <div className="cc-stack">
              {collections.map((collection) => (
                <div key={rowText(collection, "id")}>
                  <Link href={`/collections/${rowText(collection, "id")}`}>
                    {rowText(collection, "title")}
                  </Link>
                  <p className="cc-small cc-muted">
                    {collection.removed_at
                      ? "Hidden by moderation"
                      : "Published"}{" "}
                    · {dateLabel(collection.published_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="cc-muted cc-small">No published collections.</p>
          )}
        </aside>
      </div>
      <ActionDialog
        key={mode + (selected ? rowText(selected, "id") : "")}
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) setMode("");
        }}
        title={
          mode === "enforce"
            ? "Issue account enforcement"
            : mode === "note"
              ? "Add confidential staff note"
              : mode.replaceAll("_", " ")
        }
        danger={[
          "enforce",
          "delete",
          "force_username",
          "clear_bio",
          "clear_avatar",
          "clear_cover",
        ].includes(mode)}
        submit={async (form) => {
          if (mode === "enforce")
            return controlMutation({
              operation: "enforce",
              userId: id,
              kind,
              reason: formText(form, "reason"),
              explanation: formText(form, "explanation"),
              feature:
                kind === "restriction" ? formText(form, "feature") : null,
              until: formDate(form, "until"),
              caseId: formText(form, "case") || null,
            });
          if (mode === "revoke" || mode === "expiry")
            return controlMutation({
              operation: "enforcement_update",
              id: rowText(selected ?? {}, "id"),
              revoke: mode === "revoke",
              until: formDate(form, "until"),
              reason: formText(form, "reason"),
            });
          if (mode === "note")
            return controlMutation({
              operation: "user_note",
              userId: id,
              body: formText(form, "body"),
            });
          if (mode === "restore_account")
            return controlMutation({
              operation: "restore_account",
              userId: id,
              reason: formText(form, "reason"),
            });
          if (mode === "delete" && formText(form, "confirmation") !== "DELETE")
            return {
              ok: false,
              code: "INVALID_INPUT",
              message:
                "Type DELETE to confirm the recoverable deletion request.",
            };
          return controlMutation({
            operation: "profile",
            userId: id,
            action: mode,
            value: formText(form, "value"),
            reason: formText(form, "reason"),
          });
        }}
      >
        {mode === "enforce" ? (
          <>
            <label>
              Enforcement type
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                {["warning", "suspension", "ban", "restriction"].map(
                  (value) => (
                    <option value={value} key={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            </label>
            {kind === "restriction" && (
              <SelectField
                label="Restricted feature"
                name="feature"
                options={[
                  { value: "publish", label: "Publish collections" },
                  { value: "follow", label: "Follow accounts" },
                  {
                    value: "collection_interaction",
                    label: "Favorite/save public collections",
                  },
                  { value: "title_request", label: "Submit title requests" },
                  { value: "correction", label: "Submit corrections" },
                  { value: "report", label: "Submit ordinary reports" },
                ]}
              />
            )}
            <TextField
              label="Expires at (required for temporary suspension)"
              name="until"
              type="datetime-local"
              required={kind === "suspension"}
            />
            <TextField
              label="Associated moderation case ID (optional)"
              name="case"
            />
            <TextField
              label="Documented internal reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
            <TextField
              label="Explanation shown to the member"
              name="explanation"
              type="textarea"
              required
              maxLength={3000}
            />
            <p className="cc-form-note">
              The member retains essential support, appeals, and account data
              rights.
            </p>
          </>
        ) : mode === "note" ? (
          <TextField
            label="Confidential staff note"
            name="body"
            type="textarea"
            required
            maxLength={10000}
          />
        ) : (
          <>
            {mode === "expiry" && (
              <TextField
                label="New expiry"
                name="until"
                type="datetime-local"
                required
              />
            )}
            {mode === "display_name" && (
              <TextField
                label="New public display name"
                name="value"
                required
                maxLength={80}
                value={rowText(profile, "display_name")}
              />
            )}
            <TextField
              label="Documented reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
            {mode === "delete" && (
              <>
                <p className="cc-warning">
                  This starts the existing 30-day recovery period. It does not
                  irreversibly delete the account or bypass the purge safety
                  gate.
                </p>
                <TextField
                  label="Type DELETE to confirm"
                  name="confirmation"
                  required
                  maxLength={6}
                />
              </>
            )}
            {mode === "force_username" && (
              <p className="cc-form-note">
                The member will be asked to choose a new valid username.
                Existing ownership and personal records remain attached to the
                same account UUID.
              </p>
            )}
          </>
        )}
      </ActionDialog>
    </>
  );
}
