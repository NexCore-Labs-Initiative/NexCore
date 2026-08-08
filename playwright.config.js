"use strict";

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests/browser",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4187",
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce"
  },
  webServer: {
    command: "npx http-server . -p 4187 -c-1",
    url: "http://127.0.0.1:4187/index.html",
    reuseExistingServer: false,
    timeout: 30_000
  }
});
