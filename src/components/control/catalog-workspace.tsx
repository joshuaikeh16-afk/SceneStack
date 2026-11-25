"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  Search,
  LockKeyhole,
  RefreshCw,
  ArrowLeft,
  History,
  ExternalLink,
} from "lucide-react";
import { controlFetch, dateLabel, rowText } from "@/lib/control/client";
import type { ControlRow, ControlWorkspace } from "@/types/control";
import {
  controlMutation,
  controlProviderSearch,
  controlProviderImport,
  controlRefreshTitles,
} from "@/app/actions/control";
import { useControlIdentity } from "./shell";
import {
  ActionDialog,
  DataTable,
  QueryError,
  SelectField,
  Status,
  TextField,
  formText,
} from "./ui";
import { ProductDialog } from "@/components/product/dialog";
import { unwrap, useProduct } from "@/components/product/providers";

const categories = [
  "movie",
  "anime",
  "series",
  "cartoon",
  "drama",
  "documentary",
];
type TitleData = {
  title: ControlRow;
  aliases: ControlRow[];
  genres: ControlRow[];
  countries: ControlRow[];
  languages: ControlRow[];
  artwork: ControlRow[];
  locks: ControlRow[];
  revisions: ControlRow[];
  mappings: ControlRow[];
};
export function CatalogWorkspace({ data }: { data: ControlWorkspace }) {
  const [mode, setMode] = useState(""),
    [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <div className="cc-actions" style={{ marginBottom: 18 }}>
        <button className="cc-button primary" onClick={() => setMode("new")}>
          <Plus size={14} />
          Create title
        </button>
        <button className="cc-button" onClick={() => setMode("provider")}>
          <Search size={14} />
          Search providers
        </button>
        {selected.length > 0 && (
          <>
            <span className="cc-small cc-muted">
              {selected.length} selected
            </span>
            <button
              className="cc-button"
              disabled={selected.length > 20}
              onClick={() => setMode("refresh")}
            >
              <RefreshCw size={14} />
              Queue refresh
            </button>
            <button
              className="cc-button"
              disabled={selected.length > 20}
              onClick={() => setMode("bulk_category")}
            >
              Edit category
            </button>
            <button className="cc-button" onClick={() => setSelected([])}>
              Clear selection
            </button>
          </>
        )}
      </div>
      <DataTable
        rows={data.rows}
        selection={selected}
        onSelection={setSelected}
        columns={[
          {
            key: "display_title",
            label: "Title",
            render: (row) => (
              <Link
                className="cc-row-title"
                href={`/admin/catalog/${rowText(row, "id")}`}
              >
                {typeof row.poster === "string" && (
                  <Image
                    src={row.poster}
                    width={30}
                    height={45}
                    alt=""
                    unoptimized
                    loading="lazy"
                  />
                )}
                <span>
                  <strong>{rowText(row, "display_title")}</strong>
                  <small>
                    {rowText(row, "id").slice(0, 8)} · {rowText(row, "edition")}
                  </small>
                </span>
              </Link>
            ),
          },
          { key: "kind", label: "Category" },
          { key: "release_year", label: "Year" },
          {
            key: "providers",
            label: "Sources",
            render: (row) => rowText(row, "providers", "Manual"),
          },
          {
            key: "completeness",
            label: "Completeness",
            render: (row) =>
              `${typeof row.completeness === "number" ? row.completeness : 0} / 4 basics`,
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <Status value={row.status} />,
          },
          {
            key: "locked_fields",
            label: "Locks",
            render: (row) => (
              <span>
                <LockKeyhole
                  size={12}
                  style={{ display: "inline", marginRight: 5 }}
                />
                {rowText(row, "locked_fields")}
              </span>
            ),
          },
          {
            key: "last_sync",
            label: "Last sync",
            render: (row) => dateLabel(row.last_sync),
          },
        ]}
      />
      <ActionDialog
        key={mode}
        open={mode === "new" || mode === "refresh" || mode === "bulk_category"}
        onOpenChange={(open) => {
          if (!open) setMode("");
        }}
        title={
          mode === "new"
            ? "Create canonical title"
            : mode === "refresh"
              ? "Queue bounded metadata refresh"
              : "Change selected categories"
        }
        label={
          mode === "refresh" ? "Queue refresh requests" : "Save catalog changes"
        }
        submit={async (form) => {
          if (mode === "refresh") return controlRefreshTitles(selected);
          if (mode === "bulk_category")
            return controlMutation({
              operation: "bulk_category",
              ids: selected,
              category: formText(form, "kind"),
              reason: formText(form, "reason"),
            });
          return controlMutation({
            operation: "title",
            id: null,
            patch: {
              display_title: formText(form, "title"),
              kind: formText(form, "kind"),
              description: formText(form, "description"),
              release_year: formText(form, "year")
                ? Number(formText(form, "year"))
                : null,
              status: formText(form, "status"),
            },
            locks: {},
            reason: formText(form, "reason"),
          });
        }}
      >
        {mode === "new" ? (
          <>
            <TextField label="Title" name="title" required maxLength={300} />
            <SelectField label="Category" name="kind" options={categories} />
            <TextField
              label="Release year (optional)"
              name="year"
              type="number"
            />
            <SelectField
              label="Release status"
              name="status"
              options={[
                "announced",
                "airing",
                "released",
                "ended",
                "unavailable",
              ]}
            />
            <TextField
              label="Synopsis"
              name="description"
              type="textarea"
              maxLength={20000}
            />
            <TextField
              label="Source / documented reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
            <p className="cc-form-note">
              Create only legitimate works with metadata you are authorized to
              use. The new title receives its own stable SceneStack UUID.
            </p>
          </>
        ) : mode === "bulk_category" ? (
          <>
            <p className="cc-form-note">
              Change and lock the category for {selected.length} selected
              canonical titles in one transaction. Other title metadata remains
              intact.
            </p>
            <SelectField
              label="New category"
              name="kind"
              options={categories}
            />
            <TextField
              label="Documented reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
          </>
        ) : (
          <p className="cc-form-note">
            Queue refreshes for {selected.length} selected titles with enabled,
            approved providers. Processing requires the trusted metadata worker.
            Manual locks remain protected.
          </p>
        )}
      </ActionDialog>
      <ProviderSearch
        open={mode === "provider"}
        onOpenChange={(open) => {
          if (!open) setMode("");
        }}
      />
    </>
  );
}
function ProviderSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [source, setSource] = useState("tmdb.movie"),
    [q, setQ] = useState(""),
    [items, setItems] = useState<ControlRow[]>([]),
    [next, setNext] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<ControlRow | null>(null);
  const { toast } = useProduct();
  const router = useRouter();
  const client = useQueryClient();
  async function search(page = 0) {
    setPending(true);
    setError("");
    try {
      const data = unwrap(await controlProviderSearch({ source, q, page }));
      setItems((previous) =>
        page === 0
          ? (data.items as unknown as ControlRow[])
          : [
              ...new Map(
                [...previous, ...(data.items as unknown as ControlRow[])].map(
                  (row) => [`${row.media}:${row.externalId}`, row],
                ),
              ).values(),
            ],
      );
      setNext(data.next);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Provider search failed.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <ProductDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search provider metadata"
      className="cc-dialog"
    >
      {!selected ? (
        <>
          <form
            className="cc-form"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <label>
              Provider / media
              <select
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setItems([]);
                  setNext(null);
                }}
              >
                <option value="tmdb.movie">
                  TMDB · Movies, cartoons, documentaries
                </option>
                <option value="tmdb.tv">TMDB · TV, dramas, animation</option>
                <option value="myanimelist.anime">MyAnimeList · Anime</option>
              </select>
            </label>
            <label>
              Title query
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <button
              className="cc-button primary"
              disabled={pending || q.trim().length < 2}
            >
              {pending ? "Searching…" : "Search enabled provider"}
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}
          <div className="cc-stack" style={{ marginTop: 18 }}>
            {items.map((item) => (
              <div
                className="cc-panel"
                key={`${item.media}:${item.externalId}`}
              >
                <strong>{rowText(item, "title")}</strong>
                <p className="cc-small cc-muted">
                  {rowText(item, "kind")} · {rowText(item, "year")} · Provider
                  ID {rowText(item, "externalId")}
                </p>
                <button className="cc-button" onClick={() => setSelected(item)}>
                  Preview import
                </button>
              </div>
            ))}
          </div>
          {next !== null && (
            <button
              className="cc-button"
              disabled={pending}
              onClick={() => void search(next)}
            >
              Load next provider page
            </button>
          )}
        </>
      ) : (
        <div className="cc-form">
          <h2>{rowText(selected, "title")}</h2>
          <p className="cc-form-note">
            {rowText(selected, "kind")} · {rowText(selected, "year")} · {source}{" "}
            / {rowText(selected, "externalId")}
          </p>
          <p className="cc-detail-copy">
            {rowText(selected, "description", "")}
          </p>
          <p className="cc-warning">
            Confirm the work’s identity before importing. Existing provider IDs
            reuse their canonical title. Public-release gates remain
            authoritative.
          </p>
          {error && <p className="form-error">{error}</p>}
          <div className="cc-actions">
            <button
              className="cc-button"
              disabled={pending}
              onClick={() => setSelected(null)}
            >
              Back to search
            </button>
            <button
              className="cc-button primary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const canonical = unwrap(
                    await controlProviderImport({
                      source,
                      externalId: rowText(selected, "externalId"),
                    }),
                  );
                  await client.invalidateQueries({ queryKey: ["control"] });
                  toast("Provider metadata imported into its canonical title.");
                  onOpenChange(false);
                  if (typeof canonical === "string")
                    router.push(`/admin/catalog/${canonical}`);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Import failed; no publication was confirmed.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Importing…" : "Confirm canonical import"}
            </button>
          </div>
        </div>
      )}
    </ProductDialog>
  );
}

