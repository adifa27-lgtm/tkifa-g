import "server-only";
import { colIndex } from "../sheet/a1";
import { FIXTURE_ALLOWED, FIXTURE_TITLE, fixtureWorkbook, type MockCell, type MockGrid } from "../mock/fixture";
import type { SheetSource, Values } from "./source";

interface Parsed {
  tab: string;
  r0: number; // 0-based inclusive
  r1: number; // 0-based inclusive (Infinity = to the end)
  c0: number;
  c1: number;
}

export function parseRange(range: string): Parsed {
  const m = range.match(/^'((?:[^']|'')*)'(?:!(.+))?$/) || range.match(/^([^!']+)(?:!(.+))?$/);
  if (!m) throw new Error("bad range " + range);
  const tab = m[1].replace(/''/g, "'");
  const part = m[2];
  const all = { tab, r0: 0, r1: Infinity, c0: 0, c1: Infinity };
  if (!part) return all;
  let x: RegExpMatchArray | null;
  if ((x = part.match(/^(\d+):(\d+)$/))) return { ...all, r0: +x[1] - 1, r1: +x[2] - 1 };
  if ((x = part.match(/^([A-Z]+):([A-Z]+)$/))) return { ...all, c0: colIndex(x[1]), c1: colIndex(x[2]) };
  if ((x = part.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/)))
    return { tab, r0: +x[2] - 1, r1: +(x[4] ?? x[2]) - 1, c0: colIndex(x[1]), c1: colIndex(x[3] ?? x[1]) };
  throw new Error("unsupported range " + range);
}

const fmt = (c: MockCell | undefined) => (c == null ? "" : typeof c === "string" ? c : c.f);
const unf = (c: MockCell | undefined) => (c == null ? "" : typeof c === "string" ? c : c.u);

/** In-memory workbook that behaves like the Sheets/Drive APIs (trailing empties trimmed). */
export function mockSource(book: Record<string, MockGrid> = fixtureWorkbook(), allowed: string[] = FIXTURE_ALLOWED): SheetSource & { book: Record<string, MockGrid> } {
  let modified = new Date("2026-10-20T06:00:00Z").toISOString();
  const grid = (tab: string) => {
    const g = book[tab];
    if (!g) throw new Error(`Unable to parse range: ${tab}`);
    return g;
  };
  return {
    book,
    sheetUrl: "https://docs.google.com/spreadsheets/d/MOCK/edit",
    async meta() {
      return { title: FIXTURE_TITLE, tabs: Object.keys(book) };
    },
    async modifiedTime() {
      return modified;
    },
    async batchGet(ranges: string[], unformatted = false): Promise<Values[]> {
      return ranges.map((range) => {
        const p = parseRange(range);
        const g = grid(p.tab);
        const out: Values = [];
        for (let r = p.r0; r <= Math.min(p.r1, g.length - 1); r++) {
          const row = g[r] || [];
          const vals: (string | number)[] = [];
          for (let c = p.c0; c <= Math.min(p.c1, row.length - 1); c++) vals.push(unformatted ? unf(row[c]) : fmt(row[c]));
          while (vals.length && vals[vals.length - 1] === "") vals.pop();
          out.push(vals);
        }
        while (out.length && !out[out.length - 1].length) out.pop();
        return out;
      });
    },
    async batchUpdate(data) {
      for (const { range, values } of data) {
        const p = parseRange(range);
        const g = grid(p.tab);
        values.forEach((row, i) =>
          row.forEach((v, j) => {
            const r = p.r0 + i,
              c = p.c0 + j;
            while (g.length <= r) g.push([]);
            while (g[r].length <= c) g[r].push("");
            g[r][c] = String(v);
          }),
        );
      }
      modified = new Date().toISOString();
    },
    async addHiddenSheet(title: string) {
      book[title] = [];
    },
    async permissions() {
      return [
        { emailAddress: "owner@example.test", role: "owner", type: "user" },
        ...allowed.map((e) => ({ emailAddress: e, role: "writer", type: "user" })),
        { role: "reader", type: "anyone" },
      ];
    },
  };
}
