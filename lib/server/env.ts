import "server-only";
import { googleSource } from "./google";
import { mockSource } from "./mock";
import type { SheetSource } from "./source";

/** MOCK_SHEET=1 serves the synthetic fixture with a fake signed-in user. Refused on Vercel. */
export function isMock(): boolean {
  if (process.env.MOCK_SHEET !== "1") return false;
  if (process.env.VERCEL) throw new Error("MOCK_SHEET must never be enabled on Vercel");
  return true;
}

const g = globalThis as unknown as { __tkifaSource?: SheetSource };

export function getSource(): SheetSource {
  if (g.__tkifaSource) return g.__tkifaSource;
  if (isMock()) {
    g.__tkifaSource = mockSource();
  } else {
    const email = process.env.GOOGLE_SA_EMAIL;
    const key = process.env.GOOGLE_SA_PRIVATE_KEY;
    const sheetId = process.env.SHEET_ID;
    if (!email || !key || !sheetId) throw new Error("Missing GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY / SHEET_ID");
    g.__tkifaSource = googleSource({ email, key, sheetId });
  }
  return g.__tkifaSource;
}
