"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowUp, ArrowDown, Trash2, Eye, History } from "lucide-react";
import type { ControlRow, ControlWorkspace } from "@/types/control";
import { rowText, dateLabel } from "@/lib/control/client";
import { controlMutation } from "@/app/actions/control";
import {
  ActionDialog,
  DataTable,
  SelectField,
  Status,
  TextField,
  formText,
  formDate,
  rowsOf,
} from "./ui";
import { TitleSelector } from "@/components/product/title-selector";

type Section = {
  id: string;
  title: string;
  type: string;
  category: string;
  titleIds: string[];
  collectionIds: string[];
  visible: boolean;
  audienceCategories: string[];
  startsAt: string | null;
  expiresAt: string | null;
};
const categories = [
  "movie",
  "anime",
  "series",
  "cartoon",
  "drama",
  "documentary",
];
const ids = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
const stringIds = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
function sectionsFrom(value: unknown): Section[] {
  return rowsOf(value).map((row, index) => ({
    id: rowText(row, "id", `section-${index}`),
    title: rowText(row, "title", "Untitled section"),
    type: rowText(row, "type", "titles"),
    category: rowText(row, "category", "movie"),
    titleIds: stringIds(row.titleIds),
    collectionIds: stringIds(row.collectionIds),
    visible: row.visible !== false,
    audienceCategories: stringIds(row.audienceCategories),
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
  }));
}
const localDate = (value: unknown) =>
  typeof value === "string" ? value.slice(0, 16) : "";
