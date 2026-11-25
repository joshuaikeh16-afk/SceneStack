"use client";
import { createClient } from "@/lib/supabase/client";
import { validatePersonalCover } from "@/app/actions/profile";
import type { ActionReply } from "@/types/product";

/** Keep the 8 MiB file off Vercel's request-body path. Storage still checks JWT/RLS. */
export async function uploadPersonalImage(
  form: FormData,
): Promise<ActionReply<{ bucket: string; path: string }>> {
  try {
    const file = form.get("file"),
      id = form.get("collectionId");
    if (
      form.get("kind") !== "collection-cover" ||
      !(file instanceof File) ||
      typeof id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(id) ||
      file.size < 12 ||
      file.size > 8388608 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "Choose a JPG, PNG, or WebP up to 8 MB.",
      };
    const client = createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user)
      return {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sign in with Google to upload a cover.",
      };
    const extension =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";
    const path = `${data.user.id}/${id}/${crypto.randomUUID()}.${extension}`;
    const bucket = "scenestack-collection-covers";
    const uploaded = await client.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
        cacheControl: "0",
      });
    if (uploaded.error)
      return {
        ok: false,
        code: "UNAVAILABLE",
        message:
          "We couldn’t upload that cover. Your selection has been kept; please try again.",
      };
    const verified = await validatePersonalCover({ collectionId: id, path });
    if (!verified.ok) await client.storage.from(bucket).remove([path]);
    return verified;
  } catch {
    return {
      ok: false,
      code: "UNAVAILABLE",
      message:
        "We couldn’t upload that cover. Your selection has been kept; please try again.",
    };
  }
}
