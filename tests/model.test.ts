import { beforeAll, describe, expect, it } from "vitest";
import type { AppData } from "@/lib/core/types";
import { leadRank, pkClass, attTone } from "@/lib/core/model";
import { fixtureData, modelFor } from "./helpers";

let d: AppData;
beforeAll(async () => {
  d = await fixtureData();
});
const names = (l: { s: { name: string } }[]) => l.map((x) => x.s.name);

describe("counts", () => {
  it("counts statuses for 20/10", () => {
    const m = modelFor(d);
    expect(m.counts(m.roster())).toEqual({ none: 2, base: 23, tzav: 1, org: 1, out: 1, home: 7, abroad: 2 });
    expect(m.reportText()).toContain("בבסיס: 23 מתוך 36 בשירות");
  });
});

describe("longStays (התראות שבוע קרוב)", () => {
  it("finds stays longer than 7 days that include a home day, minus approved periods", () => {
    const m = modelFor(d);
    const l = m.longStays("2026-10-20");
    expect(names(l)).toEqual(["דניאל שגיא", "בועז חרמון", "כפיר נוי", "הראל יפה"]);
    const dan = l[0];
    // 8/10–11/10 are inside the approved break, so the stay counts from 12/10.
    expect([dan.st, dan.en, dan.len, dan.cross, dan.already, dan.handled]).toEqual(["2026-10-12", "2026-10-22", 11, "2026-10-19", true, false]);
    const boaz = l[1];
    expect([boaz.cross, boaz.already, boaz.handled]).toEqual(["2026-10-25", false, false]);
    expect(l[2]).toMatchObject({ handled: true, hlabel: 'חו"ל שמ"פ סגור מ-17/10' });
    expect(l[3]).toMatchObject({ handled: true, hlabel: "צו סגור מ-22/10" });
  });

  it("ignores away periods without a home day (צו סגור only)", () => {
    expect(names(modelFor(d).longStays("2026-10-20"))).not.toContain("אביב נחום");
  });

  it("counts the approved days when there is no approved period", () => {
    const m = modelFor(d, { alerts: { breaks: [] } });
    const dan = m.longStays("2026-10-20").find((x) => x.s.name === "דניאל שגיא")!;
    expect(dan.st).toBe("2026-10-08");
  });
});

describe("closedSoon", () => {
  it("lists soldiers whose צו סגור / חו\"ל starts this week", () => {
    const c = modelFor(d).closedSoon("2026-10-20");
    expect(c.map((x) => [x.s.name, x.date, x.v, x.to, x.len])).toEqual([
      ["זיו מרגלית", "2026-10-20", "abroad", "2026-10-20", 1],
      ["הראל יפה", "2026-10-22", "tzav", "2026-10-31", 10],
      ["לביא אור", "2026-10-23", "tzav", "2026-10-25", 3],
    ]);
  });
});

describe("shmapChanges", () => {
  it("closed = open yesterday → closed today; opened = closed / not in service yesterday → open today", () => {
    const x = modelFor(d).shmapChanges();
    expect(x.closed.map((c) => [c.s.name, c.from, c.to])).toEqual([["זיו מרגלית", "base", "abroad"]]);
    expect(x.opened.map((c) => [c.s.name, c.from, c.to])).toEqual([
      ["גלעד עמית", "tzav", "base"],
      ["נדב שלו", null, "base"],
      ["קובי ענבר", "tzav", "base"],
    ]);
  });
  it("someone already closed yesterday does not appear", () => {
    const x = modelFor(d).shmapChanges();
    expect([...x.closed, ...x.opened].map((c) => c.s.name)).not.toContain("אביב נחום");
  });
});

describe("roles", () => {
  it("ranks company commander > deputy > deputy B", () => {
    expect(leadRank("מפקד פלוגה")).toBe(3);
    expect(leadRank('מ"פ')).toBe(3);
    expect(leadRank("סגן מפקד פלוגה")).toBe(2);
    expect(leadRank("סגן מפקד פלוגה ב'")).toBe(1);
    expect(leadRank("לוחם")).toBe(0);
  });
  it("puts the company commander and deputies first in חפ\"ק", () => {
    const m = modelFor(d);
    expect(m.inUnit('חפק').slice(0, 3).map((s) => s.name)).toEqual(["נועם ברזילי", "תומר אלמוג", "אלעד צור"]);
  });
  it('חפ"ק never gets a team commander, even with an override or a שבצ"ק flag', () => {
    const m = modelFor(d);
    const s = m.roster().find((x) => x.name === "יואב קדמון")!;
    expect(m.roleOf(s)).toBe("");
    expect(m.isCmd(s)).toBe(false);
  });
  it("fixed commanders come from _app roles.cmd, else from שבצ\"ק", () => {
    const m = modelFor(d);
    const by = (n: string) => m.roster().find((x) => x.name === n)!;
    expect(m.isCmd(by("איתמר לבנון"))).toBe(true);
    expect(m.isCmd(by("שחר ניב"))).toBe(false); // has cmd from DATA "ממ" but roles.cmd overrides
    const m2 = modelFor(d, { roles: null });
    expect(m2.isCmd(by("שחר ניב"))).toBe(true);
    expect(m2.isCmd(by("איתמר לבנון"))).toBe(true);
  });
  it("role overrides beat the sheet; pkClass picks the chip colour", () => {
    const m = modelFor(d);
    expect(m.roleOf(m.roster().find((x) => x.name === "חגי סלע")!)).toBe("נהג");
    expect(m.roleOf(m.roster().find((x) => x.name === "דניאל שגיא")!)).toBe("נהג סוואנה");
    expect([pkClass("מפקד פלוגה"), pkClass("חובש"), pkClass("נהג סוואנה"), pkClass('מפק"צ'), pkClass("קשר")]).toEqual(["mp", "med", "drv", "cmdr", ""]);
  });
  it("curRoles copies the config", () => {
    const m = modelFor(d);
    const r = m.curRoles();
    r.cmd.push("x");
    expect(m.S.roles?.cmd).not.toContain("x");
  });
});

describe("crew", () => {
  it('excludes מפל"ג and anyone not on base', () => {
    const m = modelFor(d);
    expect(m.crewPool().some((s) => s.unit === 'מפל"ג')).toBe(false);
    expect(m.crewPool().every((s) => m.stOf(s) === "base")).toBe(true);
    expect(m.crewSummaryLine()).toMatch(/^\d+ בבסיס · \d+ משובצים$/);
  });
});

describe("attached", () => {
  it("tones and summary line", () => {
    expect([attTone("מאושר"), attTone("לא מאושר"), attTone("נקלט"), attTone("ממתין"), attTone("")]).toEqual(["ok", "bad", "ok", "wait", "none"]);
    expect(modelFor(d).attachedLine()).toBe("5 מסופחים · 2 מאושרים · 3 בטיפול");
  });
});
