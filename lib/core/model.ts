/**
 * All calculations and texts of the app, ported from reference/artifact-app.html.
 * The artifact keeps them as functions over a global `S`; here they close over a state snapshot.
 * The commander-confirmation layer is gone: a soldier's status on a day is the sheet plan
 * (marks are always empty), so `confirmed(list) === active(list).length` as in the PWA port.
 */
import { ST, STMAP, TILES, VEH, VEHMAP, isStatus } from "./constants";
import type { AlertsConfig, AttachedRow, RolesConfig, Soldier, StatusKey } from "./types";
import { dayDiff, flat, fmtDate, fmtShort, norm, shift, teamName, todayKey } from "./util";

export type View = "home" | "unit" | "summary" | "crew" | "attached" | "moves" | "long" | "shmap" | "import";
export type DrillKey = StatusKey | "none";

export interface ModelState {
  soldiers: Soldier[];
  date: string;
  roles: RolesConfig | null;
  alerts: AlertsConfig | null;
  attached: AttachedRow[] | null;
  view: View;
  unit: string | null;
  drill: DrillKey | null;
  attFilter: string | null;
}

export interface Unit {
  k: string;
  n: string;
  o: number;
}

export interface LongStay {
  s: Soldier;
  st: string;
  en: string;
  len: number;
  cross: string;
  already: boolean;
  handled: boolean;
  hlabel: string;
  segs: Seg[];
}
export interface Seg {
  v: StatusKey | null;
  from: string;
  to: string;
}
export interface ClosedSoon {
  s: Soldier;
  date: string;
  v: StatusKey;
  to: string;
  len: number;
}
export interface ShmapChange {
  s: Soldier;
  from: StatusKey | null;
  to: StatusKey;
}

export const MOVES_REL = ["היום", "מחר", "מחרתיים"];
export const LONG_LIMIT = 7;
export const LOOK_AHEAD = 7;
const AWAY: Record<string, 1> = { home: 1, tzav: 1, abroad: 1 };
const CLOSED: Record<string, 1> = { tzav: 1, abroad: 1 };
const LEAD: [RegExp, number][] = [
  [/^(מפ|מפקד פלוגה)$/, 3],
  [/^(סמפ|סגן מפקד פלוגה)$/, 2],
  [/^(סמפם|סגן מפקד פלוגה ב)$/, 1],
];

export const WA_LINE = "━━━━━━━━━━━━━━";
export const ST_EMO: Record<string, string> = { base: "🟢", tzav: "⚪", org: "🔵", out: "🟠", home: "🏠", abroad: "✈️", none: "❔" };
const TEAM_EMO = ["🔵", "🟢", "🟠", "🟣", "🟤", "🔴", "🟡"];
const ATT_EMO: Record<string, string> = { ok: "✅", bad: "❌", wait: "⏳", none: "❔" };

export const leadRank = (r: string): number => {
  const t = norm(r);
  for (const [re, n] of LEAD) if (re.test(t)) return n;
  return 0;
};
export const isHQ = (s: Pick<Soldier, "unit">) => /^חפק$/.test(norm(s.unit).replace(/\s/g, ""));
export const isMafleg = (u: string) => norm(u).replace(/\s/g, "") === "מפלג";
export const pkClass = (pk: string): string => {
  const t = norm(pk);
  return leadRank(t) ? "mp" : /חובש/.test(t) ? "med" : /^נהג/.test(t) ? "drv" : /מפקצ/.test(t) ? "cmdr" : "";
};
export const attTone = (t: string): "ok" | "bad" | "wait" | "none" => {
  t = norm(t);
  return /לא מאושר|נדחה/.test(t) ? "bad" : /מאושר|נקלט/.test(t) ? "ok" : t ? "wait" : "none";
};
export const sold = (n: number) => (n === 1 ? "1 חייל" : `${n} חיילים`);
export const who = (s: Pick<Soldier, "name" | "pid">) => s.name + (s.pid ? ` — ${s.pid}` : "");
export const stName = (k: StatusKey | null) => (k ? (k === "abroad" ? 'חו"ל' : STMAP[k]?.n || k) : 'לא בשמ"פ');
export const segText = (g: Seg) => {
  const n = g.v === "abroad" ? 'חו"ל' : (g.v && STMAP[g.v]?.n) || g.v;
  return `${n} ${fmtShort(g.from)}${g.to !== g.from ? "–" + fmtShort(g.to) : ""}`;
};

export interface WaGroup {
  emo: string;
  name: string;
  items: string[];
}

