import { beforeEach, describe, expect, it, vi } from "vitest";
import { colIndex, colLetter } from "@/lib/sheet/a1";
import { dateColumns, makeLocator } from "@/lib/sheet/locate";
import { fixtureWorkbook, formattedGrid, type MockGrid } from "@/lib/mock/fixture";
import { mockSource } from "@/lib/server/mock";
import { readAll, resetReaderCache } from "@/lib/server/reader";
import { applyChanges } from "@/lib/server/writer";

const MAIN = "תקיפה ג׳";
const SHAB = 'שבצ"ק';
const cellOf = (book: Record<string, MockGrid>, tab: string, a1: string) => {
  const m = a1.match(/^([A-Z]+)(\d+)$/)!;
  const c = book[tab][+m[2] - 1]?.[colIndex(m[1])];
  return typeof c === "object" ? c.f : c;
};
const rowOfName = (book: Record<string, MockGrid>, name: string) => book[MAIN].findIndex((r) => String(r[1]).trim() === name);
const dateCol = (book: Record<string, MockGrid>, key: string) => {
  const h = book[MAIN][0].map((c) => (typeof c === "string" ? c : "04/10/2026"));
  return dateColumns(h)[key];
};

describe("A1 helpers", () => {
  it("converts columns both ways", () => {
    expect([0, 25, 26, 51, 52, 85].map(colLetter)).toEqual(["A", "Z", "AA", "AZ", "BA", "CH"]);
    expect(["A", "Z", "AA", "CH"].map(colIndex)).toEqual([0, 25, 26, 85]);
  });
});

describe("dateColumns (writer_ port)", () => {
  it("maps header cells to yyyy-mm-dd, later duplicates win, year from the first full date", () => {
    const cols = dateColumns(["שם", "30/12/2026 \nאירוע", "31/12", "1/1", "01/01/2027"]);
    expect(cols).toEqual({ "2026-12-30": 1, "2026-12-31": 2, "2027-01-01": 4 });
  });
});

describe("makeLocator (writer_ port)", () => {
  const book = fixtureWorkbook();
  const main = formattedGrid(book[MAIN]);
  const header = main[0].map((c, i) => (i === main[0].findIndex((x) => x === "10/4/2026") ? "04/10/2026" : c));
  const loc = makeLocator({
    mainTab: MAIN,
    shabzakTab: SHAB,
    appTab: "_app",
    header,
    names: main.map((r) => r[1] ?? ""),
    pids: main.map((r) => r[2] ?? ""),
    shabzak: formattedGrid(book[SHAB]),
    app: formattedGrid(book._app),
  });

  it("finds name / personal-number columns and the date columns", () => {
    expect(loc.nameCol).toBe(1);
    expect(loc.pidCol).toBe(2);
    expect(loc.dates["2026-09-01"]).toBe(12);
    expect(loc.dates["2026-10-04"]).toBe(12 + 33);
  });

  it("locates a status cell by name and date and writes the exact sheet string", () => {
    const r = rowOfName(book, "זיו מרגלית") + 1;
    const c = colLetter(loc.dates["2026-10-20"]);
    expect(loc.locate({ kind: "status", name: "זיו מרגלית", date: "2026-10-20", status: "abroad" })).toEqual({ range: `'${MAIN}'!${c}${r}`, values: [['חו"ל  - שמ"פ סגור']] });
    expect(loc.locate({ kind: "status", name: "זיו מרגלית", date: "2026-10-20", status: "" })!.values).toEqual([[""]]);
    expect(loc.locate({ kind: "status", name: "זיו מרגלית", date: "2026-10-20", status: "home" })!.values).toEqual([["בית"]]);
  });

  it("matches names with trailing spaces in the sheet", () => {
    // Names at index % 5 === 0 carry a trailing space in the fixture.
    const padded = main.slice(1).find((r) => /\s$/.test(r[1]) && r[1].trim())![1].trim();
    expect(loc.locate({ kind: "status", name: padded, date: "2026-10-20", status: "base" })).not.toBeNull();
  });

  it("skips unknown names and dates", () => {
    expect(loc.locate({ kind: "status", name: "אין כזה", date: "2026-10-20", status: "base" })).toBeNull();
    expect(loc.locate({ kind: "status", name: "זיו מרגלית", date: "2027-05-01", status: "base" })).toBeNull();
  });

  it("locates a vehicle cell by personal number in either שבצ\"ק block; numbers stay numbers", () => {
    const a = loc.locate({ kind: "veh", name: "נועם ברזילי", veh: "898" })!;
    expect(a).toEqual({ range: `'${SHAB}'!G3`, values: [[898]] });
    const b = loc.locate({ kind: "veh", name: "אסף לוטן", veh: "savana" })!;
    expect(b.range).toMatch(/!P\d+$/);
    expect(b.values).toEqual([["סוואנה"]]);
    expect(loc.locate({ kind: "veh", name: "אלעד צור", veh: "898" })).toBeNull(); // not in שבצ"ק
  });

  it("updates an existing _app row and appends new keys", () => {
    expect(loc.locate({ kind: "config", key: "alerts", value: { breaks: [] } })).toEqual({ range: "'_app'!A2:B2", values: [["alerts", '{"breaks":[]}']] });
    const empty = makeLocator({ mainTab: MAIN, shabzakTab: null, appTab: "_app", header, names: [], pids: [], shabzak: [], app: [] });
    expect(empty.locate({ kind: "config", key: "roles", value: {} })!.range).toBe("'_app'!A1:B1");
    expect(empty.locate({ kind: "config", key: "alerts", value: {} })!.range).toBe("'_app'!A2:B2");
  });
});

