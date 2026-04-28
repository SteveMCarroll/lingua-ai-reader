import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:4173", // vite preview default
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run preview",
    port: 4173,
    reuseExistingServer: true,
  },
});
