/**
 * Sheet parsing: a faithful TypeScript port of the artifact's statusOf / colDates / extract /
 * joinExtras / parseAttached (reference/artifact-app.html). Same behaviour, same edge cases.
 * Input grids are formatted cell strings (FORMATTED_VALUE), row-major.
 */
import { VEHMAP } from "../core/constants";
import type { AlertsConfig, AppConfig, AttachedRow, RolesConfig, Soldier, StatusKey, VehKey } from "../core/types";
import { norm, pad, pidOf } from "../core/util";

export type Grid = string[][];

export function statusOf(v: unknown): StatusKey | null {
  const t = norm(v);
  if (!t) return null;
  if (t === "1") return "base";
  if (t.includes("איתור")) return "loc";
  if (t.includes("צו סגור")) return "tzav";
  if (t.includes("חול")) return "abroad";
  if (t.includes("התארגנות")) return "org";
  if (t.includes("יציאה")) return "out";
  if (t === "בית" || t === "בבית") return "home";
  if (t.includes("בסיס")) return "base";
  return null;
}

const HEB_M = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export interface ColDate {
  key: string;
  label: string;
}

/** Maps each header cell to a date key (or null) plus the event label written after the date. */
export function colDates(h: unknown[]): (ColDate | null)[] {
  const ex = h.map((c) => String(c ?? "").match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/)).find(Boolean);
  let y = ex ? +ex[3] : new Date().getFullYear();
  let lastM: number | null = null;
  return h.map((cell) => {
    const c = String(cell || "");
    let d = 0;
    let mo = 0;
    let yy: number | null = null;
    let label = "";
    let m = c.match(/(^|[^\d])(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?(?!\d)/);
    if (m) {
      d = +m[2];
      mo = +m[3];
      if (m[4]) yy = +m[4] < 100 ? 2000 + +m[4] : +m[4];
      label = c.slice((m.index ?? 0) + m[0].length);
    } else if ((m = c.match(new RegExp(`(\\d{1,2}) ב(${HEB_M.join("|")})`)))) {
      d = +m[1];
      mo = HEB_M.indexOf(m[2]) + 1;
    }
    if (!d || !mo || mo > 12 || d > 31) return null;
    if (yy) y = yy;
    else if (lastM && mo < lastM - 6) y++;
    lastM = mo;
    return { key: `${y}-${pad(mo)}-${pad(d)}`, label: label.replace(/\s+/g, " ").trim() };
  });
}

const yes = (v: string) => !!v && !/^(0|לא|false|no)$/i.test(v);

export type RosterRow = Omit<Soldier, "id" | "pakal" | "cmd" | "sheetVeh" | "shab"> &
  Partial<Pick<Soldier, "pakal" | "cmd" | "sheetVeh" | "shab">>;

