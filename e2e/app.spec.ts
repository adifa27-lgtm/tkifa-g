/**
 * UI checks against the production build serving the synthetic fixture (MOCK_SHEET=1).
 * Screenshots of every view at 375 px go to e2e/screenshots/ (git-ignored).
 * Tests that write restore what they changed, because the mock sheet lives in server memory.
 */
import { expect, test, type Page } from "@playwright/test";
import type { AppData } from "../lib/core/types";

const SHOTS = "e2e/screenshots";
const TODAY = new Date("2026-10-20T09:00:00+03:00");

async function open(page: Page) {
  await page.clock.setFixedTime(TODAY);
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
}

async function noHorizontalOverflow(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(r.sw, "page must not scroll sideways").toBeLessThanOrEqual(r.cw);
}

async function shot(page: Page, name: string) {
  await noHorizontalOverflow(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const openCard = (page: Page, text: string) => page.locator(".unit.wide", { hasText: text }).click();

test.describe("views at 375 px", () => {
  test("home", async ({ page }) => {
    await open(page);
    await expect(page.locator(".syncbar")).toContainText("מחובר לשיט · עודכן");
    await expect(page.locator(".datebar")).toContainText("יום שלישי · 20/10/2026");
    await expect(page.locator(".datebar .ev")).toHaveText("תרגיל פלוגתי");
    await expect(page.locator(".hero .big b")).toHaveText("23");
    await expect(page.locator(".hero .big span")).toHaveText("מתוך 36 בשירות · 1 צו סגור");
    await expect(page.locator(".unit:not(.wide)")).toHaveCount(7);
    await expect(page.locator("#wa")).toContainText("שלח דוח בווטסאפ");
    await shot(page, "01-home");
  });

  test("team + status sheet", async ({ page }) => {
    await open(page);
    await page.locator(".unit", { hasText: "צוות אלון" }).click();
    await expect(page.locator("h2")).toHaveText("צוות אלון");
    await expect(page.locator(".srow.cmd").first()).toContainText("איתמר לבנון");
    await expect(page.locator(".lbadge").first()).toBeVisible();
    await shot(page, "02-team");
    await page.locator(".srow", { hasText: "בועז חרמון" }).locator(".pill").click();
    await expect(page.locator(".sheet")).toBeVisible();
    await expect(page.locator(".sheet .opt.sel")).toHaveText("בבית");
    await expect(page.locator("#wa")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/03-status-sheet.png` });
    await page.keyboard.press("Escape");
    await expect(page.locator(".sheet")).toHaveCount(0);
  });

  test("crew + role sheet", async ({ page }) => {
    await open(page);
    await openCard(page, 'שבצ"ק רכבים');
    await expect(page.locator("h2")).toHaveText('שבצ"ק רכבים');
    await expect(page.locator(".sectionhead .eyebrow", { hasText: 'מפל"ג' })).toHaveCount(0);
    await shot(page, "04-crew");
    await page.locator(".crow", { hasText: "פלג תמיר" }).locator("button.pk").click();
    await expect(page.locator(".sheet")).toContainText("תפקיד / פק\"ל");
    await page.screenshot({ path: `${SHOTS}/05-role-sheet.png` });
  });

  test("attached", async ({ page }) => {
    await open(page);
    await openCard(page, "סטטוס מסופחים");
    await expect(page.locator(".arow")).toHaveCount(5);
    await page.locator(".fchip", { hasText: "מאושר" }).first().click();
    await expect(page.locator(".arow")).toHaveCount(1);
    await shot(page, "06-attached");
  });

  test("alerts", async ({ page }) => {
    await open(page);
    await openCard(page, "התראות שבוע קרוב");
    await expect(page.locator(".sectionhead .eyebrow", { hasText: "דורש טיפול" })).toBeVisible();
    await expect(page.locator(".lrow.over")).toContainText("דניאל שגיא");
    await expect(page.locator(".brk")).toHaveCount(1);
    await shot(page, "07-alerts");
  });

  test("שמ\"פ changes", async ({ page }) => {
    await open(page);
    await openCard(page, 'שינויי שמ"פ היום');
    await expect(page.locator(".roster").first()).toContainText("זיו מרגלית");
    await shot(page, "08-shmap");
  });

  test("company data", async ({ page }) => {
    await open(page);
    await openCard(page, 'נתוני מ"פ');
    await page.locator(".tile", { hasText: "בבית" }).click();
    await expect(page.locator(".drill")).toContainText("בבית · 7");
    await expect(page.locator("#wa")).toContainText("שלח רשימה בווטסאפ");
    await expect(page.locator("tr.total td").first()).toHaveText('סה"כ פלוגה');
    await shot(page, "09-summary");
  });

  test("connect & install", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "חיבור והתקנה" }).click();
    await expect(page.locator("h2")).toHaveText("חיבור והתקנה");
    await expect(page.getByRole("button", { name: "התנתקות" })).toBeVisible();
    await expect(page.locator("#wa")).toHaveCount(0);
    await shot(page, "10-connect");
  });

  test("dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(13, 16, 23)");
    await shot(page, "11-home-dark");
  });
});

test.describe("behaviour", () => {
  test("date bar moves days and returns to today", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "יום הבא" }).click();
    await expect(page.locator(".datebar")).toContainText("21/10/2026");
    await page.getByRole("button", { name: "חזרה להיום" }).click();
    await expect(page.locator(".datebar")).toContainText("20/10/2026");
  });

  test("changing a status writes to the sheet immediately", async ({ page, request }) => {
    await open(page);
    await page.locator(".unit", { hasText: "צוות גפן" }).click();
    const row = page.locator(".srow", { hasText: "שי אדר" });
    await expect(row.locator(".pill")).toHaveText("בחר סטטוס");
    await row.locator(".pill").click();
    await page.locator(".sheet .opt", { hasText: "התארגנות" }).click();
    await expect(page.locator(".toast")).toHaveText("נשמר: שי אדר · התארגנות");
    await expect(row.locator(".pill")).toHaveText("התארגנות");
    const d = (await (await request.get("/api/data")).json()) as AppData;
    expect(d.soldiers.find((s) => s.name === "שי אדר")!.plan["2026-10-20"]).toBe("org");
    // Clear it again (restores the fixture).
    await row.locator(".pill").click();
    await page.getByRole("button", { name: "נקה סטטוס" }).click();
    await expect(page.locator(".toast")).toHaveText("הסטטוס נוקה");
    const d2 = (await (await request.get("/api/data")).json()) as AppData;
    expect(d2.soldiers.find((s) => s.name === "שי אדר")!.plan["2026-10-20"]).toBeUndefined();
  });

  test("vehicle select writes to שבצ\"ק; soldiers not in שבצ\"ק are refused", async ({ page, request }) => {
    await open(page);
    await openCard(page, 'שבצ"ק רכבים');
    const sel = page.locator(".crow", { hasText: "רועי נחשון" }).locator("select");
    await sel.selectOption("berlingo");
    await expect(page.locator(".toast")).toHaveText("נשמר: רועי נחשון · ברלינגו");
    let d = (await (await request.get("/api/data")).json()) as AppData;
    expect(d.soldiers.find((s) => s.name === "רועי נחשון")!.sheetVeh).toBe("berlingo");
    await sel.selectOption("");
    await expect(page.locator(".toast")).toHaveText("נשמר: רועי נחשון · ללא רכב");
    d = (await (await request.get("/api/data")).json()) as AppData;
    expect(d.soldiers.find((s) => s.name === "רועי נחשון")!.sheetVeh).toBe("");

    await page.locator(".crow", { hasText: "עידן פלג" }).locator("select").selectOption("898");
    await expect(page.locator(".toast")).toHaveText('עידן פלג לא מופיע בלשונית שבצ"ק בשיט');
  });

  test("a failed write shows a Hebrew error and reverts", async ({ page }) => {
    await open(page);
    await page.route("**/api/changes", (r) => r.fulfill({ status: 502, body: "{}" }));
    await page.locator(".unit", { hasText: "צוות גפן" }).click();
    const row = page.locator(".srow", { hasText: "שי אדר" });
    await row.locator(".pill").click();
    await page.locator(".sheet .opt", { hasText: "בסיס" }).click();
    await expect(page.locator(".toast")).toHaveText("השמירה בשיט נכשלה. בדוק חיבור ונסה שוב");
    await expect(row.locator(".pill")).toHaveText("בחר סטטוס");
  });

  test("opens instantly from the device cache when offline", async ({ page }) => {
    await open(page);
    await page.route("**/api/**", (r) => r.abort());
    await page.reload();
    await expect(page.locator(".hero .big b")).toHaveText("23");
    await expect(page.locator(".syncbar")).toContainText("אין חיבור · מוצגים הנתונים האחרונים");
  });

  test("approved periods editor saves to _app", async ({ page, request }) => {
    await open(page);
    await openCard(page, "התראות שבוע קרוב");
    await page.locator("#brkfrom").fill("2026-12-01");
    await page.locator("#brkto").fill("2026-12-03");
    await page.locator("#brklabel").fill("בדיקה");
    await page.getByRole("button", { name: "הוסף" }).click();
    await expect(page.locator(".toast")).toHaveText("התקופה נוספה");
    let d = (await (await request.get("/api/data")).json()) as AppData;
    expect(d.config.alerts?.breaks).toHaveLength(2);
    await page.locator(".brk", { hasText: "בדיקה" }).getByRole("button", { name: "מחק תקופה" }).click();
    await expect(page.locator(".toast")).toHaveText("התקופה נמחקה");
    d = (await (await request.get("/api/data")).json()) as AppData;
    expect(d.config.alerts?.breaks).toHaveLength(1);
  });
});
