import { describe, expect, it } from "vitest";
import { fixHeader, serialToDmy } from "@/lib/sheet/a1";
import { buildData, colDates, extract, joinExtras, parseAttached, parseConfig, statusOf, type RosterRow } from "@/lib/sheet/parse";
import { pickTabs } from "@/lib/sheet/tabs";
import { formattedGrid, fixtureWorkbook } from "@/lib/mock/fixture";

describe("statusOf", () => {
  it.each([
    ["1", "base"],
    ["בסיס", "base"],
    [" בבסיס ", "base"],
    ["צו סגור", "tzav"],
    ['חו"ל  - שמ"פ סגור', "abroad"],
    ["חו״ל", "abroad"],
    ["התארגנות", "org"],
    ["יציאה הביתה", "out"],
    ["בית", "home"],
    ["בבית", "home"],
    ["איתור ", "loc"],
    ["", null],
    ["משהו אחר", null],
    ["2", null],
  ])("%j → %j", (v, k) => expect(statusOf(v)).toBe(k));

  it("checks in the artifact's order (צו סגור wins over בסיס)", () => {
    expect(statusOf("צו סגור בבסיס")).toBe("tzav");
    expect(statusOf("יציאה מהבסיס")).toBe("out");
  });
});

describe("colDates", () => {
  it("parses mixed dd/mm and dd/mm/yyyy headers with event labels", () => {
    const h = ["שם", "02/09/2026 \nסיור מפקדים", "03/09 \nאימון מפקדים חטיבתי ", "15/09\nסיור גזרה פלוגתי", "02/10/2026 יציאה הביתה", "04/10/2026", "5.10"];
    const d = colDates(h);
    expect(d[0]).toBeNull();
    expect(d[1]).toEqual({ key: "2026-09-02", label: "סיור מפקדים" });
    expect(d[2]).toEqual({ key: "2026-09-03", label: "אימון מפקדים חטיבתי" });
    expect(d[3]).toEqual({ key: "2026-09-15", label: "סיור גזרה פלוגתי" });
    expect(d[4]).toEqual({ key: "2026-10-02", label: "יציאה הביתה" });
    expect(d[5]).toEqual({ key: "2026-10-04", label: "" });
    expect(d[6]?.key).toBe("2026-10-05");
  });

  it("infers the year from the first full date and rolls over when the month drops by more than 6", () => {
    const d = colDates(["30/12/2026", "31/12", "01/01", "02/01"]);
    expect(d.map((x) => x?.key)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("understands Hebrew month names", () => {
    expect(colDates(["5 באוקטובר"])[0]?.key).toMatch(/-10-05$/);
  });

  it("rejects impossible dates", () => {
    expect(colDates(["32/01/2026", "10/13/2026"])).toEqual([null, null]);
  });
});

describe("fixHeader", () => {
  it("rewrites real date cells from their serial, whatever the display format", () => {
    expect(serialToDmy(46299)).toBe("04/10/2026");
    expect(fixHeader(["שם", "10/4/2026"], ["שם", 46299])).toEqual(["שם", "04/10/2026"]);
    expect(fixHeader(["03/09 \nאימון"], ["03/09 \nאימון"])).toEqual(["03/09 \nאימון"]);
  });
});

describe("extract on the synthetic sheet", () => {
  const book = fixtureWorkbook();
  const main = formattedGrid(book["תקיפה ג׳"]);
  main[0] = fixHeader(main[0], book["תקיפה ג׳"][0].map((c) => (typeof c === "string" ? c : c.u)));
  const { rows, events } = extract(main);

  it("skips סה\"כ rows, לבטל צו rows and heading rows", () => {
    expect(rows.find((r) => /^סה/.test(r.name))).toBeUndefined();
    expect(rows.find((r) => r.name === "דור רימון")).toBeUndefined();
    expect(rows).toHaveLength(37);
  });

  it("inherits the team from heading rows and keeps first-appearance order", () => {
    const units = [...new Set(rows.map((r) => r.unit))];
    expect(units).toEqual(['חפ"ק', 'מפל"ג', 'פת"ן', "צוות אלון", "ברק", "צוות גפן", "צלפים"]);
    expect(rows.find((r) => r.name === "תומר אלמוג")?.unit).toBe('חפ"ק');
    expect(rows.find((r) => r.name === "תומר אלמוג")?.order).toBe(2);
    expect(rows.find((r) => r.name === "יהב כרמי")?.unitOrder).toBe(4);
  });

  it("collects events but not בית / יציאה הביתה labels", () => {
    expect(events["2026-09-01"]).toBe("סיור מפקדים");
    expect(events["2026-09-03"]).toBe("אימון מפקדים חטיבתי");
    expect(events["2026-10-02"]).toBeUndefined();
    expect(events["2026-10-10"]).toBeUndefined();
  });

  it("reads the daily plan, including the real-date header column", () => {
    const s = rows.find((r) => r.name === "זיו מרגלית")!;
    expect(s.plan["2026-10-20"]).toBe("abroad");
    expect(s.plan["2026-10-19"]).toBe("base");
    expect(Object.keys(s.plan)).toContain("2026-10-04");
    expect(rows.find((r) => r.name === "ליאב סהר")!.plan["2026-09-02"]).toBeUndefined();
  });

  it("parses flags, notes, line and day counts", () => {
    const tz = rows.find((r) => r.name === "חגי סלע")!;
    expect(tz.student).toBe(true);
    expect(tz.indep).toBe(true);
    expect(rows.find((r) => r.name === "ניר אופק")!.indep).toBe(false);
    expect(rows.find((r) => r.name === "אורן גל")!.note).toBe("מגיע מאוחר");
    expect(rows.find((r) => r.name === "דוד אשל")!.line).toBe("שחרור מוקדם");
    const blank = rows.find((r) => r.name === "מאור דגן")!;
    expect(blank.baseDays).toBe(Object.values(blank.plan).filter((v) => v === "base" || v === "out").length);
    expect(blank.homeDays).toBe(Object.values(blank.plan).filter((v) => v === "home").length);
  });

  it("trims names that have trailing spaces in the sheet", () => {
    expect(rows.every((r) => r.name === r.name.trim())).toBe(true);
  });

  it("returns nothing without a header row", () => {
    expect(extract([["a", "b"], ["c", "d"]])).toEqual({ rows: [], events: {} });
  });
});

describe("joinExtras", () => {
  const mk = (pid: string, name = "x"): RosterRow => ({ pid, name, unit: "צוות א", unitOrder: 0, order: 1, baseDays: 0, homeDays: 0, arriving: true, student: false, indep: false, line: "", note: "", plan: {} });
  it("joins פק\"ל, ignores 'לא הוזן', maps vehicles and team commanders", () => {
    const rows = [mk("1234567"), mk("2345678"), mk("3456789"), mk("4567890"), mk("")];
    joinExtras(rows, {
      data: [["כותרת"], ["ת.ז", "מ.א", "תפקיד ראשי"], ["111", "1234567.0", "נהג"], ["222", "2345678", "לא הוזן"], ["333", "3456789", "ממ"]],
      shabzak: [
        ["x"],
        ["משימה", "מספר אישי", "תפקיד", "רכב", "", "מספר אישי", "צוות", "תפקיד", "רכב"],
        ["", "1234567", 'מפק"צ', "898.0", "", "3456789", "", "", "סוואנה"],
        ["", "2345678", "", "רכב פרטי", "", "123", "", "", "506"],
      ],
    });
    expect(rows[0]).toMatchObject({ pakal: "נהג", cmd: true, sheetVeh: "898", shab: true });
    expect(rows[1]).toMatchObject({ pakal: "", cmd: false, sheetVeh: "private", shab: true });
    expect(rows[2]).toMatchObject({ pakal: "ממ", cmd: true, sheetVeh: "savana", shab: true });
    expect(rows[3]).toMatchObject({ pakal: "", cmd: false, sheetVeh: "", shab: false });
    expect(rows[4].shab).toBe(false);
  });
});

describe("parseAttached", () => {
  it("keeps only תקיפה ג׳ rows, falls back to הערות קישור, drops date-like phones", () => {
    const rows = parseAttached(formattedGrid(fixtureWorkbook()["מסופחים"]))!;
    expect(rows.map((r) => r.name)).toEqual(["ישי מנור", "עוז בלום", "רז שחם", "אלון רגב", "שגב נור"]);
    expect(rows[1].status).toBe('ממתין לאישור מח"ט');
    expect(rows[2].phone).toBe("");
    expect(rows[0].phone).toBe("052-1111111");
  });
  it("returns null without a header", () => expect(parseAttached([["a"]])).toBeNull());
});

describe("parseConfig", () => {
  it("reads roles / alerts JSON and ignores other keys and bad JSON", () => {
    const c = parseConfig([["roles", '{"cmd":["א"],"pakal":{}}'], ["alerts", "{bad"], ["changesFolderId", "zzz"]]);
    expect(c.roles).toEqual({ cmd: ["א"], pakal: {} });
    expect(c.alerts).toBeNull();
  });
});

describe("pickTabs", () => {
  it("matches tab names after normalising quotes and gereshes", () => {
    const t = pickTabs(["תקיפה ג׳", "גיליון15", 'שבצ"ק', "מסופחים", "DATA תקיפה ג", "_app"])!;
    expect(t).toEqual({ main: "תקיפה ג׳", data: "DATA תקיפה ג", shabzak: 'שבצ"ק', attached: "מסופחים", app: "_app" });
    expect(pickTabs(["Sheet1"])!.main).toBe("Sheet1");
  });
});

describe("buildData", () => {
  it("uses the personal number as id and falls back to name|unit", () => {
    const b = fixtureWorkbook();
    const d = buildData({ main: formattedGrid(b["תקיפה ג׳"]), data: formattedGrid(b["DATA תקיפה ג"]), shabzak: formattedGrid(b['שבצ"ק']) });
    expect(d.soldiers.find((s) => s.name === "נועם ברזילי")!.id).toBe("8100001");
    expect(d.soldiers.find((s) => s.name === "טל ורד")!.id).toBe("טל ורד|צוות אלון");
    expect(new Set(d.soldiers.map((s) => s.id)).size).toBe(d.soldiers.length);
  });
});
