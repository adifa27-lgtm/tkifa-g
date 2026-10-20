import { NextResponse } from "next/server";
import { getSource } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public smoke test: only says whether the service account can read the sheet. */
export async function GET() {
  let ok = false;
  try {
    const m = await getSource().meta();
    ok = m.tabs.length > 0;
  } catch {
    ok = false;
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
}