export function extract(grid: Grid): { rows: RosterRow[]; events: Record<string, string> } {
  const hi = grid.findIndex((r) => r.some((c) => /^(צוות|מחלקה)$/.test(norm(c))) && r.some((c) => /^שם( פרטי)?$/.test(norm(c))));
  if (hi < 0) return { rows: [], events: {} };
  const raw = grid[hi];
  const h = raw.map(norm);
  const col = (re: RegExp) => h.findIndex((c) => re.test(c));
  const iP = col(/^(מספר אישי|מ א|מא)$/),
    iBD = col(/^כמות ימים בבסיס$/),
    iF = col(/^שם פרטי$/),
    iL = col(/^שם משפחה$/),
    iN = col(/^שם$/),
    iU = col(/^(צוות|מחלקה)$/),
    iA = col(/סטטוס הגעה|^הגעה$/),
    iS = col(/^סטודנט$/),
    iI = col(/^עצמאי$/),
    iLine = col(/^סטטוס לקו$/);
  const iNotes = h.map((c, i) => (/^הערות?( חייל)?$|חשוב שנדע/.test(c) ? i : -1)).filter((i) => i >= 0);
  const dates = colDates(raw)
    .map((d, i) => (d && i > Math.max(iU, iN, iL) ? { ...d, i } : null))
    .filter((d): d is ColDate & { i: number } => !!d);
  const events: Record<string, string> = {};
  dates.forEach((d) => {
    if (d.label && !/^(בית|יציאה הביתה)$/.test(d.label)) events[d.key] = d.label;
  });
  const rows: RosterRow[] = [];
  const uo: Record<string, number> = {};
  const ord: Record<string, number> = {};
  let last: string | null = null;
  grid.slice(hi + 1).forEach((r) => {
    const g = (i: number) => (i >= 0 ? String(r[i] ?? "").replace(/\s+/g, " ").trim() : "");
    const name = [iN >= 0 ? g(iN) : "", g(iF), g(iL)].filter(Boolean).join(" ").trim();
    const u = g(iU);
    if (!name) {
      if (u && !/סה.?כ/.test(norm(u))) last = u;
      return;
    }
    if (/^סה.?כ/.test(norm(name))) return;
    if (/^לבטל צו/.test(norm(g(iLine)))) return;
    const unit = u || last;
    if (!unit) return;
    const uk = norm(unit);
    if (!(uk in uo)) uo[uk] = Object.keys(uo).length;
    ord[uk] = (ord[uk] || 0) + 1;
    const plan: Record<string, StatusKey> = {};
    dates.forEach((d) => {
      const st = statusOf(g(d.i));
      if (st) plan[d.key] = st;
    });
    const homeDays = Object.values(plan).filter((v) => v === "home").length;
    const bd = parseInt(g(iBD), 10);
    rows.push({
      pid: g(iP).replace(/\D/g, ""),
      name,
      unit,
      unitOrder: uo[uk],
      order: ord[uk],
      baseDays: Number.isFinite(bd) ? bd : Object.values(plan).filter((v) => v === "base" || v === "out").length,
      homeDays,
      arriving: !/^לא מגיע/.test(norm(g(iA))),
      student: yes(g(iS)),
      indep: yes(g(iI)),
      line: g(iLine),
      note: [...new Set(iNotes.map(g).filter(Boolean))].join(" · "),
      plan,
    });
  });
  return { rows, events };
}

export function headerAt(grid: Grid, test: (h: string[]) => boolean, maxRows = 8): number {
  for (let i = 0; i < Math.min(grid.length, maxRows); i++) {
    const h = (grid[i] || []).map(norm);
    if (test(h)) return i;
  }
  return -1;
}

/** Index of the DATA tab's personal-number column inside a normalised header row. */
export const dataPidCol = (h: string[]) => h.findIndex((c) => /^(מ\.?א|מספר אישי)$/.test(c));

/** Joins פק"ל (DATA tab) and vehicle / team-commander flag (שבצ"ק tab) by personal number. */
export function joinExtras(rows: RosterRow[], grids: { data?: Grid; shabzak?: Grid }): { matched: number } {
  const data: Record<string, string> = {};
  const dg = grids.data || [];
  const dh = headerAt(dg, (h) => h.includes("תפקיד ראשי"));
  if (dh >= 0) {
    const h = dg[dh].map(norm);
    const iP = dataPidCol(h);
    const iR = h.indexOf("תפקיד ראשי");
    dg.slice(dh + 1).forEach((r) => {
      const k = pidOf(r[iP]);
      if (k) data[k] = String(r[iR] || "").trim();
    });
  }
  const sh: Record<string, { role: string; veh: string }> = {};
  const sg = grids.shabzak || [];
  const shh = headerAt(sg, (h) => h.includes("רכב"));
  if (shh >= 0) {
    const h = sg[shh].map(norm);
    h.forEach((c, iP) => {
      if (c !== "מספר אישי") return;
      const next = (re: RegExp) => {
        for (let j = iP + 1; j < h.length && j < iP + 7; j++) if (re.test(h[j])) return j;
        return -1;
      };
      const iR = next(/^תפקיד$/);
      const iV = next(/^רכב$/);
      sg.slice(shh + 1).forEach((r) => {
        const k = pidOf(r[iP]);
        if (k.length >= 6) sh[k] = { role: String(r[iR] ?? "").trim(), veh: String(r[iV] ?? "").trim() };
      });
    });
  }
  rows.forEach((r) => {
    const d = data[r.pid] || "";
    const x = sh[r.pid] || { role: "", veh: "" };
    r.pakal = d && !/לא הוזן/.test(d) ? d : "";
    r.cmd = norm(r.pakal) === "ממ" || /מפקצ/.test(norm(x.role));
    const v = String(x.veh || "").replace(/\.0+$/, "");
    r.sheetVeh = (
      VEHMAP[v] ? v : /סוואנה|savana/i.test(v) ? "savana" : /ברלינגו|berlingo/i.test(v) ? "berlingo" : /פרטי/.test(v) ? "private" : ""
    ) as VehKey | "";
    r.shab = !!sh[r.pid];
  });
  return { matched: rows.filter((r) => data[r.pid]).length };
}

