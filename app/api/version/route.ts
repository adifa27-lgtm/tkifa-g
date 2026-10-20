import { NextResponse } from "next/server";
import { getSource } from "@/lib/server/env";
import { requireUser } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireUser();
  if (!a.ok) return a.res;
  try {
    return NextResponse.json({ ver: await getSource().modifiedTime() });
  } catch {
    return NextResponse.json({ error: "version-failed" }, { status: 502 });
  }
}
