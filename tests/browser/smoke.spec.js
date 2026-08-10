"use strict";

const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const routes = ["/index.html", "/hub.html", "/contribute.html", "/roadmap.html", "/ar/index.html", "/ar/hub.html", "/ar/contribute.html", "/ar/roadmap.html"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nexcore_cookie_preferences", JSON.stringify({
      necessary: true,
      analytics: false,
      external_media: false,
      ai_services: false,
      timestamp: 1
    }));
  });
  await page.route(/^https:\/\//, (route) => route.abort());
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
    await expect(page.locator(".rl-card").first()).toHaveAttribute("id", "v3-3-0");
    await expect(page.locator("#rlTl")).not.toContainText(/Could not load release data|تعذر تحميل بيانات الإصدارات/);
  });
}

test.describe("living release beacon", () => {
  test("opens once, collapses, reopens, and dismisses for the promoted version", async ({ page }) => {
    test.slow();
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    const beacon = page.locator(".living-release__beacon");
    const panel = page.locator(".living-release__panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("v3.3.0 — Trust & Foundations");
    await expect(beacon).toHaveAttribute("aria-expanded", "true");

    await page.locator(".living-release__close").click();
    await expect(panel).toBeHidden();
    await expect(beacon).toBeFocused();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".living-release__panel")).toBeHidden();
    await page.locator(".living-release__beacon").click();
    await expect(page.locator(".living-release__panel")).toBeVisible();
    await page.mouse.click(1180, 650);
    await expect(page.locator(".living-release__panel")).toBeHidden();
    await page.locator(".living-release__beacon").click();
    await page.locator(".living-release__dismiss").click();
    await expect(page.locator(".living-release")).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".living-release")).toHaveCount(0);
  });

  test("supports Arabic RTL content and a version-specific release link", async ({ page }) => {
    await page.goto("/ar/index.html", { waitUntil: "domcontentloaded" });
    const shell = page.locator(".living-release");
    await expect(shell).toHaveAttribute("dir", "rtl");
    await expect(shell).toContainText("جديد في NexCore");
    await expect(shell.locator(".living-release__highlights li")).toHaveCount(3);
    await expect(shell.locator(".living-release__cta")).toHaveAttribute("href", "/ar/releases#v3-3-0");
    const panelBox = await shell.locator(".living-release__panel").boundingBox();
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(1280);
  });

  test("is limited to public routes and omitted from the release timeline", async ({ page }) => {
    await page.goto("/auth.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".living-release")).toHaveCount(0);
    await page.goto("/releases.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".living-release")).toHaveCount(0);
  });

  test("shows a newly promoted version after an older announcement was dismissed", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("nx_release_v3-3-0_dismissed", "1"));
    await page.route("**/assets/data/releases.json", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ releases: [{
        version: "v3.3.1",
        title: { en: "A New Chapter", ar: "فصل جديد" },
        visitor_announcement: {
          enabled: true,
          benefit: { en: "A fresh visitor-facing improvement.", ar: "تحسين جديد موجه للزوار." },
          highlights: {
            en: ["First improvement", "Second improvement", "Third improvement"],
            ar: ["التحسين الأول", "التحسين الثاني", "التحسين الثالث"]
          }
        }
      }] })
    }));
    await page.goto("/hub.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".living-release__panel")).toBeVisible();
    await expect(page.locator(".living-release__panel")).toContainText("v3.3.1 — A New Chapter");
  });

  test("restores focus with Escape and fits a 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".living-release__panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".living-release__beacon")).toBeFocused();
    await page.locator(".living-release__beacon").click();
    await expect(page.locator(".living-release__panel")).toBeVisible();
    await expect(page.locator(".living-release__beacon")).toHaveCSS("animation-name", "none");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
