/** PWA installability checks (what Lighthouse's PWA audit used to cover). */
import { expect, test } from "@playwright/test";

test("manifest: standalone, theme colour, icons", async ({ request }) => {
  const r = await request.get("/manifest.webmanifest");
  expect(r.ok()).toBeTruthy();
  const m = await r.json();
  expect(m.display).toBe("standalone");
  expect(m.theme_color).toBe("#121826");
  expect(m.start_url).toBe("/");
  expect(m.name).toBeTruthy();
  expect(m.short_name).toBeTruthy();
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const i of m.icons) {
    const ir = await request.get(i.src);
    expect(ir.ok(), i.src).toBeTruthy();
    expect(ir.headers()["content-type"]).toContain("image/png");
  }
  expect((await request.get("/apple-touch-icon.png")).ok()).toBeTruthy();
});

test("iOS meta tags, theme-color, service worker and installability", async ({ page }) => {
  await page.goto("/");
  const meta = async (n: string) => page.locator(`meta[name="${n}"]`).first().getAttribute("content");
  expect(await meta("theme-color")).toBe("#121826");
  expect(await meta("apple-mobile-web-app-capable")).toBe("yes");
  expect(await meta("apple-mobile-web-app-status-bar-style")).toBe("black-translucent");
  expect(await meta("apple-mobile-web-app-title")).toBeTruthy();
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  expect(await page.locator("html").getAttribute("dir")).toBe("rtl");

  const active = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(active).toBe(true);

  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: { errorId: string }[] };
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
});

test("health endpoint exposes only {ok}", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(await r.json()).toEqual({ ok: true });
});