describe("applyChanges (end to end on the in-memory sheet)", () => {
  beforeEach(() => {
    resetReaderCache();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("writes only the located cells and the change shows up in /api/data", async () => {
    const src = mockSource(fixtureWorkbook());
    const before = JSON.stringify(src.book);
    const r = await applyChanges(
      src,
      [
        { kind: "status", name: "נועם ברזילי", date: "2026-10-21", status: "home" },
        { kind: "veh", name: "נועם ברזילי", veh: "berlingo" },
        { kind: "status", name: "אין כזה", date: "2026-10-21", status: "home" },
        { kind: "veh", name: "אלעד צור", veh: "898" },
      ],
      "test@example.test",
    );
    expect(r).toEqual({ done: 2, skipped: ["אין כזה 2026-10-21", "אלעד צור (רכב)"] });
    const row = rowOfName(src.book, "נועם ברזילי");
    expect(src.book[MAIN][row][dateCol(src.book, "2026-10-21")]).toBe("בית");
    expect(cellOf(src.book, SHAB, "G3")).toBe("ברלינגו");
    // Nothing else changed: same number of differing cells as writes.
    const a = JSON.parse(before) as Record<string, MockGrid>;
    let diff = 0;
    for (const t of Object.keys(a)) a[t].forEach((rr, i) => rr.forEach((c, j) => JSON.stringify(c) !== JSON.stringify(src.book[t][i][j]) && diff++));
    expect(diff).toBe(2);
    const d = await readAll(src);
    const s = d.soldiers.find((x) => x.name === "נועם ברזילי")!;
    expect(s.plan["2026-10-21"]).toBe("home");
    expect(s.sheetVeh).toBe("berlingo");
  });

  it("a no-op write keeps the cell value", async () => {
    const src = mockSource(fixtureWorkbook());
    const row = rowOfName(src.book, "זיו מרגלית");
    const col = dateCol(src.book, "2026-10-20");
    expect(src.book[MAIN][row][col]).toBe('חו"ל  - שמ"פ סגור');
    await applyChanges(src, [{ kind: "status", name: "זיו מרגלית", date: "2026-10-20", status: "abroad" }], "t");
    expect(src.book[MAIN][row][col]).toBe('חו"ל  - שמ"פ סגור');
  });

  it("saves roles to _app and creates the tab when missing", async () => {
    const book = fixtureWorkbook();
    delete book._app;
    const src = mockSource(book);
    const r = await applyChanges(src, [{ kind: "config", key: "roles", value: { cmd: ["א"], pakal: { א: "נהג" } } }], "t");
    expect(r.done).toBe(1);
    expect(src.book._app[0]).toEqual(["roles", '{"cmd":["א"],"pakal":{"א":"נהג"}}']);
    resetReaderCache();
    expect((await readAll(src)).config.roles).toEqual({ cmd: ["א"], pakal: { א: "נהג" } });
  });

  it("logs one line per write without sensitive data", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await applyChanges(mockSource(fixtureWorkbook()), [{ kind: "status", name: "זיו מרגלית", date: "2026-10-20", status: "base" }], "cmdr@example.test");
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({ ev: "write", by: "cmdr@example.test", kind: "status", date: "2026-10-20" });
  });
});
