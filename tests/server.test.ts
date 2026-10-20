import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAKE_SENSITIVE, fixtureWorkbook, formattedGrid } from "@/lib/mock/fixture";
import { buildData } from "@/lib/sheet/parse";
import { fixHeader } from "@/lib/sheet/a1";
import { emailsFrom, isAllowed, resetAccessCache } from "@/lib/server/access";
import { normalizePrivateKey } from "@/lib/server/google";
import { mockSource } from "@/lib/server/mock";
import { readAll, resetReaderCache } from "@/lib/server/reader";
import { changesBody } from "@/lib/server/schema";

describe("readAll", () => {
  beforeEach(() => resetReaderCache());

  it("returns processed JSON only — never sensitive DATA columns", async () => {
    const d = await readAll(mockSource(fixtureWorkbook()));
    expect(d.soldiers).toHaveLength(37);
    const json = JSON.stringify(d);
    for (const v of FAKE_SENSITIVE) expect(json).not.toContain(v);
    expect(Object.keys(d).sort()).toEqual(["attached", "config", "events", "sheetUrl", "soldiers", "title", "ver"]);
  });

  it("downloads only the מ.א and תפקיד ראשי columns of the DATA tab", async () => {
    const src = mockSource(fixtureWorkbook());
    const seen: string[] = [];
    const orig = src.batchGet.bind(src);
    src.batchGet = async (ranges, unf) => {
      seen.push(...ranges);
      return orig(ranges, unf);
    };
    await readAll(src);
    const dataRanges = seen.filter((r) => r.startsWith("'DATA"));
    expect(dataRanges).toEqual(["'DATA תקיפה ג'!1:8", "'DATA תקיפה ג'!B:B", "'DATA תקיפה ג'!H:H"]);
  });

  it("matches parsing the full grids", async () => {
    const b = fixtureWorkbook();
    const d = await readAll(mockSource(b));
    const main = formattedGrid(b["תקיפה ג׳"]);
    main[0] = fixHeader(main[0], b["תקיפה ג׳"][0].map((c) => (typeof c === "string" ? c : c.u)));
    const full = buildData({ main, data: formattedGrid(b["DATA תקיפה ג"]), shabzak: formattedGrid(b['שבצ"ק']), attached: formattedGrid(b["מסופחים"]), app: formattedGrid(b._app) });
    expect(d.soldiers).toEqual(full.soldiers);
    expect(d.attached).toEqual(full.attached);
    expect(d.config).toEqual(full.config);
    expect(d.events).toEqual(full.events);
  });

  it("re-locates DATA columns when they move", async () => {
    const b = fixtureWorkbook();
    const src = mockSource(b);
    await readAll(src);
    b["DATA תקיפה ג"].forEach((r) => r.unshift("")); // insert a column before everything
    const d = await readAll(src);
    expect(d.soldiers.find((s) => s.name === "נועם ברזילי")!.pakal).toBe("מפקד פלוגה");
  });
});

describe("access", () => {
  const saved = process.env.EXTRA_ALLOWED_EMAILS;
  beforeEach(() => resetAccessCache());
  afterEach(() => {
    process.env.EXTRA_ALLOWED_EMAILS = saved;
  });

  it("collects user and group emails only (not 'anyone with the link')", () => {
    expect([...emailsFrom([{ type: "user", emailAddress: "A@x.com" }, { type: "group", emailAddress: "g@x.com" }, { type: "anyone" }, { type: "domain" }])]).toEqual(["a@x.com", "g@x.com"]);
  });

  it("allows accounts the sheet is shared with, case-insensitively", async () => {
    const src = mockSource(fixtureWorkbook(), ["Commander@Example.test"]);
    expect(await isAllowed(src, "commander@example.test")).toBe(true);
    expect(await isAllowed(src, "COMMANDER@example.test")).toBe(true);
    expect(await isAllowed(src, "stranger@example.test")).toBe(false);
    expect(await isAllowed(src, "")).toBe(false);
  });

  it("honours EXTRA_ALLOWED_EMAILS", async () => {
    process.env.EXTRA_ALLOWED_EMAILS = " extra@example.test ,other@example.test";
    expect(await isAllowed(mockSource(fixtureWorkbook(), []), "Extra@example.test")).toBe(true);
  });

  it("caches the permission list and never grants access on error", async () => {
    const src = mockSource(fixtureWorkbook(), ["a@example.test"]);
    let calls = 0;
    const orig = src.permissions.bind(src);
    src.permissions = async () => {
      calls++;
      return orig();
    };
    await isAllowed(src, "a@example.test");
    await isAllowed(src, "a@example.test");
    expect(calls).toBe(1);
    const broken = mockSource(fixtureWorkbook());
    broken.permissions = async () => {
      throw new Error("boom");
    };
    await expect(isAllowed(broken, "a@example.test")).rejects.toThrow();
  });
});

describe("changes validation", () => {
  it("accepts the three change kinds", () => {
    expect(
      changesBody.safeParse({
        changes: [
          { kind: "status", pid: "1", name: "א", date: "2026-10-20", status: "base" },
          { kind: "status", name: "א", date: "2026-10-20", status: "" },
          { kind: "veh", name: "א", veh: "898" },
          { kind: "config", key: "roles", value: { cmd: [], pakal: {} } },
          { kind: "config", key: "alerts", value: { breaks: [{ from: "2026-10-01", to: "2026-10-02", label: "x" }] } },
        ],
      }).success,
    ).toBe(true);
  });
  it.each([
    [{ changes: [] }],
    [{ changes: [{ kind: "status", name: "א", date: "20/10/2026", status: "base" }] }],
    [{ changes: [{ kind: "status", name: "א", date: "2026-10-20", status: "vacation" }] }],
    [{ changes: [{ kind: "veh", name: "א", veh: "tank" }] }],
    [{ changes: [{ kind: "config", key: "changesFolderId", value: "x" }] }],
    [{ changes: [{ kind: "delete", name: "א" }] }],
  ])("rejects %j", (b) => expect(changesBody.safeParse(b).success).toBe(false));
});

describe("normalizePrivateKey", () => {
  it("restores newlines from env vars", () => {
    expect(normalizePrivateKey('"-----BEGIN-----\\nabc\\n-----END-----\\n"')).toBe("-----BEGIN-----\nabc\n-----END-----\n");
  });
});
