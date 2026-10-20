import { createModel, type ModelState } from "@/lib/core/model";
import type { AppData } from "@/lib/core/types";
import { FIXTURE_TODAY, fixtureWorkbook } from "@/lib/mock/fixture";
import { mockSource } from "@/lib/server/mock";
import { readAll, resetReaderCache } from "@/lib/server/reader";

export async function fixtureData(): Promise<AppData> {
  resetReaderCache();
  return readAll(mockSource(fixtureWorkbook()));
}

export function modelFor(d: AppData, over: Partial<ModelState> = {}) {
  return createModel({
    soldiers: d.soldiers,
    date: FIXTURE_TODAY,
    roles: d.config.roles,
    alerts: d.config.alerts,
    attached: d.attached,
    view: "home",
    unit: null,
    drill: null,
    attFilter: null,
    ...over,
  });
}
