import "server-only";
import type { Change, ChangesResult } from "../core/types";
import { colLetter, fixHeader, q } from "../sheet/a1";
import { makeLocator, skippedLabel, type CellWrite } from "../sheet/locate";
import { norm } from "../core/util";
import { tabsOf } from "./reader";
import type { SheetSource } from "./source";

/**
 * Applies changes exactly like writer_() in apps-script.gs: re-reads the header and the
 * name / personal-number columns right before writing, locates each cell, then writes only
 * those cells in one values.batchUpdate. Never inserts rows or columns.
 */
export async function applyChanges(src: SheetSource, changes: Change[], by: string): Promise<ChangesResult> {
  const { tabs } = await tabsOf(src, true);
  let appTab = tabs.app;
  const needsApp = changes.some((c) => c.kind === "config");
  if (needsApp && !appTab) {
    await src.addHiddenSheet("_app");
    appTab = "_app";
  }
  const needsShab = changes.some((c) => c.kind === "veh") && !!tabs.shabzak;

  const ranges = [`${q(tabs.main)}!1:1`];
  if (needsShab) ranges.push(q(tabs.shabzak!));
  if (needsApp) ranges.push(`${q(appTab!)}!A:B`);
  const [vals, [rawHead]] = await Promise.all([src.batchGet(ranges), src.batchGet([`${q(tabs.main)}!1:1`], true)]);
  const header = fixHeader(vals[0]?.[0] || [], rawHead?.[0] || []);
  const hn = header.map(norm);
  const nameCol = hn.findIndex((h) => h === "שם");
  const pidCol = hn.findIndex((h) => h === "מספר אישי");
  let i = 1;
  const shabzak = needsShab ? vals[i++] || [] : [];
  const app = needsApp ? vals[i++] || [] : [];

  let names: unknown[] = [];
  let pids: unknown[] = [];
  if (nameCol >= 0) {
    const cols = [`${q(tabs.main)}!${colLetter(nameCol)}:${colLetter(nameCol)}`];
    if (pidCol >= 0) cols.push(`${q(tabs.main)}!${colLetter(pidCol)}:${colLetter(pidCol)}`);
    const got = await src.batchGet(cols);
    names = (got[0] || []).map((r) => r?.[0] ?? "");
    pids = pidCol >= 0 ? (got[1] || []).map((r) => r?.[0] ?? "") : [];
  }

  const loc = makeLocator({ mainTab: tabs.main, shabzakTab: tabs.shabzak, appTab: appTab || "_app", header, names, pids, shabzak, app });
  const writes = new Map<string, CellWrite>();
  const skipped: string[] = [];
  const doneList: Change[] = [];
  for (const ch of changes) {
    const w = nameCol >= 0 || ch.kind === "config" ? loc.locate(ch) : null;
    if (!w) {
      skipped.push(skippedLabel(ch));
      continue;
    }
    writes.delete(w.range); // last write wins, keep order
    writes.set(w.range, w);
    doneList.push(ch);
  }
  if (writes.size) await src.batchUpdate([...writes.values()]);
  for (const ch of doneList) {
    console.log(JSON.stringify({ ev: "write", by, kind: ch.kind, date: ch.kind === "status" ? ch.date : undefined, key: ch.kind === "config" ? ch.key : undefined }));
  }
  return { done: doneList.length, skipped };
}
