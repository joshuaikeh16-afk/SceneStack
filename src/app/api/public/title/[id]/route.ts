import { NextResponse } from "next/server";
import { getTitleDetails } from "@/lib/product/queries";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/data";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) return new NextResponse(null, { status: 404 });
  try {
    const data = await getTitleDetails(parsed.data);
    if (!data) return new NextResponse(null, { status: 404 });
    const client = await createClient();
    const allowed = client
      ? await client.rpc("public_title_cache_allowed", { p_title: data.id })
      : null;
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-SceneStack-Public-Cache":
          allowed?.data === true ? "allowed" : "disallowed",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Public metadata is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
