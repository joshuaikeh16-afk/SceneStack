"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  editPersonalCollection,
  loadCollectionPage,
} from "@/app/actions/collections";
import { uploadPersonalImage } from "@/lib/media/cover-upload";
import { unwrap, useProduct, useInvalidateProduct } from "./providers";
import { ProductDialog } from "./dialog";
import { Confirmation } from "./confirmation";
import { ImageUpload } from "./image-upload";
import { UnsavedGuard } from "./unsaved-guard";
import { assetUrl } from "./collection-card";
import type { CollectionDetails } from "@/types/product";
export function EditCollectionDialog({
  data,
  open,
  onOpenChange,
}: {
  data: CollectionDetails;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const c = data.record;
  const { toast, online, bootstrap } = useProduct();
  const client = useQueryClient();
  type Draft = {
    title: string;
    description: string;
    version: number;
    file: File | null;
    spoiler: boolean;
    autoCover: boolean;
    complex: boolean;
  };
  const draftKey = ["collection-draft", bootstrap.userId, c.id];
  const [restored] = useState(() => client.getQueryData<Draft>(draftKey));
  const skipRestoredAutosave = useRef(!!restored);
  const draftEntry = useRef<Draft>(
    restored ?? {
      title: c.title,
      description: c.description,
      version: c.version,
      file: null,
      spoiler: c.spoiler_warning,
      autoCover: false,
      complex: false,
    },
  );
  const [spoiler, setSpoiler] = useState(
      restored?.spoiler ?? c.spoiler_warning,
    ),
    [autoCover, setAutoCover] = useState(restored?.autoCover ?? false);
  const invalidate = useInvalidateProduct();
  const [title, setTitle] = useState(restored?.title ?? c.title),
    [description, setDescription] = useState(
      restored?.description ?? c.description,
    ),
    [status, setStatus] = useState<"saved" | "unsaved" | "saving" | "failed">(
      restored ? "unsaved" : "saved",
    ),
    [dirty, setDirty] = useState(!!restored),
    [complexDirty, setComplexDirty] = useState(restored?.complex ?? false),
    [pending, setPending] = useState(false),
    [discard, setDiscard] = useState(false),
    [error, setError] = useState(
      restored
        ? "An unsaved draft was restored from this signed-in session. Review it, then Save Changes."
        : "",
    );
  const draft = useRef({
      title: restored?.title ?? c.title,
      description: restored?.description ?? c.description,
    }),
    saved = useRef({
      title: c.title,
      description: c.description,
      version: restored?.version ?? c.version,
    }),
    inflight = useRef<Promise<void> | null>(null);
  function keepDraft(patch: Partial<Draft>) {
    skipRestoredAutosave.current = false;
    draftEntry.current = {
      ...draftEntry.current,
      ...patch,
      version: saved.current.version,
    };
    client.setQueryData(draftKey, draftEntry.current);
  }
  function discardDraft() {
    client.removeQueries({ queryKey: draftKey, exact: true });
  }
  async function flush(): Promise<void> {
    if (inflight.current) {
      await inflight.current;
      return flush();
    }
    const values = { ...draft.current };
    if (
      values.title === saved.current.title &&
      values.description === saved.current.description
    )
      return;
    if (!values.title.trim()) throw new Error("A collection needs a name.");
    if (!navigator.onLine) {
      setStatus("failed");
      setError("Reconnect to save your edits. Your text is kept here.");
      throw new Error("Reconnect to save your edits. Your text is kept here.");
    }
    setStatus("saving");
    setError("");
    const work = (async () => {
      try {
        const value = unwrap(
          await editPersonalCollection({
            id: c.id,
            version: saved.current.version,
            patch: values,
          }),
        );
        saved.current = { ...values, version: value.version };
        const remaining =
          draft.current.title !== values.title ||
          draft.current.description !== values.description;
        setDirty(remaining);
        setStatus(
          remaining || draftEntry.current.complex ? "unsaved" : "saved",
        );
        if (remaining || draftEntry.current.complex)
          keepDraft({ ...draft.current, version: value.version });
        else discardDraft();
        await invalidate();
      } catch (error) {
        setStatus("failed");
        setError(
          error instanceof Error
            ? error.message
            : "Your text couldn’t be saved.",
        );
        throw error;
      }
    })();
    inflight.current = work;
    try {
      await work;
    } finally {
      inflight.current = null;
    }
  }
  useEffect(() => {
    if (!open) return;
    if (skipRestoredAutosave.current) return;
    const handle = window.setTimeout(() => {
      void flush().catch(() => {});
    }, 700);
    return () => window.clearTimeout(handle); // Current draft is read only after the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, open]);
  const changed = dirty || complexDirty;
  return (
    <>
      <UnsavedGuard dirty={open && changed} onDiscard={discardDraft} />
      <ProductDialog
        open={open}
        onOpenChange={(value) => {
          if (pending || status === "saving") return;
          if (!value && changed) setDiscard(true);
          else onOpenChange(value);
        }}
        title="Shape your collection."
        description="Name and description save automatically. Cover and spoiler changes use Save Changes."
        className="dialog-medium"
      >
        <form
          className="dialog-body product-form"
          onChange={(e) => {
            const element = e.target;
            if (
              element instanceof HTMLInputElement &&
              ["cover", "autoCover", "spoiler"].includes(element.name)
            )
              setComplexDirty(true);
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setPending(true);
            setError("");
            try {
              await flush();
              if (!navigator.onLine)
                throw new Error("Reconnect to save cover and spoiler changes.");
              let path = c.cover_path;
              const file = draftEntry.current.file ?? form.get("cover");
              if (file instanceof File && file.size) {
                const upload = new FormData();
                upload.set("kind", "collection-cover");
                upload.set("collectionId", c.id);
                upload.set("file", file);
                path = unwrap(await uploadPersonalImage(upload)).path;
              }
              if (autoCover) path = null;
              const result = unwrap(
                await editPersonalCollection({
                  id: c.id,
                  version: saved.current.version,
                  patch: {
                    coverPath: path,
                    spoilerWarning: spoiler,
                  },
                }),
              );
              saved.current.version = result.version;
              discardDraft();
              setComplexDirty(false);
              setDirty(false);
              setStatus("saved");
              await invalidate();
              toast("Collection changes saved.");
              onOpenChange(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Please try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className={`autosave-state ${status}`} role="status">
            {status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "✓ Saved"
                : status === "failed"
                  ? "Failed to save — your text is kept"
                  : "Unsaved changes"}
          </div>
          <label>
            Name <span>{title.length}/160</span>
            <input
              required
              maxLength={160}
              disabled={pending}
              value={title}
              onChange={(e) => {
                draft.current.title = e.target.value;
                keepDraft({ title: e.target.value });
                setTitle(e.target.value);
                setDirty(true);
                setStatus("unsaved");
              }}
            />
          </label>
          <label>
            Description <span>{description.length}/5000</span>
            <textarea
              rows={4}
              maxLength={5000}
              disabled={pending}
              value={description}
              onChange={(e) => {
                draft.current.description = e.target.value;
                keepDraft({ description: e.target.value });
                setDescription(e.target.value);
                setDirty(true);
                setStatus("unsaved");
              }}
            />
          </label>
          {status === "failed" && (
            <div className="autosave-recovery">
              <button
                type="button"
                className="text-link"
                onClick={() => void flush().catch(() => {})}
              >
                Retry text save
              </button>
              <button
                type="button"
                className="text-link"
                onClick={async () => {
                  try {
                    const latest = unwrap(await loadCollectionPage(c.id));
                    if (!latest) throw new Error("Collection unavailable.");
                    saved.current.version = latest.record.version;
                    setError(
                      "Latest version loaded. Review your text, then choose Retry text save to apply it.",
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Please try again.",
                    );
                  }
                }}
              >
                Load latest version
              </button>
            </div>
          )}
          <ImageUpload
            name="cover"
            label="Custom cover"
            maxMB={8}
            initial={
              c.cover_path ? assetUrl("collection-cover", c.cover_path) : null
            }
            disabled={pending}
            initialFile={restored?.file ?? null}
            onFile={(file) => {
              keepDraft({ file, complex: true });
              setComplexDirty(true);
            }}
          />
          {c.cover_path && (
            <label className="check-label">
              <input
                type="checkbox"
                name="autoCover"
                checked={autoCover}
                onChange={(e) => {
                  setAutoCover(e.target.checked);
                  keepDraft({ autoCover: e.target.checked, complex: true });
                  setComplexDirty(true);
                }}
              />
              Use automatic poster collage
            </label>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              name="spoiler"
              checked={spoiler}
              onChange={(e) => {
                setSpoiler(e.target.checked);
                keepDraft({ spoiler: e.target.checked, complex: true });
                setComplexDirty(true);
              }}
            />
            Contains spoilers
          </label>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="button button-primary"
            disabled={pending || !online || status === "saving"}
          >
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </ProductDialog>
      <Confirmation
        connected={false}
        open={discard}
        onOpenChange={setDiscard}
        title="Discard unsaved edits?"
        description="Your last saved version is kept. Text or cover changes that haven’t saved will be lost."
        confirmLabel="Discard edits"
        danger
        onConfirm={async () => {
          discardDraft();
          onOpenChange(false);
        }}
      />
    </>
  );
}
