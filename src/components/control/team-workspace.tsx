"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, UserPlus, UserRound, MailCheck } from "lucide-react";
import Link from "next/link";
import { controlFetch, dateLabel, rowText } from "@/lib/control/client";
import { controlMutation } from "@/app/actions/control";
import type { ControlRow, ControlWorkspace } from "@/types/control";
import {
  ActionDialog,
  DataTable,
  Empty,
  QueryError,
  Status,
  TextField,
  formText,
  rowsOf,
} from "./ui";
import { useControlIdentity } from "./shell";

export function TeamWorkspace({ data }: { data: ControlWorkspace }) {
  const identity = useControlIdentity();
  const [mode, setMode] = useState(""),
    [selected, setSelected] = useState<ControlRow | null>(null),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const accounts = useQuery({
    queryKey: ["control-accounts", identity.userId, term],
    enabled: mode === "search" && term.length >= 3,
    queryFn: ({ signal }) =>
      controlFetch<ControlRow[]>("accounts", { q: term }, signal),
  });
  const activity = useQuery({
    queryKey: ["control", identity.userId, "team-audit"],
    queryFn: ({ signal }) =>
      controlFetch<ControlWorkspace>(
        "workspace",
        { section: "audit", q: "moderator_" },
        signal,
      ),
  });
  const owner = data.rows.find((row) => row.role === "super_admin"),
    moderators = data.rows.filter((row) => row.role === "moderator"),
    invitations = rowsOf(data.metrics.invitations);
  const vacancy = Math.max(0, 5 - moderators.length - invitations.length);
  const open = (action: string, row: ControlRow) => {
    setSelected(row);
    setMode(action);
  };
  return (
    <>
      <div className="cc-panel" style={{ marginBottom: 20 }}>
        <div className="cc-panel-header">
          <h2>
            <ShieldCheck
              size={16}
              style={{ display: "inline", marginRight: 7 }}
            />
            Platform owner
          </h2>
          <Status value="active" />
        </div>
        {owner ? (
          <>
            <h3>{rowText(owner, "display_name")}</h3>
            <p className="cc-small cc-muted">
              @{rowText(owner, "username", "not set")} · Super Admin · Appointed{" "}
              {dateLabel(owner.granted_at)}
            </p>
            <p className="cc-small cc-muted">
              The sole owner cannot be demoted, suspended, or removed through
              ordinary administrative actions.
            </p>
          </>
        ) : (
          <Empty
            title="Owner initialization required"
            description="Use the documented trusted server bootstrap with the owner’s verified account UUID."
          />
        )}
      </div>
      <div className="cc-panel-header">
        <h2>
          Moderator positions{" "}
          <span className="cc-muted">
            {moderators.length + invitations.length} / 5 occupied or reserved
          </span>
        </h2>
        <button
          className="cc-button primary"
          disabled={!vacancy}
          onClick={() => setMode("search")}
        >
          <UserPlus size={14} />
          Invite moderator
        </button>
      </div>
      <p className="cc-small cc-muted" style={{ marginBottom: 16 }}>
        Pending invitations reserve a position. Suspended moderators retain
        their position until removed.
      </p>
      <div className="cc-team-grid">
        {moderators.map((row) => (
          <article className="cc-team-seat" key={rowText(row, "id")}>
            <UserRound size={22} className="cc-muted" />
            <h3>{rowText(row, "display_name")}</h3>
            <p>@{rowText(row, "username", "not set")}</p>
            <Status value={row.suspended_at ? "suspended" : "active"} />
            <p style={{ marginTop: 12 }}>
              Appointed {dateLabel(row.granted_at)}
            </p>
            <Link
              className="cc-small"
              href={`/admin/users/${rowText(row, "id")}`}
            >
              Review public account ↗
            </Link>
            <div className="cc-actions">
              <button
                className="cc-button"
                onClick={() =>
                  open(row.suspended_at ? "restore" : "suspend", row)
                }
              >
                {row.suspended_at ? "Restore access" : "Suspend access"}
              </button>
              <button
                className="cc-button danger"
                onClick={() => open("remove", row)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
        {invitations.map((row) => (
          <article className="cc-team-seat" key={rowText(row, "id")}>
            <MailCheck size={22} className="cc-muted" />
            <h3>{rowText(row, "display_name")}</h3>
            <p>@{rowText(row, "username", "not set")}</p>
            <Status value="pending" />
            <p style={{ marginTop: 12 }}>
              Invitation expires {dateLabel(row.expires_at)}
            </p>
            <button
              className="cc-button"
              onClick={() => open("cancel_invitation", row)}
            >
              Cancel invitation
            </button>
          </article>
        ))}
        {Array.from({ length: vacancy }, (_, index) => (
          <article className="cc-team-seat vacant" key={`vacant:${index}`}>
            <UserPlus size={22} className="cc-muted" />
            <h3>Vacant position</h3>
            <p>
              An existing SceneStack member may be invited to this position.
            </p>
            <button className="cc-button" onClick={() => setMode("search")}>
              Find a member
            </button>
          </article>
        ))}
      </div>
      <section className="cc-panel" style={{ marginTop: 20 }}>
        <div className="cc-panel-header">
          <h2>Recent team activity</h2>
          <Link className="cc-small cc-muted" href="/admin/audit?q=moderator_">
            Full audit history ↗
          </Link>
        </div>
        {activity.isError ? (
          <QueryError
            message={activity.error.message}
            retry={() => void activity.refetch()}
          />
        ) : activity.data ? (
          <DataTable
            rows={activity.data.rows}
            columns={[
              {
                key: "action",
                label: "Action",
                render: (row) => rowText(row, "action").replaceAll("_", " "),
              },
              { key: "reason", label: "Reason" },
              {
                key: "created_at",
                label: "Recorded",
                render: (row) => dateLabel(row.created_at),
              },
            ]}
          />
        ) : (
          <p className="cc-muted">Loading team history…</p>
        )}
      </section>
      <ActionDialog
        noSubmit={mode === "search"}
        key={mode + rowText(selected ?? {}, "id")}
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) setMode("");
        }}
        title={
          mode === "search"
            ? "Find a moderator candidate"
            : mode === "invite"
              ? "Send moderator invitation"
              : `${mode.replaceAll("_", " ")} moderator access`
        }
        label={
          mode === "search"
            ? "Close search"
            : mode === "invite"
              ? "Send invitation"
              : "Confirm team change"
        }
        danger={mode === "remove" || mode === "suspend"}
        submit={async (form) => {
          if (mode === "search") return { ok: true, data: undefined };
          if (mode === "invite")
            return controlMutation({
              operation: "invite",
              userId: rowText(selected ?? {}, "id"),
              reason: formText(form, "reason"),
            });
          return controlMutation({
            operation: "team",
            userId:
              mode === "cancel_invitation"
                ? rowText(selected ?? {}, "invited_user_id")
                : rowText(selected ?? {}, "id"),
            action: mode,
            reason: formText(form, "reason"),
          });
        }}
      >
        {mode === "search" ? (
          <>
            <label>
              Username or exact registered email
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                minLength={3}
                maxLength={120}
                placeholder="Search an existing Google account"
              />
            </label>
            <p className="cc-form-note">
              The member must have created a normal SceneStack account first.
              Registered emails are available only for this owner-authorized
              appointment search.
            </p>
            {term.length < 3 ? (
              <p className="cc-muted cc-small">
                Enter at least three characters.
              </p>
            ) : accounts.isPending ? (
              <p role="status">Searching accounts…</p>
            ) : accounts.isError ? (
              <p className="form-error">{accounts.error.message}</p>
            ) : accounts.data?.length ? (
              accounts.data.map((row) => (
                <div className="cc-panel" key={rowText(row, "id")}>
                  <strong>{rowText(row, "display_name")}</strong>
                  <p className="cc-small cc-muted">
                    @{rowText(row, "username", "not set")} ·{" "}
                    {rowText(row, "email")}
                  </p>
                  <button
                    className="cc-button"
                    type="button"
                    disabled={row.status !== "active"}
                    onClick={() => {
                      setSelected(row);
                      setMode("invite");
                    }}
                  >
                    Select candidate
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title="No existing account found"
                description="Check the username or exact registered email."
              />
            )}
          </>
        ) : (
          <>
            <p className="cc-form-note">
              {rowText(selected ?? {}, "display_name")} · @
              {rowText(selected ?? {}, "username", "not set")}
            </p>
            <p className="cc-form-note">
              {mode === "invite"
                ? "This sends an in-app invitation. The recipient must accept before permissions are granted."
                : mode === "remove"
                  ? "Administrative access will end immediately. Their ordinary SceneStack account and personal data remain intact."
                  : mode === "cancel_invitation"
                    ? "This cancels the invitation and releases its reserved position."
                    : mode === "suspend"
                      ? "Administrative permissions will be revoked immediately. The position remains occupied."
                      : "Restore this moderator’s administrative access?"}
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
