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

for (const [route, isArabic] of [["/hub.html", false], ["/ar/hub.html", true]]) {
  test(`${route} renders published project shortcuts in the menu`, async ({ page }) => {
    await page.setViewportSize({ width: isArabic ? 390 : 1280, height: 844 });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.supabaseClient = {
        from() {
          const query = {
            select() { return query; },
            eq() { return query; },
            order() { return query; },
            limit() {
              return Promise.resolve({
                data: [{ slug: "atlas", name: "Atlas Study Hub", public_id: "Proj-12", category: "education", image_url: "" }],
                error: null
              });
            }
          };
          return query;
        }
      };
      window.NexCoreProjectsMenu.init();
    });
    await page.locator("#coreMenu").click({ force: true });

    const drawer = page.locator("[data-projects-nav-group]");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".project-shortcut-link")).toHaveAttribute(
      "href",
      isArabic ? "/ar/project.html?slug=atlas" : "/project.html?slug=atlas"
    );
    await expect(drawer.locator(".project-shortcut-all")).toHaveAttribute(
      "href",
      isArabic ? "/ar/hub.html#projects" : "/hub.html#projects"
    );

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
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

for (const route of ["/dashboard.html", "/ar/dashboard.html"]) {
  test(`${route} exposes an optional project logo field`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.setDashboardTab === "function");
    await page.evaluate(() => {
      document.getElementById("noProject").style.display = "none";
      document.getElementById("hasProject").style.display = "block";
      window.setDashboardTab("profile");
    });

    const logoInput = page.locator("#profileLogoUrl");
    const logoPreview = page.locator("#logoPreview");
    await expect(logoInput).toBeVisible();
    await expect(logoPreview).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test(`${route} presents a responsive no-project setup flow`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.setDashboardTab === "function");
    await page.evaluate(() => {
      document.getElementById("hasProject").style.display = "none";
      document.getElementById("noProject").style.display = "block";
    });

    const emptyState = page.locator("#noProject");
    await expect(emptyState.locator(".empty-intro")).toBeVisible();
    await expect(emptyState.locator(".empty-form-heading")).toBeVisible();
    await expect(emptyState.locator("#newProjectName")).toBeVisible();
    await expect(emptyState.locator("#createProjectBtn")).toBeVisible();
    const selectFits = await emptyState.locator("#newProjectCategoryTrigger").evaluate((trigger) => {
      const triggerRect = trigger.getBoundingClientRect();
      const formRect = trigger.closest(".empty-form").getBoundingClientRect();
      return triggerRect.left >= formRect.left && triggerRect.right <= formRect.right;
    });
    expect(selectFits).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test(`${route} command-center panels transition without overflow`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.setDashboardTab === "function");
    await page.evaluate(() => {
      document.getElementById("noProject").style.display = "none";
      document.getElementById("hasProject").style.display = "block";
    });

    await page.evaluate(() => window.initDashboardTabs());
    const profileTab = page.locator('[data-dashboard-tab="profile"]');
    const overviewPanel = page.locator('[data-dashboard-panel="overview"]');
    const profilePanel = page.locator('[data-dashboard-panel="profile"]');
    await profileTab.click();
    await expect(profileTab).toHaveAttribute("aria-selected", "true");
    await expect(profilePanel).toHaveClass(/is-entering/);
    await expect(overviewPanel).toHaveClass(/is-leaving/);
    await page.waitForTimeout(280);
    await expect(profilePanel).toHaveClass(/active/);
    await expect(profilePanel).not.toHaveClass(/is-entering|is-visible/);
    await expect(overviewPanel).not.toHaveClass(/active|is-leaving/);

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test(`${route} command-center panels respect reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.setDashboardTab === "function");
    await page.evaluate(() => window.setDashboardTab("links"));
    const linksPanel = page.locator('[data-dashboard-panel="links"]');
    await expect(linksPanel).toHaveClass(/active/);
    await expect(linksPanel).not.toHaveClass(/is-entering|is-visible/);
  });
}

for (const [route, viewport] of [
  ["/index.html", { width: 1280, height: 800 }],
  ["/ar/index.html", { width: 390, height: 844 }]
]) {
  test(`${route} renders notifications below the navigation`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.NexCoreNotify));
    await page.evaluate(() => window.NexCoreNotify.show({ message: "Toast placement smoke test", type: "info", duration: 0 }));
    await page.locator(".nexcore-toast.is-visible").waitFor();

    const placement = await page.evaluate(() => {
      const navigation = document.querySelector(".nav-container").getBoundingClientRect();
      const toast = document.querySelector(".nexcore-toast").getBoundingClientRect();
      return {
        belowNavigation: toast.top >= navigation.bottom,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });

    expect(placement.belowNavigation).toBe(true);
    expect(placement.overflow).toBe(false);
  });
}

for (const route of ["/faq.html", "/ar/faq.html"]) {
  test(`${route} FAQ categories transition between sections`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(route, { waitUntil: "domcontentloaded" });

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

    const feedbackPanel = page.locator('[data-docs-feedback][data-feedback-page-key="faq"]');
    await expect(feedbackPanel.locator("[data-feedback-status]")).toHaveCount(0);
    await feedbackPanel.locator('[data-feedback-vote="yes"]').click();
    await expect(page.locator(".nexcore-toast--success")).toBeVisible();

    await feedbackPanel.locator('[data-feedback-vote="no"]').click();
    await expect(page.locator(".nexcore-toast--error")).toBeVisible();
  });
}

for (const route of ["/auth.html", "/ar/auth.html"]) {
  test(`${route} renders the responsive SQU access gateway`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".auth-gateway__card")).toBeVisible();
    await expect(page.locator("#googleSignInBtn")).toBeVisible();
    await expect(page.locator(".auth-gateway__eligibility")).toBeVisible();
    await expect(page.locator(".auth-gateway__paused")).toBeVisible();
    await expect(page.locator('.auth-gateway a[href*="pricing"]')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".auth-gateway__card")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
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

test.describe("version highlights beacon", () => {
  test("opens, closes, and records the read state", async ({ page }) => {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    const beacon = page.locator("#beaconBtn");
    const panel = page.locator("#panel");
    await expect(beacon).toHaveAttribute("aria-expanded", "false");
    await expect(panel).not.toHaveClass(/open/);

    await beacon.click();
    await expect(panel).toHaveClass(/open/);
    await expect(panel).toContainText("v1.4.0");
    await expect(panel).toContainText("Study Hub redesigned");
    await expect(beacon).toHaveAttribute("aria-expanded", "true");
    await page.mouse.click(1180, 650);
    await expect(panel).not.toHaveClass(/open/);

    await beacon.click();
    await page.locator("#markReadBtn").click();
    await expect(page.locator("#panelFooter")).toContainText("All caught up");
    await expect(beacon).toHaveClass(/read/);
    await expect(page.locator("#badge")).toHaveClass(/hidden/);
  });

  test("supports Arabic RTL content and the full changelog link", async ({ page }) => {
    await page.goto("/ar/index.html", { waitUntil: "domcontentloaded" });
    const shell = page.locator(".beacon-wrap");
    const panel = page.locator("#panel");
    await expect(shell).toHaveAttribute("dir", "rtl");
    await page.locator("#beaconBtn").click();
    await expect(panel).toContainText("ما الجديد في NexCore");
    await expect(panel.locator(".entry")).toHaveCount(4);
    await expect(panel.locator(".footer-link")).toHaveAttribute("href", "releases.html");
    const panelBox = await panel.boundingBox();
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(1280);
  });

  test("is limited to public routes and omitted from the release timeline", async ({ page }) => {
    await page.goto("/auth.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".beacon-wrap")).toHaveCount(0);
    await page.goto("/releases.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".beacon-wrap")).toHaveCount(0);
  });

  test("restores focus with Escape and fits a 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("#beaconBtn").click();
    await expect(page.locator("#panel")).toHaveClass(/open/);
    await page.keyboard.press("Escape");
    await expect(page.locator("#beaconBtn")).toBeFocused();
    await page.locator("#beaconBtn").click();
    await expect(page.locator("#panel")).toHaveClass(/open/);
    await expect(page.locator("#pulseRing")).toHaveCSS("animation-name", "none");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