export function TitleEditor({ id }: { id: string }) {
  const identity = useControlIdentity();
  const [mode, setMode] = useState(""),
    [revision, setRevision] = useState<ControlRow | null>(null);
  const query = useQuery({
    queryKey: ["control-title", identity.userId, id],
    queryFn: ({ signal }) => controlFetch<TitleData>("title", { id }, signal),
  });
  if (query.isPending)
    return (
      <div
        className="cc-skeleton"
        role="status"
        aria-label="Loading title metadata"
      />
    );
  if (query.isError)
    return (
      <QueryError
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data,
    title = data.title;
  const lists: Record<string, unknown> = {
    aliases: data.aliases.map((row) => row.name),
    genres: data.genres.flatMap((row) =>
      row.genres && typeof row.genres === "object" && !Array.isArray(row.genres)
        ? [(row.genres as ControlRow).name]
        : [],
    ),
    countries: data.countries.map((row) => row.country_code),
    languages: data.languages.map((row) => row.language_code),
  };
  const baseline: Record<string, unknown> = {
    ...title,
    ...lists,
    poster: data.artwork.find((row) => row.kind === "poster")?.url ?? null,
    backdrop: data.artwork.find((row) => row.kind === "backdrop")?.url ?? null,
  };
  const fields = [
    "display_title",
    "original_title",
    "kind",
    "edition",
    "status",
    "release_year",
    "release_date",
    "runtime_minutes",
    "age_rating",
    "description",
    "aliases",
    "genres",
    "countries",
    "languages",
    "poster",
    "backdrop",
  ];
  function fieldInput(field: string) {
    const value = baseline[field];
    if (field === "kind")
      return (
        <SelectField
          label="Category"
          name={field}
          options={categories}
          value={String(value)}
        />
      );
    if (field === "status")
      return (
        <SelectField
          label="Publication / release status"
          name={field}
          options={["announced", "airing", "released", "ended", "unavailable"]}
          value={String(value)}
        />
      );
    if (field === "edition")
      return (
        <SelectField
          label="Edition"
          name={field}
          options={["standalone", "series", "season", "special"]}
          value={String(value)}
        />
      );
    return (
      <TextField
        label={
          (
            {
              display_title: "Display title",
              original_title: "Original title",
              release_year: "Release year",
              release_date: "Release date",
              runtime_minutes: "Runtime (minutes)",
              age_rating: "Age classification",
              description: "Synopsis",
              aliases: "Alternative titles (one per line)",
              genres: "Genres (comma separated)",
              countries: "Country codes (comma separated)",
              languages: "Language codes (comma separated)",
              poster: "Approved poster URL",
              backdrop: "Approved backdrop URL",
            } as Record<string, string>
          )[field] || field
        }
        name={field}
        value={
          Array.isArray(value)
            ? value.join(field === "aliases" ? "\n" : ", ")
            : typeof value === "string" || typeof value === "number"
              ? value
              : ""
        }
        type={
          ["description", "aliases"].includes(field)
            ? "textarea"
            : ["release_year", "runtime_minutes"].includes(field)
              ? "number"
              : field === "release_date"
                ? "date"
                : "text"
        }
        maxLength={
          field === "description" ? 20000 : field === "aliases" ? 30000 : 2000
        }
        required={field === "display_title"}
      />
    );
  }
  return (
    <>
      <div className="cc-page-heading">
        <div>
          <Link className="cc-small cc-muted" href="/admin/catalog">
            <ArrowLeft size={12} style={{ display: "inline" }} /> Catalog
          </Link>
          <h1 style={{ marginTop: 10 }}>{rowText(title, "display_title")}</h1>
          <p>{id} · Canonical identity</p>
        </div>
        <div className="cc-actions">
          <Link className="cc-button" href={`/titles/${id}`}>
            <ExternalLink size={14} />
            View title
          </Link>
          {title.status !== "merged" && (
            <button
              className="cc-button primary"
              onClick={() => setMode("edit")}
            >
              Edit metadata & locks
            </button>
          )}
          {title.status === "merged" && (
            <button className="cc-button" onClick={() => setMode("split")}>
              Split reviewed merge
            </button>
          )}
        </div>
      </div>
      <div className="cc-two-column">
        <div className="cc-stack">
          <section className="cc-panel">
            <h2>Canonical metadata</h2>
            <dl className="cc-detail-facts">
              {[
                "kind",
                "edition",
                "release_year",
                "status",
                "release_date",
                "runtime_minutes",
                "age_rating",
              ].map((field) => (
                <div key={field} style={{ display: "contents" }}>
                  <dt>{field.replaceAll("_", " ")}</dt>
                  <dd>{rowText(title, field)}</dd>
                </div>
              ))}
            </dl>
            <p className="cc-detail-copy" style={{ marginTop: 20 }}>
              {rowText(title, "description", "")}
            </p>
            {Object.entries(lists).map(([key, value]) => (
              <p className="cc-small cc-muted" key={key}>
                {key}: {Array.isArray(value) ? value.join(", ") : "—"}
              </p>
            ))}
          </section>
          <section className="cc-panel">
            <h2>
              <History
                size={15}
                style={{ display: "inline", marginRight: 6 }}
              />
              Metadata revisions
            </h2>
            <DataTable
              rows={data.revisions}
              columns={[
                { key: "reason", label: "Reason" },
                {
                  key: "created_at",
                  label: "Recorded",
                  render: (row) => dateLabel(row.created_at),
                },
                {
                  key: "action",
                  label: "",
                  render: (row) => (
                    <button
                      className="cc-button"
                      disabled={!row.previous_state}
                      onClick={() => {
                        setRevision(row);
                        setMode("rollback");
                      }}
                    >
                      Review rollback
                    </button>
                  ),
                },
              ]}
            />
          </section>
        </div>
        <aside className="cc-stack">
          <section className="cc-panel">
            <h2>Provider mappings</h2>
            {data.mappings.length ? (
              data.mappings.map((row) => (
                <div key={rowText(row, "id")}>
                  <p className="cc-small">
                    {rowText(row, "external_type")} /{" "}
                    {rowText(row, "external_id")}
                  </p>
                  <small className="cc-muted">
                    Provider {rowText(row, "provider_id")}
                  </small>
                </div>
              ))
            ) : (
              <p className="cc-muted cc-small">
                Manually created title. No provider mapping.
              </p>
            )}
          </section>
          <section className="cc-panel">
            <h2>Protected fields</h2>
            {data.locks.filter((row) => row.locked).length ? (
              data.locks
                .filter((row) => row.locked)
                .map((row) => (
                  <p className="cc-small" key={rowText(row, "field_name")}>
                    <LockKeyhole
                      size={12}
                      style={{ display: "inline", marginRight: 6 }}
                    />
                    {rowText(row, "field_name").replaceAll("_", " ")}
                  </p>
                ))
            ) : (
              <p className="cc-muted cc-small">No explicit field locks.</p>
            )}
            <p className="cc-form-note">
              Provider synchronization cannot overwrite locked scalar metadata,
              genres, aliases, countries, languages, or artwork.
            </p>
          </section>
        </aside>
      </div>
      <ActionDialog
        key={mode + rowText(revision ?? {}, "id")}
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) setMode("");
        }}
        title={
          mode === "edit"
            ? "Edit canonical metadata"
            : mode === "rollback"
              ? "Restore metadata revision"
              : "Split reviewed merge"
        }
        description={
          mode === "edit"
            ? "Editing a field checks its lock automatically. You can explicitly unlock it before saving. Unsupported artwork sources are rejected."
            : undefined
        }
        submit={async (form) => {
          if (mode === "rollback")
            return controlMutation({
              operation: "title_rollback",
              id: rowText(revision ?? {}, "id"),
              reason: formText(form, "reason"),
            });
          if (mode === "split")
            return controlMutation({
              operation: "split",
              id,
              reason: formText(form, "reason"),
            });
          const patch: Record<string, unknown> = {},
            locks: Record<string, boolean> = {};
          for (const field of fields) {
            let value: unknown = formText(form, field);
            if (["aliases", "genres", "countries", "languages"].includes(field))
              value = String(value)
                .split(field === "aliases" ? "\n" : ",")
                .map((value) => value.trim())
                .filter(Boolean);
            else if (["release_year", "runtime_minutes"].includes(field))
              value = value ? Number(value) : null;
            else if (
              [
                "original_title",
                "release_date",
                "poster",
                "backdrop",
                "age_rating",
              ].includes(field) &&
              !value
            )
              value = null;
            if (
              JSON.stringify(value) !== JSON.stringify(baseline[field] ?? null)
            )
              patch[field] = value;
            const locked = form.get(`lock:${field}`) === "on";
            const existing =
              data.locks.find((row) => row.field_name === field)?.locked ===
              true;
            if (locked !== existing || field in patch) locks[field] = locked;
          }
          return controlMutation({
            operation: "title",
            id,
            patch,
            locks,
            reason: formText(form, "reason"),
          });
        }}
      >
        {mode === "edit" ? (
          <>
            <div
              onInput={(event) => {
                const target = event.target as HTMLInputElement;
                const name = target.name;
                if (fields.includes(name)) {
                  const lock = target.form?.elements.namedItem(`lock:${name}`);
                  if (lock instanceof HTMLInputElement) lock.checked = true;
                }
              }}
              className="cc-form"
            >
              {fields.map((field) => (
                <div key={field}>
                  {fieldInput(field)}
                  <label className="cc-inline-check" style={{ marginTop: 7 }}>
                    <input
                      type="checkbox"
                      name={`lock:${field}`}
                      defaultChecked={
                        data.locks.find((row) => row.field_name === field)
                          ?.locked === true
                      }
                    />
                    Lock {field.replaceAll("_", " ")}
                  </label>
                </div>
              ))}
            </div>
            <TextField
              label="Documented edit reason"
              name="reason"
              type="textarea"
              required
              maxLength={3000}
            />
          </>
        ) : (
          <>
            {mode === "rollback" && (
              <div className="cc-comparison">
                <div>
                  <small>Current</small>
                  <pre>{JSON.stringify(baseline, null, 2)}</pre>
                </div>
                <div>
                  <small>Restore</small>
                  <pre>{JSON.stringify(revision?.previous_state, null, 2)}</pre>
                </div>
              </div>
            )}
            {mode === "split" && (
              <p className="cc-warning">
                Restore the source identity and prior redirect graph from its
                reviewed merge revision. Existing user records were retained and
                will resolve to their original title again.
              </p>
            )}
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
