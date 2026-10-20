/**
 * Synthetic workbook that mimics reference/sheet-structure.md. ALL names, personal numbers,
 * ID numbers, phones and addresses here are invented.
 *
 * Built around 20/10/2026 ("FIXTURE_TODAY") so that alerts, שמ"פ changes and the 7-day window
 * all have content. Cells are strings (FORMATTED_VALUE); a cell may be { f, u } when its
 * unformatted value differs (a real date cell in the header).
 */
import { serialToDmy } from "../sheet/a1";

export type MockCell = string | { f: string; u: string | number };
export type MockGrid = MockCell[][];

export const FIXTURE_TODAY = "2026-10-20";
const START = "2026-09-01";
const END = "2026-11-15";

const pad = (n: number) => String(n).padStart(2, "0");
function addDays(k: string, n: number): string {
  const [y, m, d] = k.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function daysBetween(a: string, b: string): string[] {
  const out: string[] = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}
const DATES = daysBetween(START, END);
const serialOf = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5;
};

/* ---------------- header ---------------- */
const EVENTS: Record<string, string> = {
  "2026-09-01": "סיור מפקדים",
  "2026-09-03": "אימון מפקדים חטיבתי ",
  "2026-09-15": "סיור גזרה פלוגתי",
  "2026-10-20": "תרגיל פלוגתי",
  "2026-10-26": 'ביקור מח"ט',
};
function headerCell(k: string, i: number): MockCell {
  const [y, m, d] = k.split("-");
  const dd = d,
    mm = m;
  if (k === "2026-09-01") return `${dd}/${mm}/${y} \n${EVENTS[k]}`;
  if (k === "2026-09-03") return `${dd}/${mm} \n${EVENTS[k]}`;
  if (k === "2026-09-15") return `${dd}/${mm}\n${EVENTS[k]}`;
  if (k === "2026-10-02") return `${dd}/${mm}/${y} יציאה הביתה`;
  if (k === "2026-10-10") return `${dd}/${mm} בית`;
  // A real date cell: displayed US-style, its serial says 4 October.
  if (k === "2026-10-04") return { f: `${+mm}/${+dd}/${y}`, u: serialOf(k) };
  if (EVENTS[k]) return `${dd}/${mm}/${y}\n${EVENTS[k]}`;
  return i % 2 ? `${dd}/${mm}` : `${dd}/${mm}/${y}`;
}
const FIXED_HEAD = ["מספר", "שם ", "מספר אישי", "צוות", "רישיון צבאי", "הערות חייל", "כמות ימים בבסיס", "סטטוס לקו", "הערות", "עצמאי", "סטודנט", "אישר צו"];
const HEADER: MockCell[] = [...FIXED_HEAD, ...DATES.map(headerCell)];

/* ---------------- roster ---------------- */
type Code = "b" | "1" | "h" | "hh" | "o" | "t" | "a" | "g" | "";
const CELL: Record<Code, string> = { b: "בסיס", "1": "1", h: "בית", hh: "בבית", o: "יציאה הביתה", t: "צו סגור", a: 'חו"ל  - שמ"פ סגור', g: "התארגנות", "": "" };

interface Spec {
  name: string;
  team?: string; // heading rows (no name) set the team; rows with a blank team inherit it
  pid?: string;
  line?: string;
  indep?: string;
  student?: string;
  note?: string;
  note2?: string;
  baseDays?: "blank" | "auto";
  /** start of service; empty cells before. */
  from?: string;
  /** date-range overrides, applied in order: [from, to, code] */
  ov?: [string, string, Code][];
}

/** Default rotation: 9 days base, 1 day יציאה, 4 days home (never more than 7 days away). */
function rotation(k: number, d: string): Code {
  const i = (DATES.indexOf(d) + k * 3) % 14;
  if (i < 9) return k % 3 === 0 ? "1" : "b";
  if (i === 9) return "o";
  return k % 4 === 0 ? "hh" : "h";
}

// Around FIXTURE_TODAY (20/10) every special soldier gets an explicit pattern.
const W0 = "2026-10-08",
  W1 = "2026-10-31";
const window = (rest: [string, string, Code][]): [string, string, Code][] => [[W0, W1, "b"], ...rest];

