import { NextResponse } from "next/server";
import { getSource } from "@/lib/server/env";
import { requireUser } from "@/lib/server/guard";
import { readAll } from "@/lib/server/reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireUser();
  if (!a.ok) return a.res;
  try {
    return NextResponse.json(await readAll(getSource()));
  } catch (e) {
    console.error(JSON.stringify({ ev: "data-error", msg: String((e as Error)?.message || e).slice(0, 200) }));
    return NextResponse.json({ error: "read-failed" }, { status: 502 });
  }
}