export function parseAttached(grid: Grid): AttachedRow[] | null {
  const hi = headerAt(grid, (h) => h.includes("שם החייל"), 10);
  if (hi < 0) return null;
  const h = grid[hi].map(norm);
  const col = (re: RegExp) => h.findIndex((c) => re.test(c));
  const iN = col(/^שם החייל$/),
    iPu = col(/^מטרת הבקשה$/),
    iS = col(/^סטטוס$/),
    iL = col(/^הערות קישור$/),
    iR = col(/^תפקיד$/),
    iU = col(/^(מחלקה|צוות)$/),
    iCo = col(/^שם פלוגה$/),
    iPh = col(/^טלפון$/);
  const g = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? "").replace(/\s+/g, " ").trim() : "");
  const phone = (v: string) => (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) ? "" : v);
  const ours = (r: string[]) => iCo < 0 || norm(g(r, iCo)).replace(/\s/g, "") === "תקיפהג";
  return grid
    .slice(hi + 1)
    .filter((r) => g(r, iN) && ours(r))
    .map((r) => ({
      name: g(r, iN),
      purpose: g(r, iPu),
      status: g(r, iS) || g(r, iL),
      role: g(r, iR),
      unit: g(r, iU),
      phone: phone(g(r, iPh)),
    }));
}

export const CONFIG_KEYS = ["roles", "alerts"] as const;

/** `_app` tab: column A = key, column B = JSON. Unknown keys / bad JSON are ignored. */
export function parseConfig(grid: Grid): AppConfig {
  const out: AppConfig = { roles: null, alerts: null };
  (grid || []).forEach((r) => {
    const k = String(r?.[0] ?? "");
    if (k !== "roles" && k !== "alerts") return;
    try {
      const v = JSON.parse(String(r[1] ?? ""));
      if (k === "roles") out.roles = v as RolesConfig;
      else out.alerts = v as AlertsConfig;
    } catch {
      /* ignore malformed config */
    }
  });
  return out;
}

export interface Grids {
  main: Grid;
  data?: Grid;
  shabzak?: Grid;
  attached?: Grid;
  app?: Grid;
}

/** Full pipeline: grids → soldiers / events / attached / config (the body of GET /api/data). */
export function buildData(grids: Grids): {
  events: Record<string, string>;
  soldiers: Soldier[];
  attached: AttachedRow[];
  config: AppConfig;
} {
  const { rows, events } = extract(grids.main || []);
  joinExtras(rows, { data: grids.data, shabzak: grids.shabzak });
  const seen: Record<string, number> = {};
  const soldiers = rows.map((r) => {
    let id = r.pid || norm(r.name) + "|" + norm(r.unit);
    while (seen[id]) id += "_";
    seen[id] = 1;
    return { id, ...r } as Soldier;
  });
  return {
    events,
    soldiers,
    attached: parseAttached(grids.attached || []) || [],
    config: parseConfig(grids.app || []),
  };
}
