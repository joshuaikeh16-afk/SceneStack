"use client";
import { useState } from "react";
import { ProductDialog } from "./dialog";
import { unwrap, useProduct } from "./providers";
import { requestMissingTitle, requestCorrection } from "@/app/actions/admin";
import { reportContent } from "@/app/actions/profile";
import { categories } from "@/config/categories";
export function RequestTitleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useProduct();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <ProductDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Which story are we missing?"
      description="A catalog editor will review your request."
      className="dialog-small"
    >
      <form
        className="dialog-body product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPending(true);
          try {
            unwrap(
              await requestMissingTitle({
                title: f.get("title"),
                category: f.get("category"),
                details: f.get("details"),
              }),
            );
            toast("Your title request is in review.");
            onOpenChange(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Title
          <input name="title" required maxLength={300} />
        </label>
        <label>
          Category
          <select name="category">
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          A little more context
          <textarea name="details" maxLength={3000} rows={3} />
        </label>
        <p className="form-error" role="alert">
          {error}
        </p>
        <button className="button button-primary" disabled={pending}>
          {pending ? "Sending…" : "Request title"}
        </button>
      </form>
    </ProductDialog>
  );
}
export function ReportDialog({
  open,
  onOpenChange,
  userId,
  collectionId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId?: string;
  collectionId?: string;
}) {
  const { toast } = useProduct();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <ProductDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Help keep this a good place."
      description="Reports are reviewed by moderators. Your identity is not shown to the person you report."
      className="dialog-small"
    >
      <form
        className="dialog-body product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPending(true);
          try {
            unwrap(
              await reportContent({
                ...(userId && { userId }),
                ...(collectionId && { collectionId }),
                reason: f.get("reason"),
                details: f.get("details"),
              }),
            );
            toast("Report submitted for review.");
            onOpenChange(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Reason
          <select name="reason">
            {[
              "spam",
              "harassment",
              "hate",
              "inappropriate",
              "spoiler",
              "copyright",
              "other",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Details
          <textarea name="details" maxLength={3000} rows={4} />
        </label>
        <p className="form-error" role="alert">
          {error}
        </p>
        <button className="button button-primary" disabled={pending}>
          {pending ? "Sending…" : "Send report"}
        </button>
      </form>
    </ProductDialog>
  );
}
export function CorrectionDialog({
  open,
  onOpenChange,
  titleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titleId: string;
}) {
  const { toast } = useProduct();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <ProductDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Suggest a correction"
      className="dialog-small"
    >
      <form
        className="dialog-body product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPending(true);
          try {
            unwrap(
              await requestCorrection({
                titleId,
                field: f.get("field"),
                value: f.get("value"),
                reason: f.get("reason"),
              }),
            );
            toast("Correction sent to a catalog editor.");
            onOpenChange(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Field
          <select name="field">
            {[
              "display_title",
              "original_title",
              "description",
              "release_year",
              "kind",
              "age_rating",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Correct value
          <textarea required name="value" maxLength={20000} />
        </label>
        <label>
          Reason or source
          <textarea required name="reason" maxLength={3000} />
        </label>
        <p className="form-error" role="alert">
          {error}
        </p>
        <button className="button button-primary" disabled={pending}>
          {pending ? "Sending…" : "Suggest correction"}
        </button>
      </form>
    </ProductDialog>
  );
}
