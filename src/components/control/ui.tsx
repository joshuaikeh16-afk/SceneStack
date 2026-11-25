"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Inbox, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductDialog } from "@/components/product/dialog";
import { useProduct, unwrap } from "@/components/product/providers";
import type { ActionReply } from "@/types/product";
import type { ControlRow } from "@/types/control";
import { rowText } from "@/lib/control/client";

export function Status({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : "unknown";
  const style = [
    "active",
    "completed",
    "fulfilled",
    "resolved",
    "accepted",
    "operational",
    "published",
    "approved",
  ].includes(text)
    ? "good"
    : ["failed", "banned", "rejected", "unavailable", "cancelled"].includes(
          text,
        )
      ? "bad"
      : [
            "pending",
            "submitted",
            "suspended",
            "awaiting_information",
            "degraded",
            "paused",
            "approved_pending_publication",
          ].includes(text)
        ? "warning"
        : "";
  return (
    <span className={`cc-status ${style}`}>{text.replaceAll("_", " ")}</span>
  );
}
export function Empty({
  title = "No matching records",
  description = "Try another search or adjust the filters.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="cc-empty">
      <Inbox size={24} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function QueryError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="cc-error" role="alert">
      <p>{message}</p>
      <button className="cc-button" onClick={retry}>
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  );
}
export type Column = {
  key: string;
  label: string;
  render?: (row: ControlRow) => React.ReactNode;
};
export function DataTable({
  rows,
  columns,
  selection,
  onSelection,
}: {
  rows: ControlRow[];
  columns: Column[];
  selection?: string[];
  onSelection?: (values: string[]) => void;
}) {
  if (!rows.length) return <Empty />;
  return (
    <div
      className="cc-table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Scrollable records"
    >
      <table className="cc-table">
        <thead>
          <tr>
            {onSelection && (
              <th>
                <input
                  type="checkbox"
                  aria-label="Select this page"
                  checked={rows.every((row) =>
                    selection?.includes(rowText(row, "id")),
                  )}
                  onChange={(event) =>
                    onSelection(
                      event.target.checked
                        ? rows.map((row) => rowText(row, "id"))
                        : [],
                    )
                  }
                />
              </th>
            )}
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowText(row, "id", String(index))}>
              {onSelection && (
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${rowText(row, "display_title", rowText(row, "subject", rowText(row, "id")))}`}
                    checked={selection?.includes(rowText(row, "id")) ?? false}
                    onChange={(event) =>
                      onSelection(
                        event.target.checked
                          ? [...(selection ?? []), rowText(row, "id")]
                          : (selection?.filter(
                              (value) => value !== rowText(row, "id"),
                            ) ?? []),
                      )
                    }
                  />
                </td>
              )}
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render
                    ? column.render(row)
                    : rowText(row, column.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pager({
  page,
  hasMore,
  total,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  total?: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="cc-pagination">
      <span>
        Page {page}
        {typeof total === "number"
          ? ` · ${total.toLocaleString()} records`
          : ""}
      </span>
      <div className="cc-actions">
        <button
          className="cc-button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <button
          className="cc-button"
          disabled={!hasMore}
          onClick={() => onPage(page + 1)}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
export function TextField({
  label,
  name,
  type = "text",
  value,
  required = false,
  maxLength = 300,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      {type === "textarea" ? (
        <textarea
          name={name}
          defaultValue={value}
          required={required}
          maxLength={maxLength}
          rows={4}
          placeholder={placeholder}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          maxLength={maxLength}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export function SelectField({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: readonly (string | { value: string; label: string })[];
  value?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          return (
            <option value={value} key={value}>
              {typeof option === "string"
                ? option.replaceAll("_", " ")
                : option.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  submit,
  label = "Confirm change",
  danger = false,
  noSubmit = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  submit: (form: FormData) => Promise<ActionReply<unknown>>;
  label?: string;
  danger?: boolean;
  noSubmit?: boolean;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const { toast, online } = useProduct();
  const client = useQueryClient();
  const router = useRouter();
  return (
    <ProductDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setError("");
          onOpenChange(value);
        }
      }}
      title={title}
      className="cc-dialog"
    >
      <form
        className="cc-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending || noSubmit) return;
          const form = new FormData(event.currentTarget);
          setPending(true);
          setError("");
          try {
            unwrap(await submit(form));
            await client.invalidateQueries({
              predicate: (query) =>
                [
                  "control",
                  "control-summary",
                  "control-diagnostics",
                  "control-case",
                  "control-user",
                  "control-title",
                  "control-activity",
                  "control-notices",
                  "control-invitations",
                  "control-access",
                  "control-documents",
                  "control-requests",
                ].includes(String(query.queryKey[0])),
            });
            router.refresh();
            onOpenChange(false);
            toast("Change saved.");
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "The change could not be saved.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {description && <p className="cc-form-note">{description}</p>}
        {children}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="cc-actions">
          <button
            type="button"
            className="cc-button"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {noSubmit ? "Close" : "Cancel"}
          </button>
          {!noSubmit && (
            <button
              className={`cc-button ${danger ? "danger" : "primary"}`}
              disabled={pending || !online}
            >
              {pending ? "Saving…" : label}
            </button>
          )}
        </div>
      </form>
    </ProductDialog>
  );
}
export const formText = (form: FormData, name: string) =>
  String(form.get(name) || "").trim();
export const formId = (form: FormData, name: string) =>
  formText(form, name) || null;
export const formDate = (form: FormData, name: string) =>
  formText(form, name) ? new Date(formText(form, name)).toISOString() : null;
export function rowsOf(value: unknown): ControlRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ControlRow =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}
