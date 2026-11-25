import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180000,
  retries: 0,
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4180 --strictPort",
    timeout: 180000,
    url: "http://127.0.0.1:4180",
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe"
  },
  use: {
    baseURL: "http://127.0.0.1:4180"
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      }
    }
  ]
});
