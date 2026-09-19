const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "tests/browser",
  testMatch: "study-hub.spec.js",
  workers: 1,
  // Docker/psql is intentionally used instead of mocking database transitions.
  expect: { timeout: 15000 },
  timeout: 180000,
  use: {
    actionTimeout: 15000,
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : {},
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/helpers/study-hub-server.cjs",
    url: "http://127.0.0.1:4189/study-hub-admin.html",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
