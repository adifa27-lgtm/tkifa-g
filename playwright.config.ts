import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "Asia/Jerusalem",
    locale: "he-IL",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } } }],
  // Production build served against the synthetic fixture (MOCK_SHEET=1). Run `pnpm build` first.
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { MOCK_SHEET: "1", AUTH_SECRET: "e2e-only-secret-0000000000000000000000" },
  },
});
