import { NextResponse } from "next/server";
import { downloadImage } from "@/lib/data/storage";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ parts: string[] }> },
) {
  const { parts } = await params;
  const [bucket, ...path] = parts;
  try {
    const file = await downloadImage(bucket, path.join("/"));
    if (!file) return new NextResponse(null, { status: 404 });
    const extension = path.at(-1)?.split(".").at(-1);
    const mime =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";
    return new NextResponse(file.stream(), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
