/**
 * Write-cell location: a faithful port of writer_() in reference/apps-script.gs.
 * Row by name in the main tab, date column from the header, vehicle cell by personal number
 * in שבצ"ק, config rows in `_app`. Pure — the caller reads the sheet right before calling.
 */
import { STATUS_SHEET, VEH_SHEET } from "../core/constants";
import type { Change } from "../core/types";
import { norm, pad } from "../core/util";
import { cell, q } from "./a1";

const pid_ = (v: unknown) =>
  String(v == null ? "" : v)
    .replace(/\.0+$/, "")
    .replace(/\D/g, "");

/** Maps every date column in the main tab's header row to "yyyy-mm-dd" (dateColumns_). */
export function dateColumns(header: string[], fallbackYear: number = new Date().getFullYear()): Record<string, number> {
  let year: number | null = null;
  for (const c of header) {
    const m = String(c).match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
    if (m) {
      year = Number(m[3]);
      break;
    }
  }
  if (!year) year = fallbackYear;
  const cols: Record<string, number> = {};
  let lastM: number | null = null;
  header.forEach((c, i) => {
    const m = String(c).match(/(^|[^\d])(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?(?!\d)/);
    if (!m) return;
    const d = Number(m[2]);
    const mo = Number(m[3]);
    const y = m[4] ? (Number(m[4]) < 100 ? 2000 + Number(m[4]) : Number(m[4])) : null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return;
    if (y) year = y;
    else if (lastM && mo < lastM - 6) year!++;
    lastM = mo;
    cols[year + "-" + pad(mo) + "-" + pad(d)] = i;
  });
  return cols;
}

export interface LocatorInput {
  mainTab: string;
  shabzakTab: string | null;
  appTab: string;
  /** Main tab row 1, strings (date cells already converted with fixHeader). */
  header: string[];
  /** Name column values from row 1 down (index 0 = header row). */
  names: unknown[];
  /** Personal-number column values from row 1 down (empty if the column is missing). */
  pids: unknown[];
  /** Whole שבצ"ק grid from A1. */
  shabzak: unknown[][];
  /** `_app` columns A:B from A1. */
  app: unknown[][];
}

export interface CellWrite {
  range: string;
  values: (string | number)[][];
}

export interface Locator {
  nameCol: number;
  pidCol: number;
  dates: Record<string, number>;
  locate(ch: Change): CellWrite | null;
}

export function makeLocator(inp: LocatorInput): Locator {
  const header = inp.header.map((h) => norm(h));
  const nameCol = header.findIndex((h) => h === "שם");
  const pidCol = header.findIndex((h) => h === "מספר אישי");
  const dates = dateColumns(inp.header);
  const rowOf: Record<string, number> = {};
  const pidByName: Record<string, string> = {};
  inp.names.forEach((n, i) => {
    if (i > 0 && n) {
      rowOf[norm(n)] = i;
      if (pidCol >= 0) pidByName[norm(n)] = pid_(inp.pids[i]);
    }
  });

  // שבצ"ק: one or more side-by-side blocks, each with מספר אישי ... רכב
  const vehCell: Record<string, [number, number]> = {};
  const v = inp.shabzak || [];
  const hi = v.findIndex((r) => (r || []).some((c) => norm(c) === "רכב"));
  if (hi >= 0) {
    const h = v[hi].map((c) => norm(c));
    h.forEach((c, i) => {
      if (c !== "מספר אישי") return;
      let vc = -1;
      for (let j = i + 1; j < Math.min(h.length, i + 7); j++)
        if (h[j] === "רכב") {
          vc = j;
          break;
        }
      if (vc < 0) return;
      for (let r = hi + 1; r < v.length; r++) {
        const k = pid_((v[r] || [])[i]);
        if (k.length >= 6) vehCell[k] = [r + 1, vc + 1];
      }
    });
  }

  const appRows = (inp.app || []).map((r) => [...(r || [])]);

  function locate(ch: Change): CellWrite | null {
    if (ch.kind === "status") {
      const r = rowOf[norm(ch.name)];
      const c = dates[ch.date];
      const st = String(ch.status || "");
      if (r == null || c == null || !(st in STATUS_SHEET)) return null;
      return { range: cell(inp.mainTab, r + 1, c), values: [[STATUS_SHEET[st as keyof typeof STATUS_SHEET]]] };
    }
    if (ch.kind === "veh") {
      const pos = vehCell[pidByName[norm(ch.name)]];
      const val = String(ch.veh || "");
      if (!pos || !inp.shabzakTab || !(val in VEH_SHEET)) return null;
      return { range: cell(inp.shabzakTab, pos[0], pos[1] - 1), values: [[VEH_SHEET[val as keyof typeof VEH_SHEET]]] };
    }
    if (ch.kind === "config") {
      if (ch.key !== "roles" && ch.key !== "alerts") return null;
      let row = appRows.findIndex((r) => String(r[0] ?? "") === ch.key);
      if (row < 0) {
        row = appRows.length === 0 || (appRows.length === 1 && !appRows[0][0]) ? 0 : appRows.length;
        appRows[row] = [ch.key, ""];
      }
      const json = JSON.stringify(ch.value == null ? null : ch.value);
      appRows[row][1] = json;
      return { range: `${q(inp.appTab)}!A${row + 1}:B${row + 1}`, values: [[ch.key, json]] };
    }
    return null;
  }

  return { nameCol, pidCol, dates, locate };
}

/** Label used in `skipped` (same as applyChanges_). */
export function skippedLabel(ch: Change): string {
  return ch.kind === "status" ? `${ch.name} ${ch.date}` : ch.kind === "veh" ? `${ch.name} (רכב)` : ch.key;
}
