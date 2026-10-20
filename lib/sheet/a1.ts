/** A1-notation helpers. */

/** 0-based column index → letters (0 → A, 25 → Z, 26 → AA). */
export function colLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Letters → 0-based column index. */
export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Quote a tab name for A1 notation: 'name' with inner quotes doubled. */
export const q = (tab: string): string => `'${tab.replace(/'/g, "''")}'`;

/** 'Tab'!B5 — row is 1-based, col is 0-based. */
export const cell = (tab: string, row1: number, col0: number): string => `${q(tab)}!${colLetter(col0)}${row1}`;

/** Google Sheets date serial (days since 1899-12-30) → dd/mm/yyyy. */
export function serialToDmy(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 864e5);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** A plausible date serial (≈ 1954 … 2119). Header cells that hold real dates come back like this unformatted. */
export const isDateSerial = (v: unknown): v is number => typeof v === "number" && v > 20000 && v < 80000;

/**
 * Header row as strings. Cells that are real date values are rewritten as dd/mm/yyyy from their
 * serial, independent of the sheet's display format (like the artifact's XLSX path and writer_()).
 */
export function fixHeader(formatted: unknown[], unformatted: unknown[]): string[] {
  const n = Math.max(formatted.length, unformatted.length);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const u = unformatted[i];
    out.push(isDateSerial(u) ? serialToDmy(u) : String(formatted[i] ?? ""));
  }
  return out;
}
