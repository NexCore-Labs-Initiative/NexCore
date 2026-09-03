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

for (const route of ["/how-to-use.html", "/ar/how-to-use.html"]) {
  test(`${route} guide panels transition between paths`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(route, { waitUntil: "domcontentloaded" });

    const squPanel = page.locator("#guideSquPanel");
    const nonSquPanel = page.locator("#guideNonSquPanel");
    const squButton = page.locator("#tabSquBtn");
    const nonSquButton = page.locator("#tabNonSquBtn");

    await expect(squPanel).toHaveClass(/active/);
    await expect(nonSquPanel).toHaveAttribute("aria-hidden", "true");
    await nonSquButton.click();
    await expect(nonSquButton).toHaveAttribute("aria-pressed", "true");
    await expect(squButton).toBeDisabled();
    await expect(nonSquPanel).toHaveClass(/is-entering/);
    await page.waitForTimeout(260);
    await expect(nonSquPanel).toHaveClass(/active/);
    await expect(nonSquPanel).toHaveAttribute("aria-hidden", "false");
    await expect(squPanel).toHaveAttribute("aria-hidden", "true");
    await expect(squButton).toBeEnabled();

    await squButton.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(260);
    await expect(squPanel).toHaveClass(/active/);
    await expect(squButton).toHaveAttribute("aria-pressed", "true");
  });

  test(`${route} guide panels respect reduced motion on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.locator("#tabNonSquBtn").click();
    await expect(page.locator("#guideNonSquPanel")).toHaveClass(/active/);
    await expect(page.locator("#guideNonSquPanel")).not.toHaveClass(/is-entering|is-visible/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}

for (const route of ["/faq.html", "/ar/faq.html"]) {
  test(`${route} FAQ categories transition between sections`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.locator(".living-release__close").click();

    const generalSection = page.locator('.faq-category-section[data-section="general"]');
    const serviceSection = page.locator('.faq-category-section[data-section="services"]');
    const generalButton = page.locator('.faq-cat-btn[data-category="general"]');
    const serviceButton = page.locator('.faq-cat-btn[data-category="services"]');

    await expect(page.locator('.faq-cat-btn')).toHaveCount(6);
    await expect(page.locator('.faq-cat-btn i.ti')).toHaveCount(6);
    await expect(page.locator('.faq-divider')).toBeVisible();
    await expect(page.locator('.docs-feedback-footer')).toBeVisible();
    await expect(page.locator('[data-docs-feedback][data-feedback-page-key="faq"]')).toBeVisible();
    for (const [category, iconClass] of [
      ["general", "ti-help-circle"],
      ["services", "ti-box"],
      ["technical", "ti-terminal-2"],
      ["support", "ti-headset"],
      ["pricing", "ti-currency-dollar"],
      ["security", "ti-shield-check"],
    ]) {
      await expect(page.locator(`.faq-category-section[data-section="${category}"] .faq-category-title i`)).toHaveClass(new RegExp(iconClass));
    }
    await expect(generalSection).toHaveClass(/active/);
    await expect(generalButton).toHaveAttribute("aria-pressed", "true");
    await expect(generalButton).toHaveCSS("color", "rgb(110, 231, 243)");
    await expect(serviceSection).toHaveAttribute("aria-hidden", "true");
    await serviceButton.click();
    await expect(serviceButton).toHaveAttribute("aria-pressed", "true");
    await expect(serviceSection).toHaveClass(/is-entering/);
    await page.waitForTimeout(260);
    await expect(serviceSection).toHaveClass(/active/);
    await expect(serviceButton).toHaveCSS("color", "rgb(110, 231, 243)");
    await expect(serviceSection.locator('.faq-item').first()).toBeVisible();
    await expect(serviceSection).toHaveAttribute("aria-hidden", "false");
    await expect(generalSection).toHaveAttribute("aria-hidden", "true");

    await generalButton.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(260);
    await expect(generalSection).toHaveClass(/active/);
    await expect(generalSection.locator('.faq-item').first()).toBeVisible();
    await expect(generalButton).toHaveAttribute("aria-pressed", "true");
  });

  test(`${route} FAQ categories respect reduced motion on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.locator(".living-release__close").click();
    await page.locator('.faq-cat-btn[data-category="services"]').click();
    const serviceSection = page.locator('.faq-category-section[data-section="services"]');
    await expect(serviceSection).toHaveClass(/active/);
    await expect(serviceSection.locator('.faq-item').first()).toBeVisible();
    await expect(serviceSection).not.toHaveClass(/is-entering|is-visible/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test(`${route} docs feedback uses shared toast notifications`, async ({ page }) => {
    let feedbackRequests = 0;
    await page.route("**/api/docs-feedback", async (routeRequest) => {
      feedbackRequests += 1;
      await routeRequest.fulfill({
        status: feedbackRequests === 1 ? 200 : 500,
        contentType: "application/json",
        body: JSON.stringify(feedbackRequests === 1 ? { ok: true, status: "saved" } : { error: "server_error" })
      });
    });

    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.locator(".living-release__close").click();

    const feedbackPanel = page.locator('[data-docs-feedback][data-feedback-page-key="faq"]');
    await expect(feedbackPanel.locator("[data-feedback-status]")).toHaveCount(0);
    await feedbackPanel.locator('[data-feedback-vote="yes"]').click();
    await expect(page.locator(".nexcore-toast--success")).toBeVisible();

    await feedbackPanel.locator('[data-feedback-vote="no"]').click();
    await expect(page.locator(".nexcore-toast--error")).toBeVisible();
  });
}

for (const route of ["/privacy-policy.html", "/ar/privacy-policy.html"]) {
  test(`${route} renders as a responsive policy document`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".privacy-policy-container .terms-header")).toBeVisible();
    await expect(page.locator(".policy-meta-pill")).toHaveCount(2);
    await expect(page.locator(".privacy-policy-container .table-of-contents a")).toHaveCount(6);
    await expect(page.locator("#privacy-rights")).toBeVisible();
    await expect(page.locator(".privacy-consent-panel #withdraw-consent")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}

for (const route of ["/terms.html", "/ar/terms.html", "/pricing-policy.html", "/ar/pricing-policy.html"]) {
  test(`${route} renders responsive policy metadata`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".policy-meta-pills")).toBeVisible();
    await expect(page.locator(".policy-meta-pill")).toHaveCount(route.includes("pricing-policy") ? 3 : 2);
    if (route.includes("pricing-policy")) {
      const releaseClose = page.locator(".living-release__close");
      if (await releaseClose.isVisible()) await releaseClose.click({ force: true });
      await page.locator("#coreMenu").click({ force: true });
      await expect(page.locator('#myDropdown a[href="terms.html"]')).toBeVisible();
      await expect(page.locator('#myDropdown a[href="terms.html"]')).toHaveClass(/fade/);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}

for (const route of ["/releases.html", "/ar/releases.html"]) {
  test(`${route} renders the complete release timeline`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".rl-card")).toHaveCount(22);
    await expect(page.locator(".rl-card").first()).toContainText("v3.3.1");
    await expect(page.locator(".rl-card").first()).toHaveAttribute("id", "v3-3-1");
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
    await expect(panel).toContainText("v3.3.1 — Credits & Initiative Logos");
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
    await expect(shell.locator(".living-release__cta")).toHaveAttribute("href", "/ar/releases#v3-3-1");
    await expect(shell.locator(".living-release__cta")).toHaveClass(/btn/);
    await expect(shell.locator(".living-release__cta")).toHaveClass(/primary/);
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