export function DocumentWorkspace({
  data,
  kind,
}: {
  data: ControlWorkspace;
  kind: "help" | "editorial" | "announcement" | "template";
}) {
  const [selected, setSelected] = useState<ControlRow | null>(null),
    [open, setOpen] = useState(false),
    [heroMode, setHeroMode] = useState("automatic"),
    [heroIds, setHeroIds] = useState<string[]>([]),
    [sections, setSections] = useState<Section[]>([]),
    [preview, setPreview] = useState(false),
    [previewBody, setPreviewBody] = useState(""),
    [previewTitle, setPreviewTitle] = useState("");
  function edit(row: ControlRow | null) {
    setSelected(row);
    const content =
      row?.content &&
      typeof row.content === "object" &&
      !Array.isArray(row.content)
        ? (row.content as ControlRow)
        : {};
    setHeroMode(rowText(content, "heroMode", "automatic"));
    setHeroIds(stringIds(content.heroTitleIds));
    setSections(sectionsFrom(content.sections));
    setPreview(false);
    setPreviewBody(rowText(row ?? {}, "body", ""));
    setPreviewTitle(rowText(row ?? {}, "title", ""));
    setOpen(true);
  }
  function updateSection(index: number, patch: Partial<Section>) {
    setSections((previous) =>
      previous.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    );
  }
  function move(index: number, direction: number) {
    setSections((previous) => {
      const next = [...previous],
        target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  return (
    <>
      <div className="cc-actions" style={{ marginBottom: 18 }}>
        <button className="cc-button primary" onClick={() => edit(null)}>
          <Plus size={14} />
          Create{" "}
          {kind === "editorial"
            ? "Home configuration"
            : kind === "help"
              ? "help article"
              : kind === "template"
                ? "response template"
                : "announcement"}
        </button>
        {["editorial", "help"].includes(kind) && (
          <div className="cc-tab-strip" style={{ margin: 0 }}>
            <Link
              className={kind === "editorial" ? "active" : ""}
              href="/admin/content-studio"
            >
              Home editorial
            </Link>
            <Link
              className={kind === "help" ? "active" : ""}
              href="/admin/content-studio?view=help"
            >
              Help articles
            </Link>
          </div>
        )}
      </div>
      <DataTable
        rows={data.rows}
        columns={[
          {
            key: "title",
            label: kind === "template" ? "Template" : "Publication",
            render: (row) => (
              <button className="cc-button" onClick={() => edit(row)}>
                {rowText(row, "title")}
              </button>
            ),
          },
          ...(kind === "template"
            ? []
            : [
                {
                  key: "status",
                  label: "Status",
                  render: (row: ControlRow) => <Status value={row.status} />,
                },
                { key: "audience", label: "Audience" },
                {
                  key: "starts_at",
                  label: "Starts",
                  render: (row: ControlRow) => dateLabel(row.starts_at),
                },
                {
                  key: "expires_at",
                  label: "Expires",
                  render: (row: ControlRow) => dateLabel(row.expires_at),
                },
                { key: "version", label: "Revision" },
              ]),
          {
            key: "updated_at",
            label: "Updated",
            render: (row) => dateLabel(row.updated_at),
          },
        ]}
      />
      <ActionDialog
        key={`${kind}:${selected ? rowText(selected, "id") : "new"}`}
        open={open}
        onOpenChange={setOpen}
        title={`${selected ? "Edit" : "Create"} ${kind === "editorial" ? "Home configuration" : kind === "help" ? "help article" : kind === "template" ? "response template" : "announcement"}`}
        label="Save reviewed configuration"
        submit={async (form) => {
          if (kind === "template")
            return controlMutation({
              operation: "template",
              id: selected?.id ?? null,
              title: formText(form, "title"),
              body: formText(form, "body"),
              remove: form.get("remove") === "on",
            });
          const content: Record<string, unknown> =
            kind === "editorial"
              ? { heroMode, heroTitleIds: heroIds, sections }
              : kind === "announcement"
                ? {
                    type: formText(form, "type"),
                    banner: form.get("banner") === "on",
                    notification: form.get("notification") === "on",
                  }
                : {};
          return controlMutation({
            operation: "document",
            id: selected?.id ?? null,
            kind,
            version:
              typeof selected?.version === "number" ? selected.version : 1,
            reason: formText(form, "reason"),
            values: {
              slug: formText(form, "slug"),
              title: formText(form, "title"),
              category: formText(form, "category") || "general",
              body: formText(form, "body"),
              content,
              status: formText(form, "status"),
              audience: formText(form, "audience"),
              starts_at: formDate(form, "starts"),
              expires_at: formDate(form, "expires"),
            },
          });
        }}
      >
        <div
          onInput={(event) => {
            const target = event.target as HTMLInputElement;
            if (target.name === "title") setPreviewTitle(target.value);
            if (target.name === "body") setPreviewBody(target.value);
          }}
          className="cc-form"
        >
          <TextField
            label="Title"
            name="title"
            value={selected ? rowText(selected, "title", "") : ""}
            required
            maxLength={200}
          />
          {kind !== "template" && (
            <>
              <TextField
                label="URL slug"
                name="slug"
                value={selected ? rowText(selected, "slug", "") : ""}
                required
                maxLength={100}
                placeholder="lowercase-words-with-hyphens"
              />
              <TextField
                label={
                  kind === "help" ? "Help category" : "Campaign / category"
                }
                name="category"
                value={
                  selected
                    ? rowText(selected, "category", "general")
                    : "general"
                }
                maxLength={100}
              />
              <div className="cc-form-grid">
                <SelectField
                  label="Publication status"
                  name="status"
                  options={["draft", "published", "withdrawn"]}
                  value={
                    selected ? rowText(selected, "status", "draft") : "draft"
                  }
                />
                <SelectField
                  label="Audience"
                  name="audience"
                  options={["public", "members", "administrators"]}
                  value={
                    selected
                      ? rowText(selected, "audience", "public")
                      : "public"
                  }
                />
                <TextField
                  label="Scheduled start (optional)"
                  name="starts"
                  type="datetime-local"
                  value={localDate(selected?.starts_at)}
                />
                <TextField
                  label="Expiry (optional)"
                  name="expires"
                  type="datetime-local"
                  value={localDate(selected?.expires_at)}
                />
              </div>
            </>
          )}
          <TextField
            label={
              kind === "help"
                ? "Article / FAQ answer"
                : kind === "template"
                  ? "Saved response"
                  : "Description / announcement text"
            }
            name="body"
            type="textarea"
            required={kind !== "editorial"}
            maxLength={kind === "template" ? 10000 : 30000}
            value={selected ? rowText(selected, "body", "") : ""}
          />
          {kind === "editorial" && (
            <>
              <label>
                Hero selection
                <select
                  value={heroMode}
                  onChange={(event) => setHeroMode(event.target.value)}
                >
                  <option value="automatic">
                    Automatic · existing featured selection
                  </option>
                  <option value="manual">
                    Manual · selected canonical titles
                  </option>
                  <option value="hybrid">
                    Hybrid · selected titles plus automatic picks
                  </option>
                </select>
              </label>
              {heroMode !== "automatic" && (
                <div>
                  <h3>Select featured titles</h3>
                  <p className="cc-form-note">
                    The first five selected titles are used in the manual hero.
                  </p>
                  <TitleSelector
                    selected={heroIds}
                    onChange={(values) => setHeroIds(values.slice(0, 5))}
                  />
                </div>
              )}
              <div className="cc-panel-header">
                <h3>Home sections</h3>
                <button
                  type="button"
                  className="cc-button"
                  disabled={sections.length >= 20}
                  onClick={() =>
                    setSections((previous) => [
                      ...previous,
                      {
                        id: crypto.randomUUID(),
                        title: "New section",
                        type: "titles",
                        category: "movie",
                        titleIds: [],
                        collectionIds: [],
                        visible: true,
                        audienceCategories: [],
                        startsAt: null,
                        expiresAt: null,
                      },
                    ])
                  }
                >
                  <Plus size={13} />
                  Add section
                </button>
              </div>
              <p className="cc-form-note">
                Personalized recommendations remain available. Section audience
                rules match the current member’s own category preferences on the
                server.
              </p>
              {sections.map((section, index) => (
                <section className="cc-panel cc-form" key={section.id}>
                  <div className="cc-panel-header">
                    <strong>Section {index + 1}</strong>
                    <div className="cc-actions">
                      <button
                        type="button"
                        className="cc-icon-button"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Move section ${index + 1} up`}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="cc-icon-button"
                        disabled={index === sections.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Move section ${index + 1} down`}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="cc-icon-button"
                        onClick={() =>
                          setSections((previous) =>
                            previous.filter((_, i) => i !== index),
                          )
                        }
                        aria-label={`Remove section ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <label>
                    Section heading
                    <input
                      value={section.title}
                      maxLength={160}
                      required
                      onChange={(event) =>
                        updateSection(index, { title: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Section type
                    <select
                      value={section.type}
                      onChange={(event) =>
                        updateSection(index, { type: event.target.value })
                      }
                    >
                      <option value="titles">Selected titles</option>
                      <option value="category">Automatic category feed</option>
                      <option value="collections">Published collections</option>
                      <option value="personalized">
                        Personalized recommendations
                      </option>
                    </select>
                  </label>
                  {section.type === "titles" && (
                    <TitleSelector
                      selected={section.titleIds}
                      onChange={(titleIds) =>
                        updateSection(index, {
                          titleIds: titleIds.slice(0, 40),
                        })
                      }
                    />
                  )}{" "}
                  {section.type === "category" && (
                    <label>
                      Category
                      <select
                        value={section.category}
                        onChange={(event) =>
                          updateSection(index, { category: event.target.value })
                        }
                      >
                        {categories.map((value) => (
                          <option value={value} key={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {section.type === "collections" && (
                    <label>
                      Published collection IDs (comma separated)
                      <textarea
                        value={section.collectionIds.join(", ")}
                        onChange={(event) =>
                          updateSection(index, {
                            collectionIds: ids(event.target.value).slice(0, 20),
                          })
                        }
                      />
                    </label>
                  )}
                  <label className="cc-inline-check">
                    <input
                      type="checkbox"
                      checked={section.visible}
                      onChange={(event) =>
                        updateSection(index, { visible: event.target.checked })
                      }
                    />
                    Section visible
                  </label>
                  <label>
                    Preference audience (optional category codes)
                    <input
                      value={section.audienceCategories.join(", ")}
                      onChange={(event) =>
                        updateSection(index, {
                          audienceCategories: ids(event.target.value).filter(
                            (value) => categories.includes(value),
                          ),
                        })
                      }
                      placeholder="Blank shows the section to everyone"
                    />
                  </label>
                  <div className="cc-form-grid">
                    <label>
                      Start
                      <input
                        type="datetime-local"
                        value={localDate(section.startsAt)}
                        onChange={(event) =>
                          updateSection(index, {
                            startsAt: event.target.value
                              ? new Date(event.target.value).toISOString()
                              : null,
                          })
                        }
                      />
                    </label>
                    <label>
                      Expiry
                      <input
                        type="datetime-local"
                        value={localDate(section.expiresAt)}
                        onChange={(event) =>
                          updateSection(index, {
                            expiresAt: event.target.value
                              ? new Date(event.target.value).toISOString()
                              : null,
                          })
                        }
                      />
                    </label>
                  </div>
                </section>
              ))}
            </>
          )}
          {kind === "announcement" && (
            <>
              <SelectField
                label="Announcement type"
                name="type"
                options={[
                  "general",
                  "maintenance",
                  "feature",
                  "disruption",
                  "important",
                ]}
                value={
                  selected?.content &&
                  typeof selected.content === "object" &&
                  !Array.isArray(selected.content)
                    ? rowText(selected.content as ControlRow, "type", "general")
                    : "general"
                }
              />
              <label className="cc-inline-check">
                <input
                  type="checkbox"
                  name="banner"
                  defaultChecked={
                    !!(selected?.content as ControlRow | undefined)?.banner
                  }
                />
                Show dismissible banner
              </label>
              <label className="cc-inline-check">
                <input
                  type="checkbox"
                  name="notification"
                  defaultChecked={
                    !!(selected?.content as ControlRow | undefined)
                      ?.notification
                  }
                />
                Deliver an in-app notice through the bounded scheduler
              </label>
              <p className="cc-form-note">
                Optional announcement notifications respect member preferences.
                Scheduled notices become eligible only during their publication
                window.
              </p>
            </>
          )}
          {kind === "template" && selected && (
            <label className="cc-inline-check">
              <input type="checkbox" name="remove" />
              Remove this saved response template
            </label>
          )}
          {kind !== "template" && (
            <>
              <button
                type="button"
                className="cc-button"
                onClick={() => setPreview((value) => !value)}
              >
                <Eye size={14} />
                {preview ? "Hide preview" : "Preview before saving"}
              </button>
              {preview && (
                <div className="cc-draft-preview">
                  <p className="cc-small cc-muted">Unsaved draft preview</p>
                  <h2>{previewTitle || "Untitled draft"}</h2>
                  <div className="cc-article">{previewBody}</div>
                  {kind === "editorial" && (
                    <>
                      <p>
                        Hero: {heroMode} · {heroIds.length} selected titles
                      </p>
                      {sections
                        .filter((section) => section.visible)
                        .map((section) => (
                          <div
                            className="cc-panel"
                            style={{ marginTop: 12 }}
                            key={section.id}
                          >
                            <h3>{section.title}</h3>
                            <p className="cc-small cc-muted">
                              {section.type} ·{" "}
                              {section.type === "titles"
                                ? `${section.titleIds.length} canonical titles`
                                : section.category}
                            </p>
                          </div>
                        ))}
                    </>
                  )}
                </div>
              )}
              <TextField
                label="Documented publication / edit reason"
                name="reason"
                type="textarea"
                required
                maxLength={3000}
              />
              {selected && <DocumentHistory id={rowText(selected, "id")} />}
            </>
          )}
        </div>
      </ActionDialog>
    </>
  );
}
function DocumentHistory({ id }: { id: string }) {
  const [revisions, setRevisions] = useState<ControlRow[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<ControlRow | null>(null);
  return (
    <div>
      <button
        type="button"
        className="cc-button"
        onClick={async () => {
          setError("");
          try {
            const { controlFetch } = await import("@/lib/control/client");
            const data = await controlFetch<{ revisions: ControlRow[] }>(
              "document",
              { id },
            );
            setRevisions(data.revisions);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Revision history unavailable.",
            );
          }
        }}
      >
        <History size={13} />
        Load revision history
      </button>
      {error && <p className="form-error">{error}</p>}
      {revisions.map((revision) => (
        <div
          key={rowText(revision, "id")}
          className="cc-panel"
          style={{ marginTop: 10 }}
        >
          <p className="cc-small">
            Revision {rowText(revision, "version")} ·{" "}
            {dateLabel(revision.created_at)}
          </p>
          <p className="cc-form-note">{rowText(revision, "reason")}</p>
          <button
            type="button"
            className="cc-button"
            onClick={() => setSelected(revision)}
          >
            Review rollback
          </button>
        </div>
      ))}
      <ActionDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Restore publication revision"
        submit={(form) =>
          controlMutation({
            operation: "document_rollback",
            id: rowText(selected ?? {}, "id"),
            reason: formText(form, "reason"),
          })
        }
      >
        <p className="cc-form-note">
          Restoring a revision creates another audited version and checks for
          concurrent changes.
        </p>
        <pre className="cc-json">
          {JSON.stringify(selected?.snapshot, null, 2)}
        </pre>
        <TextField
          label="Rollback reason"
          name="reason"
          type="textarea"
          required
          maxLength={3000}
        />
      </ActionDialog>
    </div>
  );
}
