/**
 * Parity test: the source-of-truth artifact (reference/artifact-app.html) is loaded in a headless
 * browser with its Claude data layer stubbed out and the SAME synthetic workbook injected. Its
 * counts, alert lists and WhatsApp texts must equal ours (server pipeline + model + rendered UI)
 * for several dates. Skipped when reference/ is absent (it is never committed).
 *
 * Only intentional difference applied to the artifact: no commander-confirmation layer, i.e.
 * confirmed(list) = active(list).length (exactly what the PWA port did).
 */
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import type { AppData } from "../lib/core/types";
import { artifactGrid, fixtureWorkbook } from "../lib/mock/fixture";
import { ART, DATES, artifactSnapshot, loadArtifact, ourSnapshot } from "./harness";

test.skip(!fs.existsSync(ART), "reference/artifact-app.html not present");

test("artifact and app agree on counts, alerts and WhatsApp texts", async ({ page, request }) => {
  const book = Object.fromEntries(Object.entries(fixtureWorkbook()).map(([k, g]) => [k, artifactGrid(g)]));
  await loadArtifact(page);
  const theirs = await page.evaluate(artifactSnapshot, { book, dates: DATES });

  // Ours: the real server pipeline (mock source) through /api/data, then the shared model.
  const res = await request.get("/api/data");
  expect(res.ok()).toBeTruthy();
  const data = (await res.json()) as AppData;
  const ours = ourSnapshot(data, DATES);

  // Guard against a vacuous comparison.
  const t20 = theirs["2026-10-20"] as { long: unknown[]; closed: unknown[]; shmap: { closed: unknown[]; opened: unknown[] }; wa: Record<string, string> };
  expect(theirs.n).toBeGreaterThan(30);
  expect(t20.long.length).toBeGreaterThan(2);
  expect(t20.closed.length).toBeGreaterThan(1);
  expect(t20.shmap.closed.length + t20.shmap.opened.length).toBeGreaterThan(2);
  expect(Object.keys(t20.wa).length).toBeGreaterThan(15);
  expect(t20.wa.crew).toContain("האמר");
  expect(ours.n).toBe(theirs.n);
  expect(ours.events).toEqual(theirs.events);
  for (const d of DATES) {
    const a = theirs[d] as Record<string, unknown>;
    const b = ours[d] as Record<string, unknown>;
    for (const k of Object.keys(a)) expect(b[k], `${d} · ${k}`).toEqual(a[k]);
  }
});

test("rendered app sends byte-identical WhatsApp texts", async ({ page, browser }) => {
  const book = Object.fromEntries(Object.entries(fixtureWorkbook()).map(([k, g]) => [k, artifactGrid(g)]));
  const artPage = await browser.newPage();
  await loadArtifact(artPage);
  const theirs = (await artPage.evaluate(artifactSnapshot, { book, dates: ["2026-10-20"] })) as Record<string, { wa: Record<string, string> }>;
  const wa = theirs["2026-10-20"].wa;

  await page.clock.setFixedTime(new Date("2026-10-20T09:00:00+03:00"));
  await page.goto("/");
  const link = page.locator("#wa");
  const textOf = async () => decodeURIComponent((await link.getAttribute("href"))!.replace("https://wa.me/?text=", ""));
  await expect(page.locator(".hero")).toBeVisible();
  expect(await textOf()).toBe(wa.home);

  await page.locator(".unit").first().click();
  await expect(page.locator("h2")).toBeVisible();
  const firstUnit = Object.keys(wa).find((k) => k.startsWith("unit:"))!;
  expect(await textOf()).toBe(wa[firstUnit]);
  await page.locator(".back").click();

  for (const [btn, key] of [
    ["שבצ\"ק רכבים", "crew"],
    ["התראות שבוע קרוב", "long"],
    ["שינויי שמ\"פ היום", "shmap"],
    ["נתוני מ\"פ", "summary"],
  ] as const) {
    await page.locator(".unit.wide", { hasText: btn }).click();
    await expect(page.locator("h2")).toBeVisible();
    expect(await textOf(), key).toBe(wa[key]);
    if (key === "summary") {
      await page.locator(".tile").filter({ hasText: "בבית" }).click();
      expect(await textOf(), "drill:home").toBe(wa["drill:home"]);
    }
    await page.locator(".back").click();
  }
});