const SPECS: Spec[] = [
  // חפ"ק — a heading row (no name) carries the team; the rows below inherit it
  { name: "", team: 'חפ"ק' },
  { name: "נועם ברזילי", team: 'חפ"ק', pid: "8100001", ov: window([]) },
  { name: "תומר אלמוג", pid: "8100002", ov: window([]) },
  { name: "יואב קדמון", pid: "8100003", note: "קצין קשר", ov: window([["2026-10-20", "2026-10-20", "g"]]) },
  { name: "רון שקדי", pid: "8100004", line: "התייצבות" },
  { name: "אלעד צור", pid: "8100005", student: "TRUE" },
  { name: "עידן פלג", pid: "8100006" },
  { name: "", team: 'סה"כ' },
  // מפל"ג
  { name: "", team: 'מפל"ג' },
  { name: "שחר ניב", pid: "8100011" },
  { name: "אורן גל", pid: "8100012", indep: "TRUE", note2: "מגיע מאוחר" },
  { name: "דור רימון", pid: "8100013", line: "לבטל צו - שוחרר" },
  { name: "ליאב סהר", pid: "8100014", from: "2026-09-05" },
  { name: 'סה"כ מפל"ג', pid: "" },
  // פת"ן
  { name: "", team: 'פת"ן' },
  { name: "אביב נחום", pid: "8100021", ov: window([["2026-10-19", "2026-10-30", "t"]]) },
  { name: "גלעד עמית", pid: "8100022", ov: window([["2026-10-19", "2026-10-19", "t"]]) },
  { name: "מאור דגן", pid: "8100023", baseDays: "blank" },
  { name: "ניר אופק", pid: "8100024", indep: "לא" },
  // צוות אלון
  { name: "", team: "צוות אלון" },
  { name: "איתמר לבנון", pid: "8100031", ov: window([]) },
  { name: "בועז חרמון", pid: "8100032", ov: window([["2026-10-18", "2026-10-28", "h"]]) },
  { name: "דניאל שגיא", pid: "8100033", ov: window([["2026-10-08", "2026-10-22", "hh"]]) },
  { name: "הראל יפה", pid: "8100034", ov: window([["2026-10-15", "2026-10-21", "h"], ["2026-10-22", "2026-10-31", "t"]]) },
  { name: "זיו מרגלית", pid: "8100035", ov: window([["2026-10-20", "2026-10-20", "a"]]) },
  { name: "חגי סלע", pid: "8100036", student: "TRUE", indep: "TRUE" },
  { name: "טל ורד", pid: "", note: "ללא מספר אישי" },
  // ברק (no "צוות" prefix in the sheet)
  { name: "", team: "ברק" },
  { name: "יהב כרמי", team: "ברק", pid: "8100041", ov: window([]) },
  { name: "כפיר נוי", pid: "8100042", ov: window([["2026-10-12", "2026-10-16", "h"], ["2026-10-17", "2026-10-30", "a"]]) },
  { name: "לביא אור", pid: "8100043", ov: window([["2026-10-23", "2026-10-25", "t"]]) },
  { name: "מתן רז", pid: "8100044", ov: window([["2026-10-20", "2026-10-21", ""]]) },
  { name: "נדב שלו", pid: "8100045", from: "2026-10-20" },
  { name: "סתיו פז", pid: "8100046", baseDays: "blank" },
  { name: "עמית ברק", pid: "8100047" },
  { name: "", team: "" },
  // צוות גפן
  { name: "", team: "צוות גפן" },
  { name: "פלג תמיר", pid: "8100051", ov: window([]) },
  { name: "צביקה הדר", pid: "8100052" },
  { name: "קובי ענבר", pid: "8100053", ov: window([["2026-10-19", "2026-10-19", "t"], ["2026-10-20", "2026-10-31", "b"]]) },
  { name: "רועי נחשון", pid: "8100054" },
  { name: "שי אדר", pid: "8100055", ov: window([["2026-10-20", "2026-10-20", ""]]) },
  { name: "תום גורן", pid: "8100056" },
  // צלפים — every row carries the team explicitly, no heading row
  { name: "אסף לוטן", team: "צלפים", pid: "8100061" },
  { name: "בר יזרעאלי", team: "צלפים", pid: "8100062" },
  { name: "גיל עדן", team: "צלפים", pid: "8100063" },
  { name: "דוד אשל", team: "צלפים", pid: "8100064", line: "שחרור מוקדם" },
];

