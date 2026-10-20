/**
 * Parity test: the source-of-truth artifact (reference/artifact-app.html) is loaded in a headless
 * browser with its Claude data layer stubbed out and the SAME synthetic workbook injected. Its
 * counts, alert lists and WhatsApp texts must equal ours (server pipeline + model + rendered UI)
 * for several dates. Skipped when reference/ is absent (it is never committed).
 *
 * Only intentional difference applied to the artifact: no commander-confirmation layer, i.e.
 * confirmed(list) = active(list).length (exactly what the PWA port did).
 */
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createModel, type DrillKey, type View } from "../lib/core/model";
import type { AppData } from "../lib/core/types";
import { artifactGrid, fixtureWorkbook } from "../lib/mock/fixture";

const ART = path.join(__dirname, "..", "reference", "artifact-app.html");
const DATES = ["2026-10-20", "2026-10-19", "2026-10-23", "2026-09-03", "2026-10-04", "2026-11-14"];

test.skip(!fs.existsSync(ART), "reference/artifact-app.html not present");

type Snapshot = Record<string, unknown>;

async function loadArtifact(page: Page) {
  await page.route(/^https?:\/\//, (r) => r.abort());
  await page.addInitScript(() => {
    (window as unknown as { claude: unknown }).claude = { use: async () => null };
  });
  await page.goto("file://" + ART.replace(/\\/g, "/"));
  await page.waitForFunction(() => typeof (window as unknown as { extract?: unknown }).extract === "function");
}

/** Runs inside the artifact page. */
function artifactSnapshot(args: { book: Record<string, string[][]>; dates: string[] }) {
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

function ourSnapshot(data: AppData, dates: string[]): Snapshot {
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

test("artifact and app agree on counts, alerts and WhatsApp texts", async ({ page, request }) => {
  const book = Object.fromEntries(Object.entries(fixtureWorkbook()).map(([k, g]) => [k, artifactGrid(g)]));
  await loadArtifact(page);
  const theirs = await page.evaluate(artifactSnapshot, { book, dates: DATES });

  // Ours: the real server pipeline (mock source) through /api/data, then the shared model.
  const res = await request.get("/api/data");
  expect(res.ok()).toBeTruthy();
  const data = (await res.json()) as AppData;
  const ours = ourSnapshot(data, DATES);

  // Guard against a vacuous comparison.
  const t20 = theirs["2026-10-20"] as { long: unknown[]; closed: unknown[]; shmap: { closed: unknown[]; opened: unknown[] }; wa: Record<string, string> };
  expect(theirs.n).toBeGreaterThan(30);
  expect(t20.long.length).toBeGreaterThan(2);
  expect(t20.closed.length).toBeGreaterThan(1);
  expect(t20.shmap.closed.length + t20.shmap.opened.length).toBeGreaterThan(2);
  expect(Object.keys(t20.wa).length).toBeGreaterThan(15);
  expect(t20.wa.crew).toContain("האמר");
  expect(ours.n).toBe(theirs.n);
  expect(ours.events).toEqual(theirs.events);
  for (const d of DATES) {
    const a = theirs[d] as Record<string, unknown>;
    const b = ours[d] as Record<string, unknown>;
    for (const k of Object.keys(a)) expect(b[k], `${d} · ${k}`).toEqual(a[k]);
  }
});

test("rendered app sends byte-identical WhatsApp texts", async ({ page, browser }) => {
  const book = Object.fromEntries(Object.entries(fixtureWorkbook()).map(([k, g]) => [k, artifactGrid(g)]));
  const artPage = await browser.newPage();
  await loadArtifact(artPage);
  const theirs = (await artPage.evaluate(artifactSnapshot, { book, dates: ["2026-10-20"] })) as Record<string, { wa: Record<string, string> }>;
  const wa = theirs["2026-10-20"].wa;

  await page.clock.setFixedTime(new Date("2026-10-20T09:00:00+03:00"));
  await page.goto("/");
  const link = page.locator("#wa");
  const textOf = async () => decodeURIComponent((await link.getAttribute("href"))!.replace("https://wa.me/?text=", ""));
  await expect(page.locator(".hero")).toBeVisible();
  expect(await textOf()).toBe(wa.home);

  await page.locator(".unit").first().click();
  await expect(page.locator("h2")).toBeVisible();
  const firstUnit = Object.keys(wa).find((k) => k.startsWith("unit:"))!;
  expect(await textOf()).toBe(wa[firstUnit]);
  await page.locator(".back").click();

  for (const [btn, key] of [
    ["שבצ\"ק רכבים", "crew"],
    ["סטטוס מסופחים", "attached"],
    ["התראות שבוע קרוב", "long"],
    ["שינויי שמ\"פ היום", "shmap"],
    ["נתוני מ\"פ", "summary"],
  ] as const) {
    await page.locator(".unit.wide", { hasText: btn }).click();
    await expect(page.locator("h2")).toBeVisible();
    expect(await textOf(), key).toBe(wa[key]);
    if (key === "summary") {
      await page.locator(".tile").filter({ hasText: "בבית" }).click();
      expect(await textOf(), "drill:home").toBe(wa["drill:home"]);
    }
    await page.locator(".back").click();
  }
});
