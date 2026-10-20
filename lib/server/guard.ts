import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowed } from "./access";
import { getSource, isMock } from "./env";

export interface CurrentUser {
  email: string;
  name: string;
}

/** The signed-in Google user (or the fake mock user), without checking authorisation. */
export async function currentUser(): Promise<CurrentUser | null> {
  if (isMock()) {
    const email = process.env.MOCK_USER || "dev@example.test";
    return { email, name: "משתמש בדיקה" };
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return { email: email.toLowerCase(), name: session.user?.name || email };
}

export type Access = { ok: true; user: CurrentUser } | { ok: false; res: NextResponse };

/** Every API route calls this first: session + "shared with the sheet" check, on the server. */
export async function requireUser(): Promise<Access> {
  const user = await currentUser().catch(() => null);
  if (!user) return { ok: false, res: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  try {
    if (!(await isAllowed(getSource(), user.email))) return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  } catch {
    return { ok: false, res: NextResponse.json({ error: "access-check-failed" }, { status: 503 }) };
  }
  return { ok: true, user };
}
