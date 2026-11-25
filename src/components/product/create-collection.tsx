"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Globe, Layers3 } from "lucide-react";
import { ProductDialog } from "./dialog";
import { ImageUpload } from "./image-upload";
import { uploadPersonalImage } from "@/lib/media/cover-upload";
import {
  createPersonalCollection,
  editPersonalCollection,
} from "@/app/actions/collections";
import { unwrap, useProduct, useInvalidateProduct } from "./providers";
export function CreateCollectionDialog({
  open,
  onOpenChange,
  titleIds = [],
  onCreated,
  navigate = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleIds?: string[];
  onCreated?: (id: string) => void;
  navigate?: boolean;
}) {
  const router = useRouter();
  const { toast, online } = useProduct();
  const invalidate = useInvalidateProduct();
  const [requestId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "published">(
    "private",
  );
  const [spoiler, setSpoiler] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <ProductDialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) onOpenChange(v);
      }}
      title="A universe of your own."
      description="Put a feeling, a theme, or a whole world into a collection."
      className="dialog-medium"
    >
      <form
        className="dialog-body product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setPending(true);
          setError("");
          try {
            const result = unwrap(
              await createPersonalCollection({
                requestId,
                title,
                description,
                visibility: "private",
                spoilerWarning: spoiler,
                titleIds,
              }),
            );
            let coverPath: string | null = null;
            const cover = formData.get("cover");
            try {
              if (cover instanceof File && cover.size) {
                const upload = new FormData();
                upload.set("kind", "collection-cover");
                upload.set("collectionId", result.id);
                upload.set("file", cover);
                coverPath = unwrap(await uploadPersonalImage(upload)).path;
              }
              unwrap(
                await editPersonalCollection({
                  id: result.id,
                  patch: {
                    title,
                    description,
                    visibility,
                    spoilerWarning: spoiler,
                    coverPath,
                  },
                }),
              );
            } catch {
              throw new Error(
                "Your collection exists privately, but its final details couldn’t be saved. Retry to finish it; another collection won’t be created.",
              );
            }
            await invalidate();
            toast("Collection created.");
            onCreated?.(result.id);
            onOpenChange(false);
            if (navigate) router.push(`/collections/${result.id}?edit=1`);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Your collection could not be created.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="new-collection-art">
          <Layers3 size={36} />
          <span>Every good collection starts somewhere.</span>
        </div>
        <label>
          Collection name <span>{title.length}/160</span>
          <input
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your world a name"
            autoComplete="off"
          />
        </label>
        <label>
          Description <span>{description.length}/5000</span>
          <textarea
            maxLength={5000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What ties these stories together?"
          />
        </label>
        <fieldset className="visibility-options">
          <legend>Who can see it?</legend>
          {(["private", "published"] as const).map((v) => (
            <label key={v} className={visibility === v ? "selected" : ""}>
              <input
                type="radio"
                name="visibility"
                value={v}
                checked={visibility === v}
                onChange={() => setVisibility(v)}
              />
              {v === "private" ? <Lock size={18} /> : <Globe size={18} />}
              <span>
                <strong>
                  {v === "private" ? "Just me" : "Publish to members"}
                </strong>
                <small>
                  {v === "private"
                    ? "Your own quiet corner"
                    : "Share your collection and point of view"}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="check-label">
          <input
            type="checkbox"
            checked={spoiler}
            onChange={(e) => setSpoiler(e.target.checked)}
          />
          This collection contains spoilers
        </label>
        <ImageUpload
          name="cover"
          label="Optional custom cover"
          maxMB={8}
          disabled={pending}
        />
        <p className="muted-copy">
          Without an upload, your first titles form the cover collage. Members
          see a notice when spoilers are enabled.
        </p>
        {titleIds.length > 0 && (
          <p className="muted-copy">
            {titleIds.length} selected{" "}
            {titleIds.length === 1 ? "title will" : "titles will"} be added.
          </p>
        )}
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={pending || !title.trim() || !online}
          >
            {pending ? "Creating…" : "Create collection"}
          </button>
        </div>
      </form>
    </ProductDialog>
  );
}
