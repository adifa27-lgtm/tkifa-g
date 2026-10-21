/** Shared by the parity test and the local real-sheet check: drives the original artifact in a browser. */
import type { Page } from "@playwright/test";
import path from "node:path";
import { createModel, type DrillKey, type View } from "../lib/core/model";
import type { AppData } from "../lib/core/types";

export const ART = path.join(__dirname, "..", "reference", "artifact-app.html");
export const DATES = ["2026-10-20", "2026-10-19", "2026-10-23", "2026-09-03", "2026-10-04", "2026-11-14"];

export type Snapshot = Record<string, unknown>;

export async function loadArtifact(page: Page) {
  await page.route(/^https?:\/\//, (r) => r.abort());
  await page.addInitScript(() => {
    (window as unknown as { claude: unknown }).claude = { use: async () => null };
  });
  await page.goto("file://" + ART.replace(/\\/g, "/"));
  await page.waitForFunction(() => typeof (window as unknown as { extract?: unknown }).extract === "function");
}

/** Runs inside the artifact page. */
export function artifactSnapshot(args: { book: Record<string, string[][]>; dates: string[] }) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  // Globals of the artifact's classic script (const bindings are not window properties: use indirect eval).
  const g = (name: string): any => (0, eval)(name);
  const [extract, joinExtras, parseAttached, norm, counts, units, inUnit, longStays, closedSoon, shmapChanges, waText, reportText, listText, longText, TILES, S] = [
    "extract", "joinExtras", "parseAttached", "norm", "counts", "units", "inUnit", "longStays", "closedSoon", "shmapChanges", "waText", "reportText", "listText", "longText", "TILES", "S",
  ].map(g);
  g("confirmed = (list) => active(list).length");
  const b = args.book;
  const { rows, events } = extract(b["תקיפה ג׳"], "");
  joinExtras(rows, { data: b["DATA תקיפה ג"], shabzak: b['שבצ"ק'] });
  const seen: Record<string, number> = {};
  rows.forEach((r: any) => {
    let id = r.pid || norm(r.name) + "|" + norm(r.unit);
    while (seen[id]) id += "_";
    seen[id] = 1;
    r.id = id;
  });
  const cfg: any = {};
  (b._app || []).forEach((r: string[]) => {
    if (r[0] === "roles" || r[0] === "alerts") cfg[r[0]] = JSON.parse(r[1]);
  });
  S.soldiers = rows;
  S.demo = false;
  S.cfg = { events };
  S.roles = cfg.roles || null;
  S.alertCfg = cfg.alerts || null;
  S.attached = { rows: parseAttached(b["מסופחים"]) || [] };
  S.marks = {};
  S.prevMarks = {};
  S.crew = {};
  const out: Record<string, unknown> = { n: rows.length, events };
  for (const d of args.dates) {
    S.date = d;
    const snap: Record<string, unknown> = {};
    snap.counts = counts(rows);
    snap.units = units().map((u: any) => ({ k: u.k, ids: inUnit(u.k).map((s: any) => s.id), c: counts(inUnit(u.k)) }));
    snap.long = longStays(d).map((x: any) => [x.s.id, x.st, x.en, x.len, x.cross, x.already, x.handled, x.hlabel]);
    snap.closed = closedSoon(d).map((x: any) => [x.s.id, x.date, x.v, x.to, x.len]);
    const sh = shmapChanges();
    snap.shmap = { closed: sh.closed.map((c: any) => [c.s.id, c.from, c.to]), opened: sh.opened.map((c: any) => [c.s.id, c.from, c.to]) };
    snap.reportText = reportText();
    snap.longText = longText();
    const wa: Record<string, string> = {};
    const set = (view: string, extra: any = {}) => {
      S.view = view;
      S.unit = extra.unit ?? null;
      S.drill = extra.drill ?? null;
      S.attFilter = extra.attFilter ?? null;
      return waText();
    };
    wa.home = set("home");
    units().forEach((u: any) => (wa["unit:" + u.k] = set("unit", { unit: u.k })));
    wa.summary = set("summary");
    [...TILES, "none"].forEach((k: string) => (wa["drill:" + k] = set("summary", { drill: k })));
    wa.crew = set("crew");
    wa.attached = set("attached");
    wa["attached:מאושר"] = set("attached", { attFilter: "מאושר" });
    wa.long = set("long");
    wa.shmap = set("shmap");
    snap.wa = wa;
    snap.lists = Object.fromEntries([...TILES, "none"].map((k: string) => [k, listText(k)]));
    out[d] = snap;
  }
  return out;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function ourSnapshot(data: AppData, dates: string[]): Snapshot {
  const base = { soldiers: data.soldiers, roles: data.config.roles, alerts: data.config.alerts, attached: data.attached };
  const mk = (date: string, view: View = "home", extra: { unit?: string; drill?: DrillKey; attFilter?: string } = {}) =>
    createModel({ ...base, date, view, unit: extra.unit ?? null, drill: extra.drill ?? null, attFilter: extra.attFilter ?? null });
  const out: Snapshot = { n: data.soldiers.length, events: data.events };
  const TILES = ["base", "home", "out", "tzav", "org", "abroad"] as const;
  for (const d of dates) {
    const m = mk(d);
    const sh = m.shmapChanges();
    const wa: Record<string, string> = {};
    wa.home = m.waText();
    m.units().forEach((u) => (wa["unit:" + u.k] = mk(d, "unit", { unit: u.k }).waText()));
    wa.summary = mk(d, "summary").waText();
    [...TILES, "none" as const].forEach((k) => (wa["drill:" + k] = mk(d, "summary", { drill: k }).waText()));
    wa.crew = mk(d, "crew").waText();
    wa.attached = mk(d, "attached").waText();
    wa["attached:מאושר"] = mk(d, "attached", { attFilter: "מאושר" }).waText();
    wa.long = mk(d, "long").waText();
    wa.shmap = mk(d, "shmap").waText();
    out[d] = {
      counts: m.counts(m.roster()),
      units: m.units().map((u) => ({ k: u.k, ids: m.inUnit(u.k).map((s) => s.id), c: m.counts(m.inUnit(u.k)) })),
      long: m.longStays(d).map((x) => [x.s.id, x.st, x.en, x.len, x.cross, x.already, x.handled, x.hlabel]),
      closed: m.closedSoon(d).map((x) => [x.s.id, x.date, x.v, x.to, x.len]),
      shmap: { closed: sh.closed.map((c) => [c.s.id, c.from, c.to]), opened: sh.opened.map((c) => [c.s.id, c.from, c.to]) },
      reportText: m.reportText(),
      longText: m.longText(),
      wa,
      lists: Object.fromEntries([...TILES, "none" as const].map((k) => [k, m.listText(k)])),
    };
  }
  return out;
}

