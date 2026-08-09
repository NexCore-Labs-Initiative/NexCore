"use strict";

const { defineConfig } = require("@playwright/test");
const port = process.env.PLAYWRIGHT_PORT || "4187";

module.exports = defineConfig({
  testDir: "tests/browser",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce"
  },
  webServer: {
    command: `npx http-server . -p ${port} -c-1`,
    url: `http://127.0.0.1:${port}/index.html`,
    reuseExistingServer: false,
    timeout: 30_000
  }
});
