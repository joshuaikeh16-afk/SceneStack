import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { dataContext } from "./context";
import { DataAccessError, result } from "./errors";
import { idSchema, storagePathSchema } from "@/lib/validation/data";

const formats = {
  "image/jpeg": {
    extension: "jpg",
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    matches: (bytes: Uint8Array) =>
      [137, 80, 78, 71, 13, 10, 26, 10].every(
        (value, index) => bytes[index] === value,
      ),
  },
  "image/webp": {
    extension: "webp",
    matches: (bytes: Uint8Array) =>
      Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
      Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP",
  },
};
export async function uploadImage(input: {
  kind: "avatar" | "profile-cover" | "collection-cover";
  collectionId?: string;
  file: File;
}) {
  const kind = z
      .enum(["avatar", "profile-cover", "collection-cover"])
      .parse(input.kind),
    collectionId =
      kind === "collection-cover" ? idSchema.parse(input.collectionId) : null;
  const { client, user } = await dataContext();
  const maxBytes = kind === "collection-cover" ? 8388608 : 3145728;
  if (
    !(input.file instanceof File) ||
    input.file.size < 12 ||
    input.file.size > maxBytes ||
    !Object.hasOwn(formats, input.file.type)
  )
    throw new DataAccessError(
      "INVALID_INPUT",
      "Choose a JPG, PNG, or WebP within the upload size limit.",
    );
  const format = formats[input.file.type as keyof typeof formats];
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  if (!format.matches(bytes))
    throw new DataAccessError(
      "INVALID_INPUT",
      "The image content does not match its file type.",
    );
  const bucket =
    kind === "collection-cover"
      ? "scenestack-collection-covers"
      : "scenestack-avatars";
  const path = `${user.id}/${collectionId ? `${collectionId}/` : ""}${randomUUID()}.${format.extension}`;
  await result(
    client.storage.from(bucket).upload(path, bytes, {
      contentType: input.file.type,
      upsert: false,
      cacheControl: "0",
    }),
  );
  return { bucket, path };
}
export async function validateUploadedCover(input: unknown) {
  const v = z
    .object({ collectionId: idSchema, path: storagePathSchema })
    .strict()
    .parse(input);
  const { client, user } = await dataContext();
  if (!v.path.startsWith(`${user.id}/${v.collectionId}/`))
    throw new DataAccessError(
      "FORBIDDEN",
      "This cover does not belong to your collection.",
    );
  const collection = await result(
    client
      .from("collections")
      .select("id")
      .eq("id", v.collectionId)
      .eq("owner_id", user.id)
      .is("removed_at", null)
      .single(),
  );
  if (!collection)
    throw new DataAccessError("FORBIDDEN", "This collection is unavailable.");
  const bucket = "scenestack-collection-covers";
  // Download with the current owner's JWT, never the service role or a public URL.
  const file = await result(client.storage.from(bucket).download(v.path));
  if (
    !file ||
    file.size < 12 ||
    file.size > 8388608 ||
    !Object.hasOwn(formats, file.type)
  )
    throw new DataAccessError(
      "INVALID_INPUT",
      "Choose a JPG, PNG, or WebP up to 8 MB.",
    );
  const format = formats[file.type as keyof typeof formats];
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!format.matches(bytes) || !v.path.endsWith(`.${format.extension}`))
    throw new DataAccessError(
      "INVALID_INPUT",
      "The image content does not match its file type.",
    );
  return { bucket, path: v.path };
}
/** Downloads use the caller's JWT on every request. Do not turn these into public/signed URLs. */
export async function downloadImage(bucket: unknown, path: unknown) {
  const name = z
      .enum(["scenestack-avatars", "scenestack-collection-covers"])
      .parse(bucket),
    key = storagePathSchema.parse(path);
  const { client } = await dataContext();
  return result(client.storage.from(name).download(key));
}
export async function removeImage(bucket: unknown, path: unknown) {
  const name = z
      .enum(["scenestack-avatars", "scenestack-collection-covers"])
      .parse(bucket),
    key = storagePathSchema.parse(path);
  const { client } = await dataContext();
  await result(client.storage.from(name).remove([key]));
}
