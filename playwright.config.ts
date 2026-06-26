import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.QA_BASE_URL || "http://127.0.0.1:18080",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.QA_USE_EXISTING_SERVER === "true" ? undefined : [
    {
      command: "npm.cmd run server",
      port: 18787,
      reuseExistingServer: false,
      env: { API_PORT: "18787", APP_ORIGIN: "http://127.0.0.1:18080", LEGACY_AUTH_ENABLED: "false", ADMIN_API_TOKEN: "qa-admin-token" },
    },
    {
      command: "npx.cmd next dev -p 18080",
      port: 18080,
      reuseExistingServer: false,
      env: {
        API_INTERNAL_URL: "http://127.0.0.1:18787",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
    },
  ],
});
