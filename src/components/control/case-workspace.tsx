"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  Shield,
  FileCheck2,
  UserRoundCheck,
} from "lucide-react";
import { controlFetch, dateLabel, rowText } from "@/lib/control/client";
import type { CaseDetail } from "@/types/control";
import { controlMutation } from "@/app/actions/control";
import {
  ActionDialog,
  QueryError,
  SelectField,
  Status,
  TextField,
  formText,
  formId,
  rowsOf,
  formDate,
} from "./ui";
import type { ControlRole } from "@/config/control-center";
import { useProduct, unwrap } from "@/components/product/providers";

export const caseStatuses: Record<string, string[]> = {
  report: [
    "submitted",
    "under_review",
    "awaiting_information",
    "resolved",
    "dismissed",
    "reopened",
  ],
  title_request: [
    "submitted",
    "under_review",
    "awaiting_information",
    "approved_pending_publication",
    "fulfilled",
    "rejected",
    "merged",
  ],
  correction: [
    "submitted",
    "under_review",
    "awaiting_information",
    "rejected",
    "merged",
  ],
  appeal: ["submitted", "under_review", "awaiting_information"],
  support: [
    "open",
    "assigned",
    "in_progress",
    "awaiting_user",
    "resolved",
    "closed",
    "reopened",
  ],
  flag: ["submitted", "under_review", "resolved", "dismissed"],
};
export function CaseWorkspace({
  id,
  role,
}: {
  id: string;
  role?: ControlRole;
}) {
  const { bootstrap, toast } = useProduct();
  const client = useQueryClient();
  const [mode, setMode] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [older, setOlder] = useState<CaseDetail["messages"]>([]),
    [offset, setOffset] = useState(0),
    [loadingOlder, setLoadingOlder] = useState(false);
  const query = useQuery({
    queryKey: ["control-case", bootstrap.userId, id],
    queryFn: ({ signal }) => controlFetch<CaseDetail>("case", { id }, signal),
  });
  if (query.isPending)
    return (
      <div className="cc-skeleton" role="status" aria-label="Loading case" />
    );
  if (query.isError)
    return (
      <QueryError
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const { item, messages, title, enforcement } = query.data;
  const admin = !!role;
  const permittedCatalog = role === "super_admin";
  const combined = [
    ...new Map(
      [...older, ...messages].map((message) => [message.id, message]),
    ).values(),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const proposed =
    item.payload.fields &&
    typeof item.payload.fields === "object" &&
    !Array.isArray(item.payload.fields)
      ? (item.payload.fields as Record<string, unknown>)
      : {};
  const terminal = ["withdrawn", "closed", "merged"].includes(item.status);
  const refresh = async () => {
    await Promise.all([
      query.refetch(),
      client.invalidateQueries({ queryKey: ["control-notices"] }),
      client.invalidateQueries({ queryKey: ["control-activity"] }),
    ]);
  };
  return (
    <>
      <div className="cc-page-heading">
        <div>
          <Link
            className="cc-small cc-muted"
            href={admin ? "/admin/action-center" : "/activity"}
          >
            <ArrowLeft size={12} style={{ display: "inline" }} />{" "}
            {admin ? "Action Center" : "My activity"}
          </Link>
          <h1 style={{ marginTop: 10 }}>{item.subject}</h1>
          <p>
            {item.kind.replaceAll("_", " ")} ·{" "}
            {item.id.slice(0, 8).toUpperCase()} · Opened{" "}
            {dateLabel(item.created_at)}
          </p>
        </div>
        <div className="cc-actions">
          <Status value={item.status} />
          {admin && (
            <button
              className="cc-button primary"
              onClick={() => setMode("review")}
            >
              <UserRoundCheck size={14} />
              Review case
            </button>
          )}
          {!admin &&
            [
              "submitted",
              "under_review",
              "awaiting_information",
              "reopened",
            ].includes(item.status) && (
              <button className="cc-button" onClick={() => setMode("withdraw")}>
                Withdraw
              </button>
            )}
          {!admin &&
            item.kind === "support" &&
            ["resolved", "closed"].includes(item.status) && (
              <>
                <button className="cc-button" onClick={() => setMode("reopen")}>
                  Reopen ticket
                </button>
                <button className="cc-button" onClick={() => setMode("rate")}>
                  Rate support
                </button>
              </>
            )}
        </div>
      </div>
      <div className="cc-detail-grid">
        <div className="cc-stack">
          <section className="cc-panel">
            <h2>Submitted information</h2>
            <p className="cc-detail-copy">
              {item.description || "No additional written information."}
            </p>
            {typeof item.payload.referenceUrl === "string" &&
              /^https:\/\/[^@\s]+$/.test(item.payload.referenceUrl) && (
                <a
                  className="cc-small"
                  href={item.payload.referenceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Reference link ↗
                </a>
              )}
            {item.title_id && (
              <p className="cc-small">
                <Link href={`/titles/${item.title_id}`}>
                  View canonical title ↗
                </Link>
              </p>
            )}
            {item.resolution && (
              <div className="cc-warning">
                <strong>Resolution</strong>
                <p style={{ marginTop: 7, marginBottom: 0 }}>
                  {item.resolution}
                </p>
              </div>
            )}
          </section>
          {item.kind === "correction" && (
            <section className="cc-panel">
              <div className="cc-panel-header">
                <h2>Metadata comparison</h2>
                {permittedCatalog &&
                  ![
                    "accepted",
                    "partially_accepted",
                    "rejected",
                    "withdrawn",
                    "merged",
                  ].includes(item.status) && (
                    <button
                      className="cc-button primary"
                      onClick={() => setMode("fields")}
                    >
                      <FileCheck2 size={14} />
                      Decide fields
                    </button>
                  )}
              </div>
              {Object.entries(proposed).map(([field, value]) => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <h3>{field.replaceAll("_", " ")}</h3>
                  <div className="cc-comparison">
                    <div>
                      <small className="cc-muted">Current catalog value</small>
                      <pre>
                        {JSON.stringify(title?.[field] ?? null, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <small className="cc-muted">Proposed replacement</small>
                      <pre>{JSON.stringify(value, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ))}
              {rowsOf(query.data.decisions).map((decision) => (
                <p className="cc-small" key={rowText(decision, "field_name")}>
                  {rowText(decision, "field_name")}:{" "}
                  {decision.approved ? "Approved" : "Rejected"} ·{" "}
                  {rowText(decision, "reason")}
                </p>
              ))}
            </section>
          )}
          {item.kind === "appeal" && enforcement && (
            <section className="cc-panel">
              <h2>Associated disciplinary action</h2>
              <Status value={enforcement.kind} />
              <p className="cc-detail-copy" style={{ marginTop: 12 }}>
                {rowText(enforcement, "explanation")}
              </p>
              <p className="cc-small cc-muted">
                Expires: {dateLabel(enforcement.expires_at)} · Revoked:{" "}
                {dateLabel(enforcement.revoked_at)}
              </p>
              {admin &&
                ![
                  "accepted",
                  "partially_accepted",
                  "rejected",
                  "withdrawn",
                ].includes(item.status) && (
                  <button
                    className="cc-button primary"
                    onClick={() => setMode("appeal")}
                  >
                    Resolve appeal
                  </button>
                )}
            </section>
          )}
          <section className="cc-panel">
            <h2>
              <MessageSquare
                size={15}
                style={{ display: "inline", marginRight: 7 }}
              />
              Conversation
            </h2>
            {query.data.hasMoreMessages && offset === 0 && (
              <button
                className="cc-button"
                disabled={loadingOlder}
                onClick={async () => {
                  setLoadingOlder(true);
                  try {
                    const data = await controlFetch<CaseDetail>("case", {
                      id,
                      messageOffset: messages.length,
                    });
                    setOlder(data.messages);
                    setOffset(messages.length + data.messages.length);
                  } catch (error) {
                    toast(
                      error instanceof Error
                        ? error.message
                        : "Could not load older replies",
                      true,
                    );
                  } finally {
                    setLoadingOlder(false);
                  }
                }}
              >
                Load more messages
              </button>
            )}
            {offset > 0 && (
              <button
                className="cc-button"
                disabled={loadingOlder}
                onClick={async () => {
                  setLoadingOlder(true);
                  try {
                    const data = await controlFetch<CaseDetail>("case", {
                      id,
                      messageOffset: offset,
                    });
                    setOlder((previous) => [...previous, ...data.messages]);
                    setOffset(
                      data.hasMoreMessages ? offset + data.messages.length : -1,
                    );
                  } catch (error) {
                    toast(
                      error instanceof Error
                        ? error.message
                        : "Could not load messages",
                      true,
                    );
                  } finally {
                    setLoadingOlder(false);
                  }
                }}
              >
                Load more messages
              </button>
            )}
            <div className="cc-thread">
              {combined.length ? (
                combined.map((message) => (
                  <article
                    className={`cc-message${message.internal ? " internal" : ""}`}
                    key={message.id}
                  >
                    <header>
                      <span>
                        {message.internal
                          ? "Staff note"
                          : message.author_id === bootstrap.userId
                            ? "You"
                            : "Case participant"}
                      </span>
                      <time dateTime={message.created_at}>
                        {dateLabel(message.created_at)}
                      </time>
                    </header>
                    <p>{message.body}</p>
                  </article>
                ))
              ) : (
                <p className="cc-small cc-muted">No replies yet.</p>
              )}
            </div>
            {!terminal && (
              <form
                className="cc-form"
                style={{ marginTop: 18 }}
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (sending) return;
                  setSending(true);
                  setReplyError("");
                  try {
                    unwrap(
                      await controlMutation({
                        operation: "reply",
                        id,
                        body: reply,
                        internal: admin && internal,
                      }),
                    );
                    setReply("");
                    await refresh();
                  } catch (error) {
                    setReplyError(
                      error instanceof Error
                        ? error.message
                        : "Reply could not be saved.",
                    );
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <label>
                  {internal ? "Internal note" : "Written reply"}
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    required
                    maxLength={10000}
                    rows={4}
                  />
                </label>
                {admin && (
                  <label className="cc-inline-check">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(event) => setInternal(event.target.checked)}
                    />
                    Internal staff note · hidden from members
                  </label>
                )}
                {replyError && (
                  <p className="form-error" role="alert">
                    {replyError}
                  </p>
                )}
                <button
                  className="cc-button primary"
                  disabled={sending || !reply.trim()}
                >
                  {sending
                    ? "Sending…"
                    : internal
                      ? "Save internal note"
                      : "Send reply"}
                </button>
              </form>
            )}
          </section>
        </div>
        <aside className="cc-stack">
          <section className="cc-panel">
            <h2>Case information</h2>
            <dl className="cc-detail-facts">
              <dt>Priority</dt>
              <dd>
                <Status value={item.priority} />
              </dd>
              <dt>Assigned to</dt>
              <dd>
                {item.assigned_to === bootstrap.userId
                  ? "You"
                  : item.assigned_to || "Unassigned"}
              </dd>
              <dt>Last update</dt>
              <dd>{dateLabel(item.updated_at)}</dd>
              {admin && item.owner_id && (
                <>
                  <dt>Submitted by</dt>
                  <dd>
                    <Link href={`/admin/users/${item.owner_id}`}>
                      {item.owner_id.slice(0, 8)} ↗
                    </Link>
                  </dd>
                </>
              )}
            </dl>
          </section>
          {admin && item.payload.publicSnapshot !== undefined && (
            <section className="cc-panel">
              <h2>Preserved public context</h2>
              <pre className="cc-json">
                {JSON.stringify(item.payload.publicSnapshot, null, 2)}
              </pre>
            </section>
          )}
          {admin && item.kind === "flag" && (
            <section className="cc-panel">
              <h2>Automated review flag</h2>
              <p className="cc-small cc-muted">
                This deterministic rule flagged content for review. No automatic
                punishment was applied. Confidence was not measured.
              </p>
              <pre className="cc-json">
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            </section>
          )}
          {admin && item.target_user_id && (
            <section className="cc-panel">
              <h2>Reported account</h2>
              <Link
                className="cc-button"
                href={`/admin/users/${item.target_user_id}`}
              >
                <Shield size={14} />
                Investigate account
              </Link>
            </section>
          )}
        </aside>
      </div>
      <ActionDialog
        key={mode}
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) setMode("");
        }}
        title={
          mode === "fields"
            ? "Decide proposed fields"
            : mode === "review"
              ? "Review case"
              : mode === "appeal"
                ? "Resolve appeal"
                : `${mode.charAt(0).toUpperCase() + mode.slice(1)} case`
        }
        label={mode === "withdraw" ? "Confirm withdrawal" : "Confirm decision"}
        submit={async (form) => {
          if (mode === "review")
            return controlMutation({
              operation: "review",
              id,
              status: formText(form, "status"),
              resolution: formText(form, "resolution"),
              priority: formText(form, "priority"),
              assignee: formId(form, "assignee"),
              groupId: formId(form, "group"),
              titleId: formId(form, "title"),
            });
          if (mode === "fields")
            return controlMutation({
              operation: "correction_decisions",
              id,
              decisions: Object.fromEntries(
                Object.keys(proposed).map((field) => [
                  field,
                  formText(form, `field:${field}`) === "approve",
                ]),
              ),
              reason: formText(form, "reason"),
            });
          if (mode === "appeal")
            return controlMutation({
              operation: "appeal",
              id,
              decision: formText(form, "decision"),
              until: formDate(form, "until"),
              reason: formText(form, "reason"),
            });
          return controlMutation({
            operation: "member_case",
            id,
            action: mode,
            rating: mode === "rate" ? Number(formText(form, "rating")) : null,
          });
        }}
      >
        {mode === "review" ? (
          <>
            <SelectField
              label="Case status"
              name="status"
              options={caseStatuses[item.kind] ?? []}
              value={item.status}
            />
            <SelectField
              label="Priority"
              name="priority"
              options={["low", "normal", "high", "urgent"]}
              value={item.priority}
            />
            <SelectField
              label="Assignment"
              name="assignee"
              options={[
                { value: "", label: "Unassigned" },
                { value: bootstrap.userId || "", label: "Assign to me" },
                ...(item.assigned_to && item.assigned_to !== bootstrap.userId
                  ? [
                      {
                        value: item.assigned_to,
                        label: "Keep current assignee",
                      },
                    ]
                  : []),
              ]}
              value={item.assigned_to || ""}
            />
            <TextField
              label="Group into existing case ID (optional)"
              name="group"
            />
            {item.kind === "title_request" && (
              <TextField
                label="Published canonical title ID for fulfillment"
                name="title"
                value={item.title_id || ""}
              />
            )}
            <TextField
              label="Member-visible resolution or clarification"
              name="resolution"
              type="textarea"
              required
              maxLength={3000}
            />
            <p className="cc-form-note">
              Keep confidential investigation notes in an internal message.
            </p>
          </>
        ) : mode === "fields" ? (
          <>
            {Object.entries(proposed).map(([field, value]) => (
              <div key={field}>
                <p className="cc-small">
                  {field.replaceAll("_", " ")}: {JSON.stringify(value)}
                </p>
                <SelectField
                  label={`Decision for ${field.replaceAll("_", " ")}`}
                  name={`field:${field}`}
                  options={[
                    { value: "reject", label: "Reject this field" },
                    { value: "approve", label: "Approve and lock this field" },
                  ]}
                />
              </div>
            ))}
            <TextField
              label="Review reason and member-visible summary"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
          </>
        ) : mode === "appeal" ? (
          <>
            <SelectField
              label="Decision"
              name="decision"
              options={[
                { value: "accepted", label: "Accept and revoke restriction" },
                {
                  value: "partially_accepted",
                  label: "Partially accept and shorten restriction",
                },
                { value: "rejected", label: "Reject and retain restriction" },
              ]}
            />
            <TextField
              label="Reduced expiry (partial acceptance)"
              name="until"
              type="datetime-local"
            />
            <TextField
              label="Reason and member-visible resolution"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
          </>
        ) : mode === "rate" ? (
          <SelectField
            label="Support satisfaction"
            name="rating"
            options={[
              { value: "5", label: "5 · Excellent" },
              { value: "4", label: "4 · Good" },
              { value: "3", label: "3 · Fair" },
              { value: "2", label: "2 · Poor" },
              { value: "1", label: "1 · Very poor" },
            ]}
          />
        ) : (
          <p className="cc-form-note">
            {mode === "withdraw"
              ? "Withdraw this unresolved submission? Its conversation and review history will be preserved."
              : "Reopen this support ticket to continue the conversation?"}
          </p>
        )}
      </ActionDialog>
    </>
  );
}
