"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
export function ImageUpload({
  name,
  label,
  maxMB,
  initial = null,
  disabled = false,
  initialFile = null,
  onFile,
}: {
  name: string;
  label: string;
  maxMB: number;
  initial?: string | null;
  disabled?: boolean;
  initialFile?: File | null;
  onFile?: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState(initial),
    [error, setError] = useState("");
  const object = useRef<string | null>(null);
  useEffect(() => {
    if (!initialFile) return;
    const restored = URL.createObjectURL(initialFile);
    object.current = restored;
    const timer = window.setTimeout(() => setPreview(restored), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(restored);
    };
  }, [initialFile]);
  useEffect(
    () => () => {
      if (object.current) URL.revokeObjectURL(object.current);
    },
    [],
  );
  return (
    <div className="image-upload">
      <div
        className={`upload-preview ${name === "avatar" ? "avatar-upload-preview" : ""}`}
      >
        {preview ? (
          <Image
            unoptimized
            src={preview}
            alt="Selected image preview"
            fill
            sizes="160px"
          />
        ) : (
          <>
            <ImagePlus size={25} />
            <span>
              {name === "avatar"
                ? "Your profile photo"
                : "Automatic poster collage"}
            </span>
          </>
        )}
      </div>
      <label>
        {label}
        <input
          type="file"
          name={name}
          disabled={disabled}
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setError("");
            if (!file) return;
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
              file.size > maxMB * 1024 * 1024
            ) {
              setError(`Choose a JPG, PNG, or WebP up to ${maxMB} MB.`);
              e.target.value = "";
              return;
            }
            if (object.current) URL.revokeObjectURL(object.current);
            onFile?.(file);
            object.current = URL.createObjectURL(file);
            setPreview(object.current);
          }}
        />
        {initialFile && <small>Restored selection: {initialFile.name}</small>}
        <small>JPG, PNG, or WebP · up to {maxMB} MB</small>
      </label>
      <p className="form-error" role="alert">
        {error}
      </p>
    </div>
  );
}