function planCells(spec: Spec, k: number): Record<string, string> {
  const out: Record<string, string> = {};
  DATES.forEach((d) => {
    let c: Code = spec.from && d < spec.from ? "" : rotation(k, d);
    for (const [a, b, code] of spec.ov || []) if (d >= a && d <= b) c = code;
    out[d] = CELL[c];
  });
  return out;
}

function mainGrid(): MockGrid {
  const rows: MockGrid = [HEADER];
  let k = 0;
  SPECS.forEach((s, idx) => {
    const isSep = !s.name;
    const plan: Record<string, string> = isSep ? {} : planCells(s, k);
    const baseCount = Object.entries(plan).filter(([d, v]) => d <= "2026-10-20" && (v === "בסיס" || v === "1" || v === "יציאה הביתה")).length;
    const fixed = [
      isSep ? "" : String(idx + 1),
      s.name ? s.name + (idx % 5 === 0 ? " " : "") : "",
      s.pid ?? "",
      s.team ?? "",
      isSep ? "" : idx % 2 ? "B" : "C1",
      s.note ?? "",
      isSep ? "" : s.baseDays === "blank" ? "" : String(baseCount),
      s.line ?? (isSep ? "" : "התייצבות"),
      s.note2 ?? "",
      s.indep ?? (isSep ? "" : "FALSE"),
      s.student ?? (isSep ? "" : "FALSE"),
      isSep ? "" : "TRUE",
    ];
    rows.push([...fixed, ...DATES.map((d) => plan[d] ?? "")]);
    if (!isSep) k++;
  });
  return rows;
}

/* ---------------- DATA tab (sensitive columns are fake) ---------------- */
const ROLES: Record<string, string> = {
  "8100001": "מפקד פלוגה",
  "8100002": "סגן מפקד פלוגה",
  "8100004": "נהג",
  "8100005": "חובש",
  "8100006": "לוחם - לא הוזן",
  "8100011": 'ממ',
  "8100021": "טכנאי",
  "8100031": 'מפק"צ',
  "8100033": "נהג סוואנה",
  "8100035": "חובש",
  "8100041": 'מפק"צ',
  "8100051": 'מפק"צ',
  "8100052": "קשר",
  "8100061": "צלף",
};
export const FAKE_SENSITIVE = ["000000018", "רחוב הדוגמה", "1/1/1990", "fake@example.test"];
function dataGrid(): MockGrid {
  const rows: MockGrid = [["רשימת כוח אדם - תקיפה ג׳"], [""], ["ת.ז", "מ.א", "שם", "כתובת", "טלפון נייד", "אימייל", "תאריך לידה", "תפקיד ראשי", "הערות"]];
  SPECS.filter((s) => s.name && s.pid && !/^סה/.test(s.name)).forEach((s, i) => {
    rows.push([i === 0 ? FAKE_SENSITIVE[0] : String(100000000 + i), s.pid!, s.name, `${FAKE_SENSITIVE[1]} ${i + 1}`, "050-0000000", i === 0 ? FAKE_SENSITIVE[3] : "x@example.test", FAKE_SENSITIVE[2], ROLES[s.pid!] ?? "", ""]);
  });
  return rows;
}

/* ---------------- שבצ"ק: two side-by-side blocks ---------------- */
const SHAB_HEAD = ["משימה", "מספר", "שם", "מספר אישי", "צוות", "תפקיד", "רכב", "רישיון צבאי"];
const SHAB: [string, string, string][] = [
  // pid, role, vehicle
  ["8100001", "מ\"פ", "898"],
  ["8100002", "סמ\"פ", "898"],
  ["8100003", 'מפק"צ', "506"], // HQ: must be ignored as a team commander
  ["8100004", "נהג", "898"],
  ["8100021", "", "סוואנה"],
  ["8100022", "", ""],
  ["8100031", 'מפק"צ', "497"],
  ["8100032", "", "497"],
  ["8100034", "", "רכב פרטי"],
  ["8100036", "", ""],
  ["8100041", 'מפק"צ', "207"],
  ["8100043", "", "207"],
  ["8100044", "", "ברלינגו"],
  ["8100047", "", ""],
  ["8100051", 'מפק"צ', "506"],
  ["8100053", "", "506"],
  ["8100054", "", ""],
  ["8100061", "", "סוואנה"],
  ["8100062", "", ""],
];
function shabzakGrid(): MockGrid {
  const name = (pid: string) => SPECS.find((s) => s.pid === pid)?.name ?? "";
  const rows: MockGrid = [['שבצ"ק רכבים'], [...SHAB_HEAD, "", ...SHAB_HEAD]];
  const half = Math.ceil(SHAB.length / 2);
  for (let i = 0; i < half; i++) {
    const a = SHAB[i],
      b = SHAB[i + half];
    const blk = (x?: [string, string, string]) => (x ? ["סיור", String(i + 1), name(x[0]), x[0], "", x[1], x[2], "B"] : ["", "", "", "", "", "", "", ""]);
    rows.push([...blk(a), "", ...blk(b)]);
  }
  return rows;
}

