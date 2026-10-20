import "server-only";
import type { Permission, SheetSource } from "./source";

const TTL = 5 * 60e3;
let cache: { at: number; src: SheetSource; emails: Set<string> } | null = null;

/** Emails of users and groups the spreadsheet is shared with (any role). "Anyone with the link" grants nothing. */
export function emailsFrom(perms: Permission[]): Set<string> {
  const out = new Set<string>();
  for (const p of perms) {
    if ((p.type === "user" || p.type === "group") && p.emailAddress) out.add(p.emailAddress.trim().toLowerCase());
  }
  return out;
}

export function extraAllowed(): Set<string> {
  return new Set(
    (process.env.EXTRA_ALLOWED_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Authorised = the sheet is shared with this Google account, or it is listed in EXTRA_ALLOWED_EMAILS. */
export async function isAllowed(src: SheetSource, email: string | null | undefined): Promise<boolean> {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  if (!e) return false;
  if (extraAllowed().has(e)) return true;
  if (!cache || cache.src !== src || Date.now() - cache.at > TTL) {
    try {
      cache = { at: Date.now(), src, emails: emailsFrom(await src.permissions()) };
    } catch (err) {
      // Keep using a stale list if Google is briefly unavailable; never grant access on error.
      if (!cache || cache.src !== src) throw err;
    }
  }
  return cache.emails.has(e);
}

export function resetAccessCache() {
  cache = null;
}
