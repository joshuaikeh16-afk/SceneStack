import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runCatalogCycle } from "@/lib/control/catalog-worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function execute(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    !secret ||
    secret.length < 32 ||
    !token ||
    Buffer.byteLength(token) !== Buffer.byteLength(secret) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  )
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  if (process.env.SCENESTACK_JOBS_ENABLED !== "true")
    return NextResponse.json(
      { message: "Scheduled platform jobs are disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    return NextResponse.json(await runCatalogCycle(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        message: "The bounded job cycle failed. Check authorized diagnostics.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = execute;
export const POST = execute;
