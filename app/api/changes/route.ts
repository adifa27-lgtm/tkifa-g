import { NextResponse } from "next/server";
import type { Change } from "@/lib/core/types";
import { getSource } from "@/lib/server/env";
import { requireUser } from "@/lib/server/guard";
import { changesBody } from "@/lib/server/schema";
import { applyChanges } from "@/lib/server/writer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await requireUser();
  if (!a.ok) return a.res;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const parsed = changesBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const r = await applyChanges(getSource(), parsed.data.changes as Change[], a.user.email);
    return NextResponse.json(r);
  } catch (e) {
    console.error(JSON.stringify({ ev: "write-error", by: a.user.email, msg: String((e as Error)?.message || e).slice(0, 200) }));
    return NextResponse.json({ error: "write-failed" }, { status: 502 });
  }
}
