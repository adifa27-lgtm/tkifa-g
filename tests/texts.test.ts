import { beforeAll, describe, expect, it } from "vitest";
import type { AppData } from "@/lib/core/types";
import { fixtureData, modelFor } from "./helpers";

let d: AppData;
beforeAll(async () => {
  d = await fixtureData();
});

describe("WhatsApp texts (snapshots; byte-for-byte parity with the artifact is checked in e2e/parity.spec.ts)", () => {
  it("home / summary report", () => expect(modelFor(d).waText()).toMatchSnapshot());
  it("team", () => expect(modelFor(d, { view: "unit", unit: "צוות אלון" }).waText()).toMatchSnapshot());
  it("drill-down", () => expect(modelFor(d, { view: "summary", drill: "home" }).waText()).toMatchSnapshot());
  it("crew", () => expect(modelFor(d, { view: "crew" }).waText()).toMatchSnapshot());
  it("attached", () => expect(modelFor(d, { view: "attached" }).waText()).toMatchSnapshot());
  it("alerts", () => expect(modelFor(d, { view: "long" }).waText()).toMatchSnapshot());
  it("שמ\"פ", () => expect(modelFor(d, { view: "shmap" }).waText()).toMatchSnapshot());
  it("copy texts", () => {
    const m = modelFor(d);
    expect(m.reportText()).toMatchSnapshot();
    expect(m.longText()).toMatchSnapshot();
    expect(m.listText("home")).toMatchSnapshot();
  });

  it("uses the shared message frame", () => {
    const t = modelFor(d, { view: "unit", unit: "צוות אלון" }).waText();
    expect(t.startsWith("🪖 *צוות אלון* 🪖\n📅 יום שלישי · 20/10/2026\n\n👥 *סה״כ כוח: 7 חיילים*\n\n━━━━━━━━━━━━━━\n")).toBe(true);
    expect(t.endsWith("\n🎖️ *סה״כ כוח: 7 חיילים* 🎖️\n\n━━━━━━━━━━━━━━")).toBe(true);
    expect(t).toContain("1. איתמר לבנון — 8100031");
  });

  it("labels the button like the artifact", () => {
    expect(modelFor(d).waLabel()).toBe("שלח דוח בווטסאפ");
    expect(modelFor(d, { view: "summary", drill: "base" }).waLabel()).toBe("שלח רשימה בווטסאפ");
    expect(modelFor(d, { view: "crew" }).waLabel()).toBe("שלח בווטסאפ");
    expect(modelFor(d, { view: "import" }).waText()).toBe("");
  });
});
