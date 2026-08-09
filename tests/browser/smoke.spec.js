"use strict";

const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const routes = ["/index.html", "/hub.html", "/contribute.html", "/roadmap.html", "/ar/index.html", "/ar/hub.html", "/ar/contribute.html", "/ar/roadmap.html"];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/public-metrics**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ status: "available", projects: 3, initiatives: 2, visits: 10, project_views: {} })
  }));
});

for (const route of routes) {
  test(`${route} renders without serious accessibility violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const severe = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
    expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
  });
}

for (const route of ["/index.html", "/ar/index.html"]) {
  test(`${route} mobile menu supports focus and Escape`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const menu = page.locator("#coreMenu");
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#myDropdown")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  });
}

for (const route of ["/releases.html", "/ar/releases.html"]) {
  test(`${route} renders the complete release timeline`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".rl-card")).toHaveCount(21);
    await expect(page.locator(".rl-card").first()).toContainText("v3.3.0");
    await expect(page.locator("#rlTl")).not.toContainText(/Could not load release data|تعذر تحميل بيانات الإصدارات/);
  });
}
