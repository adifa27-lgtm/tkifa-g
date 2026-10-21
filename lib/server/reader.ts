import "server-only";
import type { AppData } from "../core/types";
import { norm } from "../core/util";
import { colLetter, fixHeader, q } from "../sheet/a1";
import { buildData, dataPidCol, headerAt, type Grid, type Grids } from "../sheet/parse";
import { pickTabs, type TabNames } from "../sheet/tabs";
import type { SheetSource, Values } from "./source";

const META_TTL = 5 * 60e3;
let metaCache: { at: number; src: SheetSource; title: string; tabs: TabNames } | null = null;
/** Positions of the two DATA-tab columns we are allowed to read. */
let dataCols: { src: SheetSource; tab: string; headerRow: number; pid: number; role: number } | null = null;

export async function tabsOf(src: SheetSource, fresh = false): Promise<{ title: string; tabs: TabNames }> {
  if (!fresh && metaCache && metaCache.src === src && Date.now() - metaCache.at < META_TTL) return metaCache;
  const m = await src.meta();
  const tabs = pickTabs(m.tabs);
  if (!tabs) throw new Error("no tabs");
  metaCache = { at: Date.now(), src, title: m.title, tabs };
  return metaCache;
}

export const toGrid = (v: Values | undefined): Grid => (v || []).map((r) => (r || []).map((c) => (c == null ? "" : String(c))));

/**
 * Finds the מ.א and תפקיד ראשי columns of the DATA tab by reading only its first rows,
 * so ID numbers, addresses etc. are never even downloaded.
 */
async function locateDataCols(src: SheetSource, tab: string) {
  if (dataCols && dataCols.src === src && dataCols.tab === tab) return dataCols;
  const [head] = await src.batchGet([`${q(tab)}!1:8`]);
  const g = toGrid(head);
  const hr = headerAt(g, (h) => h.includes("תפקיד ראשי"));
  if (hr < 0) return null;
  const h = g[hr].map(norm);
  const pid = dataPidCol(h);
  const role = h.indexOf("תפקיד ראשי");
  if (pid < 0 || role < 0) return null;
  dataCols = { src, tab, headerRow: hr, pid, role };
  return dataCols;
}

/** Zips two single-column reads back into a 2-column grid [[pid, role], …]. */
function zipCols(a: Values | undefined, b: Values | undefined): Grid {
  const n = Math.max(a?.length || 0, b?.length || 0);
  const out: Grid = [];
  for (let i = 0; i < n; i++) out.push([String(a?.[i]?.[0] ?? ""), String(b?.[i]?.[0] ?? "")]);
  return out;
}

export async function readAll(src: SheetSource): Promise<AppData> {
  // Version first: if the sheet changes while we read, the next poll sees a newer version.
  const ver = await src.modifiedTime();
  const { title, grids } = await readGrids(src);
  return { ver, title, sheetUrl: src.sheetUrl, ...buildData(grids) };
}

/** The (already minimised) grids the app parses: main tab with a fixed header, 2 DATA columns, other tabs. */
export async function readGrids(src: SheetSource): Promise<{ title: string; grids: Grids }> {
  const { title, tabs } = await tabsOf(src);
  let dc = tabs.data ? await locateDataCols(src, tabs.data) : null;

  const load = async () => {
    const ranges = [q(tabs.main)];
    const idx: Record<string, number> = {};
    const add = (k: string, r: string) => {
      idx[k] = ranges.length;
      ranges.push(r);
    };
    if (tabs.shabzak) add("shabzak", q(tabs.shabzak));
    if (tabs.attached) add("attached", q(tabs.attached));
    if (tabs.app) add("app", `${q(tabs.app)}!A:B`);
    if (tabs.data && dc) {
      add("dpid", `${q(tabs.data)}!${colLetter(dc.pid)}:${colLetter(dc.pid)}`);
      add("drole", `${q(tabs.data)}!${colLetter(dc.role)}:${colLetter(dc.role)}`);
    }
    const [vals, [rawHead]] = await Promise.all([src.batchGet(ranges), src.batchGet([`${q(tabs.main)}!1:1`], true)]);
    return { vals, idx, rawHead };
  };

  let { vals, idx, rawHead } = await load();
  let data: Grid | undefined = dc ? zipCols(vals[idx.dpid], vals[idx.drole]) : undefined;
  // DATA columns moved since we cached them: locate again once.
  if (dc && data && !norm(data[dc.headerRow]?.[1]).includes("תפקיד ראשי")) {
    dataCols = null;
    dc = tabs.data ? await locateDataCols(src, tabs.data) : null;
    ({ vals, idx, rawHead } = await load());
    data = dc ? zipCols(vals[idx.dpid], vals[idx.drole]) : undefined;
  }

  const main = toGrid(vals[0]);
  if (main.length) main[0] = fixHeader(main[0], rawHead?.[0] || []);
  return {
    title,
    grids: {
      main,
      data,
      shabzak: idx.shabzak != null ? toGrid(vals[idx.shabzak]) : undefined,
      attached: idx.attached != null ? toGrid(vals[idx.attached]) : undefined,
      app: idx.app != null ? toGrid(vals[idx.app]) : undefined,
    },
  };
}

/** Test hook: forget cached tab names / DATA columns. */
export function resetReaderCache() {
  metaCache = null;
  dataCols = null;
}