/* ---------------- מסופחים ---------------- */
function attachedGrid(): MockGrid {
  const H = ["Timestamp", "מטרת הבקשה", "שם החייל", "סטטוס", "מ.א", "תפקיד", "מפקד דורש", "האם החייל דיבר עם מפקדיו?", "שם פלוגה", "חוצה גבל", "טלפון", "הערות קישור", "הערות"];
  const r = (purpose: string, name: string, status: string, role: string, company: string, phone: string, link: string) =>
    ["1/9/2026 10:00:00", purpose, name, status, "8200001", role, "מפקד", "כן", company, "לא", phone, link, ""];
  return [
    H,
    r("תגבור", "ישי מנור", "מאושר", "נהג", "תקיפה ג'", "052-1111111", ""),
    r("תגבור", "עוז בלום", "", "לוחם", "תקיפה ג׳", "052-2222222", "ממתין לאישור מח\"ט"),
    r("החלפה", "רז שחם", "לא מאושר", "חובש", "תקיפה  ג", "05/03/2026", ""),
    r("תגבור", "אלון רגב", "נקלט", "", "תקיפה ג'", "", ""),
    r("תגבור", "שגב נור", "", "קשר", "תקיפה ג'", "054-3333333", ""),
    r("תגבור", "יונתן אחר", "מאושר", "לוחם", "תקיפה ב'", "050-4444444", ""),
  ];
}

/* ---------------- _app ---------------- */
export const FIXTURE_ROLES = {
  cmd: ["איתמר לבנון", "יהב כרמי", "פלג תמיר", "יואב קדמון"],
  pakal: { "אלעד צור": "סגן מפקד פלוגה ב'", "יואב קדמון": 'מפק"צ', "חגי סלע": "נהג", "גיל עדן": "צלף" },
};
export const FIXTURE_ALERTS = { breaks: [{ from: "2026-10-01", to: "2026-10-11", label: "יציאה אחרי סיום תרגיל (1/10–11/10)" }] };
function appGrid(): MockGrid {
  return [
    ["roles", JSON.stringify(FIXTURE_ROLES)],
    ["alerts", JSON.stringify(FIXTURE_ALERTS)],
    ["changesFolderId", "fake-folder-id"],
  ];
}

export const FIXTURE_TITLE = "תקיפה ג' - דוגמה (נתונים בדויים)";
export const FIXTURE_ALLOWED = ["dev@example.test", "commander@example.test"];

/** Tab name → grid, in sheet order (includes unused tabs, like the real workbook). */
export function fixtureWorkbook(): Record<string, MockGrid> {
  return {
    "תקיפה ג׳": mainGrid(),
    גיליון15: [["לא בשימוש"]],
    'שבצ"ק': shabzakGrid(),
    מסופחים: attachedGrid(),
    "DATA תקיפה ג": dataGrid(),
    _app: appGrid(),
  };
}

/** Formatted strings only (what FORMATTED_VALUE returns). */
export const formattedGrid = (g: MockGrid): string[][] => g.map((r) => r.map((c) => (typeof c === "string" ? c : c.f)));

/** Grid as the artifact's XLSX reader would see it: real date cells become dd/mm/yyyy. */
export const artifactGrid = (g: MockGrid): string[][] => g.map((r) => r.map((c) => (typeof c === "string" ? c : typeof c.u === "number" ? serialToDmy(c.u) : c.f)));