export function createModel(S: ModelState) {
  const roster = () => S.soldiers;
  const active = (list: Soldier[]) => list.filter((s) => s.arriving !== false);

  function roleOf(s: Soldier): string {
    const o = S.roles?.pakal?.[norm(s.name)];
    const r = o != null ? o : s.pakal || "";
    return isHQ(s) && /מפקצ/.test(norm(r)) ? (s.pakal && !/מפקצ/.test(norm(s.pakal)) ? s.pakal : "") : r;
  }
  const isLead = (s: Soldier) => leadRank(roleOf(s)) > 0;
  function isCmd(s: Soldier): boolean {
    if (isLead(s)) return true;
    if (isHQ(s)) return false;
    const l = S.roles?.cmd;
    return Array.isArray(l) && l.length ? l.some((n) => norm(n) === norm(s.name)) : !!s.cmd;
  }
  function curRoles(): { cmd: string[]; pakal: Record<string, string> } {
    return {
      cmd: [...(S.roles?.cmd || roster().filter((x) => x.cmd).map((x) => x.name))],
      pakal: { ...(S.roles?.pakal || {}) },
    };
  }

  function units(): Unit[] {
    const m = new Map<string, Unit>();
    roster().forEach((s) => {
      const k = norm(s.unit);
      if (!m.has(k)) m.set(k, { k, n: s.unit, o: s.unitOrder ?? 999 });
      else m.get(k)!.o = Math.min(m.get(k)!.o, s.unitOrder ?? 999);
    });
    return [...m.values()].sort((a, b) => a.o - b.o || a.n.localeCompare(b.n, "he"));
  }
  function inUnit(k: string): Soldier[] {
    return roster()
      .filter((s) => norm(s.unit) === k)
      .sort((a, b) => leadRank(roleOf(b)) - leadRank(roleOf(a)) || (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "he"));
  }
  const planOf = (s: Soldier): StatusKey | null => {
    const v = s.plan?.[S.date];
    return isStatus(v) ? v : null;
  };
  const stOf = planOf;
  const confirmed = (list: Soldier[]) => active(list).length;
  function counts(list: Soldier[]): Record<StatusKey | "none", number> {
    const c = { none: 0 } as Record<StatusKey | "none", number>;
    ST.forEach((s) => (c[s.k] = 0));
    active(list).forEach((s) => {
      c[stOf(s) || "none"]++;
    });
    return c;
  }

  /* ---------- crew (vehicles) ---------- */
  const vehOf = (s: Soldier) => s.sheetVeh || "";
  const crewPool = () => active(roster()).filter((s) => !isMafleg(s.unit) && stOf(s) === "base");
  function crewSummaryLine() {
    const p = crewPool();
    const n = p.filter((s) => vehOf(s)).length;
    return `${p.length} בבסיס · ${n} משובצים`;
  }
  const crewRank = (s: Soldier) => (isLead(s) ? 10 + leadRank(roleOf(s)) : isCmd(s) ? 1 : 0);
  function crewGroups(): { u: Unit; l: Soldier[] }[] {
    const pool = crewPool();
    return units()
      .filter((u) => !isMafleg(u.n))
      .map((u) => ({
        u,
        l: pool.filter((s) => norm(s.unit) === u.k).sort((a, b) => crewRank(b) - crewRank(a) || (a.order ?? 0) - (b.order ?? 0)),
      }));
  }
  function vehCounts() {
    const cnt: Record<string, number> = {};
    VEH.forEach((v) => (cnt[v.k] = 0));
    let none = 0;
    crewPool().forEach((s) => {
      const v = vehOf(s);
      if (cnt[v] != null) cnt[v]++;
      else none++;
    });
    return { cnt, none };
  }

  /* ---------- attached soldiers ---------- */
  function attachedLine() {
    const a = S.attached;
    if (!a) return "טוען…";
    const ok = a.filter((r) => attTone(r.status) === "ok").length;
    return `${a.length} מסופחים · ${ok} מאושרים · ${a.length - ok} בטיפול`;
  }
  function attachedByStatus(): [string, number][] {
    const by: Record<string, number> = {};
    (S.attached || []).forEach((r) => {
      const k = r.status || "ללא סטטוס";
      by[k] = (by[k] || 0) + 1;
    });
    return Object.entries(by).sort((x, y) => y[1] - x[1]);
  }
  function attachedList(): AttachedRow[] {
    const a = S.attached || [];
    const f = S.attFilter;
    return f ? a.filter((r) => (r.status || "ללא סטטוס") === f) : a;
  }

  /* ---------- long stays at home ---------- */
  const approvedBreaks = () => (S.alerts?.breaks || []).filter((b) => b && b.from && b.to);
  const inBreak = (d: string) => approvedBreaks().some((b) => d >= b.from && d <= b.to);
  function stAt(s: Soldier, d: string): StatusKey | null {
    if (d === S.date) {
      const v = stOf(s);
      if (v) return v;
    }
    return s.plan?.[d] || null;
  }
  const awayOn = (s: Soldier, d: string) => !inBreak(d) && !!AWAY[stAt(s, d) as string];

  // Consecutive days away from base (בית / צו סגור / חו"ל) longer than LONG_LIMIT that touch [from, from+LOOK_AHEAD-1].
  // Must include at least one "בית" day; approved breaks are not counted.
  function longStays(from: string): LongStay[] {
    const end = shift(from, LOOK_AHEAD - 1);
    const out: LongStay[] = [];
    active(roster()).forEach((s) => {
      if (!s.plan) return;
      let d = from;
      while (d <= end && !awayOn(s, d)) d = shift(d, 1);
      if (d > end) return;
      let st = d;
      while (awayOn(s, shift(st, -1)) && dayDiff(shift(st, -1), from) < 90) st = shift(st, -1);
      let en = d;
      while (awayOn(s, shift(en, 1)) && dayDiff(from, shift(en, 1)) < 90) en = shift(en, 1);
      const len = dayDiff(st, en) + 1;
      if (len <= LONG_LIMIT) return;
      const segs: Seg[] = [];
      for (let x = st; x <= en; x = shift(x, 1)) {
        const v = stAt(s, x);
        const l = segs[segs.length - 1];
        if (l && l.v === v) l.to = x;
        else segs.push({ v, from: x, to: x });
      }
      if (!segs.some((g) => g.v === "home")) return;
      const cross = shift(st, LONG_LIMIT);
      const cv = stAt(s, cross);
      const handled = cv === "tzav" || cv === "abroad";
      const hseg = handled ? segs.find((g) => g.v === cv && g.to >= cross) : null;
      out.push({
        s,
        st,
        en,
        len,
        cross,
        already: cross <= from,
        handled,
        hlabel: handled ? `${STMAP[cv!].n} מ-${fmtShort(hseg!.from)}` : "",
        segs,
      });
    });
    return out.sort((a, b) => Number(a.handled) - Number(b.handled) || a.cross.localeCompare(b.cross) || b.len - a.len);
  }
  function closedSoon(from: string): ClosedSoon[] {
    const end = shift(from, LOOK_AHEAD - 1);
    const out: ClosedSoon[] = [];
    active(roster()).forEach((s) => {
      if (!s.plan) return;
      for (let d = from; d <= end; d = shift(d, 1)) {
        const v = stAt(s, d);
        if (!v || !CLOSED[v] || CLOSED[stAt(s, shift(d, -1)) as string]) continue;
        let to = d;
        while (CLOSED[stAt(s, shift(to, 1)) as string] && dayDiff(d, shift(to, 1)) < 120) to = shift(to, 1);
        out.push({ s, date: d, v, to, len: dayDiff(d, to) + 1 });
        break;
      }
    });
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.s.name.localeCompare(b.s.name, "he"));
  }
  function longLine() {
    const t = longStays(S.date).filter((x) => !x.handled).length;
    const c = closedSoon(S.date).length;
    if (!t && !c) return "אין התראות לשבוע הקרוב";
    return `${t} דורשים טיפול · ${c} עוברים לשמ"פ סגור`;
  }
  function longText() {
    const l = longStays(S.date);
    const t = l.filter((x) => !x.handled);
    const cl = closedSoon(S.date);
    const ln = (x: LongStay) => `• ${x.s.name} (${teamName(x.s.unit)}) — ${x.segs.map(segText).join(", ")} · עובר 7 ימים ב-${fmtShort(x.cross)}`;
    return `התראות לשבוע מ-${fmtDate(S.date).short}\n\nמעל 7 ימים מחוץ לבסיס — דורש טיפול (${t.length}):\n${t.map(ln).join("\n") || "—"}\n\nעוברים לשמ"פ סגור (${cl.length}):\n${
      cl.map((x) => `• ${x.s.name} (${teamName(x.s.unit)}) — ${x.v === "abroad" ? 'חו"ל' : "צו סגור"} מ-${fmtShort(x.date)} עד ${fmtShort(x.to)}`).join("\n") || "—"
    }`;
  }

  /* ---------- שמ"פ open/close changes ---------- */
  function stDay(s: Soldier, d: string): StatusKey | null {
    if (d === S.date) return stOf(s);
    const v = s.plan?.[d];
    return isStatus(v) ? v : null;
  }
  // Closed = צו סגור / חו"ל. "Closed" today only if yesterday was open. "Opened" if yesterday was closed or not in service.
  function shmapChanges(): { closed: ShmapChange[]; opened: ShmapChange[] } {
    const y = shift(S.date, -1);
    const closed: ShmapChange[] = [];
    const opened: ShmapChange[] = [];
    active(roster()).forEach((s) => {
      const a = stDay(s, y);
      const b = stDay(s, S.date);
      if (!b) return;
      if (CLOSED[b] && a && !CLOSED[a]) closed.push({ s, from: a, to: b });
      else if (!CLOSED[b] && (!a || CLOSED[a])) opened.push({ s, from: a, to: b });
    });
    const by = (p: ShmapChange, q: ShmapChange) => (p.s.unitOrder ?? 99) - (q.s.unitOrder ?? 99) || p.s.name.localeCompare(q.s.name, "he");
    return { closed: closed.sort(by), opened: opened.sort(by) };
  }

  /* ---------- מגיעים ויוצאים ---------- */
  // Departure = "יציאה הביתה" that day. Arrival = בסיס that day after any other status (or none) the day before.
  function movesDay(d: string): { arr: Soldier[]; out: Soldier[] } {
    const all = active(roster());
    return {
      out: all.filter((s) => stDay(s, d) === "out"),
      arr: all.filter((s) => stDay(s, d) === "base" && stDay(s, shift(d, -1)) !== "base"),
    };
  }
  function byTeam(list: Soldier[]): { u: Unit; l: Soldier[] }[] {
    const ids = new Set(list.map((s) => s.id));
    return units()
      .map((u) => ({ u, l: active(inUnit(u.k)).filter((s) => ids.has(s.id)) }))
      .filter((x) => x.l.length);
  }
  // "היום · יום שישי 23/10" when the selected date is today, otherwise just the day.
  function relLabel(i: number, today: string = todayKey()) {
    const d = shift(S.date, i);
    const f = fmtDate(d);
    return (S.date === today ? MOVES_REL[i] + " · " : "") + f.day + " " + fmtShort(d);
  }
  function movesWa() {
    let t = `🚌 *מגיעים ויוצאים – תקיפה ג׳* 🚌\n`;
    [0, 1, 2].forEach((i) => {
      const x = movesDay(shift(S.date, i));
      t += `\n${WA_LINE}\n📅 *${relLabel(i)}*\n`;
      ([[x.arr, "🟢", "מגיעים לבסיס"], [x.out, "🟠", "יוצאים הביתה"]] as const).forEach(([l, e, n]) => {
        t += `\n${e} *${n}: ${sold(l.length)}*\n`;
        byTeam(l).forEach((g) => {
          t += `${teamEmo(g.u.n)} ${teamName(g.u.n)} (${g.l.length}): ${g.l.map((s) => s.name).join(", ")}\n`;
        });
      });
    });
    return t + `\n${WA_LINE}`;
  }

  /* ---------- נתוני מ"פ ---------- */
  function listFor(k: DrillKey) {
    return units()
      .map((u) => ({ u, l: active(inUnit(u.k)).filter((s) => (k === "none" ? !stOf(s) : stOf(s) === k)) }))
      .filter((x) => x.l.length);
  }
  function listText(k: DrillKey) {
    const f = fmtDate(S.date);
    const name = k === "none" ? "ללא סטטוס" : STMAP[k].n;
    const g = listFor(k);
    const n = g.reduce((a, x) => a + x.l.length, 0);
    return `${name} — ${f.day} ${f.short} (${n})\n` + g.map((x) => `\n${teamName(x.u.n)} (${x.l.length}):\n` + x.l.map((s) => "• " + s.name).join("\n")).join("\n");
  }
  function tiles(): DrillKey[] {
    const tc = counts(roster());
    const t: DrillKey[] = TILES.filter((k) => k === "base" || k === "home" || k === "out" || k === "tzav" || tc[k]);
    if (tc.none) t.push("none");
    return t;
  }
  function reportText() {
    const all = roster();
    const act = active(all);
    const c = counts(all);
    const f = fmtDate(S.date);
    let t = `כוח אדם תקיפה ג' גדס"ר\n${f.day} ${f.short}\n\nבבסיס: ${c.base} מתוך ${act.length - c.tzav} בשירות\n`;
    ST.slice(1).forEach((s) => {
      if (c[s.k]) t += `${s.n}: ${c[s.k]}\n`;
    });
    if (c.none) t += `ללא סטטוס: ${c.none}\n`;
    if (confirmed(all) < act.length) t += `(אושרו במפקדים ${confirmed(all)} מתוך ${act.length}, השאר לפי תכנון השיט)\n`;
    t += "\nבבסיס לפי צוות:\n";
    units().forEach((u) => {
      const l = inUnit(u.k);
      const cc = counts(l);
      t += `${teamName(u.n)}: ${cc.base}/${active(l).length}\n`;
    });
    return t.trim();
  }

  /* ---------- WhatsApp share ---------- */
  function teamEmo(u: string) {
    const t = flat(u);
    if (/חפק/.test(t)) return "🛡️";
    if (/פתן/.test(t)) return "⚙️";
    if (/מפלג/.test(t)) return "📋";
    const i = units()
      .filter((x) => !/חפק|פתן|מפלג/.test(flat(x.n)))
      .findIndex((x) => x.k === norm(u));
    return TEAM_EMO[Math.max(i, 0) % TEAM_EMO.length];
  }
  const waDate = () => {
    const f = fmtDate(S.date);
    return `${f.day} · ${f.short}`;
  };
  // One message shape for every page: title, date, total, divider, then numbered groups, closing total.
  function waMsg({ icon, title, groups, total = "סה״כ כוח" }: { icon: string; title: string; groups: WaGroup[]; total?: string }) {
    const gs = groups.filter((g) => g.items.length);
    const n = gs.reduce((a, g) => a + g.items.length, 0);
    let i = 0;
    let t = `${icon} *${title}* ${icon}\n📅 ${waDate()}\n\n👥 *${total}: ${sold(n)}*\n\n${WA_LINE}\n`;
    gs.forEach((g) => {
      t += `\n${g.emo} *${g.name} | ${sold(g.items.length)}*\n` + g.items.map((x) => `${++i}. ${x}`).join("\n") + "\n";
    });
    return t + `\n🎖️ *${total}: ${sold(n)}* 🎖️\n\n${WA_LINE}`;
  }
  const teamGroups = (pairs: { u: Unit; l: Soldier[] }[], fmt: (s: Soldier) => string = who): WaGroup[] =>
    pairs.filter((x) => x.l.length).map((x) => ({ emo: teamEmo(x.u.n), name: teamName(x.u.n), items: x.l.map(fmt) }));
  function unitText() {
    const u = units().find((x) => x.k === S.unit);
    if (!u) return "";
    const la = active(inUnit(u.k));
    return waMsg({
      icon: "🪖",
      title: teamName(u.n),
      groups: [
        ...ST.map((s) => ({ emo: ST_EMO[s.k], name: s.n, items: la.filter((x) => stOf(x) === s.k).map(who) })),
        { emo: ST_EMO.none, name: "ללא סטטוס", items: la.filter((x) => !stOf(x)).map(who) },
      ],
    });
  }
  function drillText(k: DrillKey) {
    const name = k === "none" ? "ללא סטטוס" : STMAP[k].n;
    return waMsg({ icon: ST_EMO[k] || "📋", title: `${name} – תקיפה ג׳`, total: `סה״כ ${name}`, groups: teamGroups(listFor(k)) });
  }
  function crewText() {
    return waMsg({ icon: "🚨", title: "שבצ״ק רכבים – תקיפה ג׳", groups: teamGroups(crewGroups(), (s) => `${who(s)} | ${VEHMAP[vehOf(s)]?.n || "לא שובץ"}`) });
  }
  function attText() {
    const l = attachedList();
    if (!l.length) return "";
    const by: Record<string, AttachedRow[]> = {};
    l.forEach((r) => {
      const k = r.status || "ללא סטטוס";
      (by[k] = by[k] || []).push(r);
    });
    return waMsg({
      icon: "📎",
      title: "סטטוס מסופחים – תקיפה ג׳",
      total: "סה״כ מסופחים",
      groups: Object.entries(by)
        .sort((x, y) => y[1].length - x[1].length)
        .map(([k, rs]) => ({ emo: ATT_EMO[attTone(k)], name: k, items: rs.map((r) => r.name + (r.role ? ` (${r.role})` : "") + (r.phone ? ` — ${r.phone}` : "")) })),
    });
  }
  function longWa() {
    const t = longStays(S.date).filter((x) => !x.handled);
    const cl = closedSoon(S.date);
    return waMsg({
      icon: "⚠️",
      title: "התראות שבוע קרוב – תקיפה ג׳",
      total: "סה״כ התראות",
      groups: [
        { emo: "🏠", name: "מעל 7 ימים מחוץ לבסיס – דורש טיפול", items: t.map((x) => `${who(x.s)} (${teamName(x.s.unit)}) | ${x.segs.map(segText).join(", ")} · עובר 7 ימים ב-${fmtShort(x.cross)}`) },
        { emo: "🔒", name: "עוברים לשמ״פ סגור", items: cl.map((x) => `${who(x.s)} (${teamName(x.s.unit)}) | ${x.v === "abroad" ? "חו״ל" : "צו סגור"} ${fmtShort(x.date)}–${fmtShort(x.to)}`) },
      ],
    });
  }
  function shmapWa() {
    const x = shmapChanges();
    const ln = (c: ShmapChange) => `${who(c.s)} (${teamName(c.s.unit)}) | מ${stName(c.from)} ל${stName(c.to)}`;
    return waMsg({
      icon: "💰",
      title: "שינויי שמ״פ – תקיפה ג׳",
      total: "סה״כ שינויים",
      groups: [
        { emo: "🔒", name: "נסגר שמ״פ", items: x.closed.map(ln) },
        { emo: "🔓", name: "נפתח שמ״פ", items: x.opened.map(ln) },
      ],
    });
  }
  function reportWa() {
    const all = roster();
    const act = active(all);
    const c = counts(all);
    let t = `📊 *דוח כוח אדם – תקיפה ג׳ גדס״ר* 📊\n📅 ${waDate()}\n\n👥 *סה״כ כוח: ${sold(act.length)}*\n🟢 *בבסיס: ${c.base}* מתוך ${act.length - c.tzav} בשירות\n\n${WA_LINE}\n\n*לפי סטטוס*\n`;
    ST.slice(1).forEach((s) => {
      if (c[s.k]) t += `${ST_EMO[s.k]} ${s.n}: ${c[s.k]}\n`;
    });
    if (c.none) t += `${ST_EMO.none} ללא סטטוס: ${c.none}\n`;
    t += `\n*בבסיס לפי צוות*\n`;
    units().forEach((u) => {
      const l = inUnit(u.k);
      const cc = counts(l);
      t += `${teamEmo(u.n)} ${teamName(u.n)}: ${cc.base}/${active(l).length}\n`;
    });
    if (confirmed(all) < act.length) t += `\n_אושרו במפקדים ${confirmed(all)} מתוך ${act.length}, השאר לפי תכנון השיט_\n`;
    return t + `\n${WA_LINE}`;
  }
  function waText(): string {
    const v = S.view;
    return v === "unit"
      ? unitText()
      : v === "summary"
        ? S.drill
          ? drillText(S.drill)
          : reportWa()
        : v === "crew"
          ? crewText()
          : v === "attached"
            ? attText()
            : v === "moves"
              ? movesWa()
            : v === "long"
              ? longWa()
              : v === "shmap"
                ? shmapWa()
                : v === "import"
                  ? ""
                  : reportWa();
  }
  function waLabel(): string {
    const v = S.view;
    return v === "summary" && S.drill ? "שלח רשימה בווטסאפ" : v === "home" || v === "summary" ? "שלח דוח בווטסאפ" : "שלח בווטסאפ";
  }

  return {
    S,
    roster,
    active,
    units,
    inUnit,
    planOf,
    stOf,
    confirmed,
    counts,
    roleOf,
    isLead,
    isCmd,
    curRoles,
    vehOf,
    crewPool,
    crewGroups,
    crewSummaryLine,
    vehCounts,
    attachedLine,
    attachedByStatus,
    attachedList,
    approvedBreaks,
    stAt,
    longStays,
    closedSoon,
    longLine,
    longText,
    shmapChanges,
    stDay,
    movesDay,
    byTeam,
    relLabel,
    movesWa,
    listFor,
    listText,
    tiles,
    reportText,
    teamEmo,
    waMsg,
    unitText,
    drillText,
    crewText,
    attText,
    longWa,
    shmapWa,
    reportWa,
    waText,
    waLabel,
  };
}

export type Model = ReturnType<typeof createModel>;
