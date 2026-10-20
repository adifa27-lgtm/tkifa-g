import { DAYS } from "./constants";

/** Normalise a sheet string: drop quotes/gereshes, collapse whitespace. */
export const norm = (s: unknown): string =>
  String(s || "")
    .replace(/["׳״'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** norm() without any spaces at all. */
export const flat = (u: unknown): string => norm(u).replace(/\s/g, "");

export const pad = (n: number): string => String(n).padStart(2, "0");

/** Local calendar day as YYYY-MM-DD. */
export function todayKey(d: Date = new Date()): string {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function shift(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return todayKey(new Date(y, m - 1, d + n));
}

export function fmtDate(key: string): { short: string; day: string } {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return { short: d + "/" + m + "/" + y, day: "יום " + DAYS[dt.getDay()] };
}

export function fmtShort(k: string): string {
  const [, m, d] = k.split("-").map(Number);
  return d + "/" + m;
}

export function dayDiff(a: string, b: string): number {
  const p = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(b) - p(a)) / 864e5);
}

export function ago(ts: number, now: number = Date.now()): string {
  if (!ts) return "";
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return "הרגע";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.round(h / 24);
  return d === 1 ? "אתמול" : `לפני ${d} ימים`;
}

export const teamName = (n: string): string => (/^צוות/.test(norm(n)) ? n : "צוות " + n);

/** Personal number: strip a trailing ".0" and every non-digit. */
export const pidOf = (v: unknown): string =>
  String(v || "")
    .replace(/\.0+$/, "")
    .replace(/\D/g, "");
