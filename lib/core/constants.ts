import type { StatusKey, VehKey } from "./types";

export interface StatusDef {
  k: StatusKey;
  n: string;
  c: string;
}

// Order matters: it is the order of chips, legends, table columns and WhatsApp groups.
export const ST: StatusDef[] = [
  { k: "base", n: "בסיס", c: "--s-base" },
  { k: "tzav", n: "צו סגור", c: "--s-tzav" },
  { k: "org", n: "התארגנות", c: "--s-org" },
  { k: "out", n: "יציאה הביתה", c: "--s-out" },
  { k: "home", n: "בבית", c: "--s-home" },
  { k: "abroad", n: 'חו"ל שמ"פ סגור', c: "--s-abroad" },
  { k: "loc", n: "איתור", c: "--s-loc" },
];
export const STMAP: Record<string, StatusDef> = Object.fromEntries(ST.map((s) => [s.k, s]));
export const isStatus = (v: unknown): v is StatusKey => typeof v === "string" && v in STMAP;

export const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export interface VehDef {
  k: VehKey;
  n: string;
}
export const VEH: VehDef[] = [
  { k: "898", n: "האמר 1 · 898" },
  { k: "506", n: "האמר 2 · 506" },
  { k: "497", n: "האמר 3 · 497" },
  { k: "207", n: "האמר 4 · 207" },
  { k: "savana", n: "סוואנה" },
  { k: "berlingo", n: "ברלינגו" },
  { k: "private", n: "רכב פרטי" },
];
export const VEHMAP: Record<string, VehDef> = Object.fromEntries(VEH.map((v) => [v.k, v]));

/** Exact strings written to the sheet (same as STATUS_LABEL in apps-script.gs). */
export const STATUS_SHEET: Record<StatusKey | "", string> = {
  base: "בסיס",
  home: "בית",
  out: "יציאה הביתה",
  tzav: "צו סגור",
  org: "התארגנות",
  abroad: 'חו"ל  - שמ"פ סגור',
  loc: "איתור ", // matches the sheet's dropdown option, trailing space included
  "": "",
};

/** Values written to the שבצ"ק vehicle cell (numbers stay numbers with USER_ENTERED). */
export const VEH_SHEET: Record<VehKey | "", string | number> = {
  "898": 898,
  "506": 506,
  "497": 497,
  "207": 207,
  savana: "סוואנה",
  berlingo: "ברלינגו",
  private: "רכב פרטי",
  "": "",
};

export const ROLE_PRESETS = [
  "מפקד פלוגה",
  "סגן מפקד פלוגה",
  "סגן מפקד פלוגה ב'",
  'מפק"צ',
  "נהג סוואנה",
  "נהג",
  "חובש",
  "לוחם",
  "צלף",
  "קשר",
];

export const TILES: StatusKey[] = ["base", "home", "out", "tzav", "org", "abroad", "loc"];
