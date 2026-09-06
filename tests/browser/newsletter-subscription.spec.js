"use strict";

const { test, expect } = require("@playwright/test");

const viewports = [
  ["desktop", { width: 1280, height: 900 }],
  ["mobile", { width: 390, height: 844 }]
];

for (const path of ["/index.html", "/ar/index.html"]) {
  for (const [viewportName, viewport] of viewports) {
    test(`${path} manages newsletter subscriptions without exposing membership on ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const actions = [];
      await page.addInitScript(() => {
        localStorage.setItem("nexcore_cookie_preferences", JSON.stringify({ necessary: true, analytics: false, external_media: false, ai_services: false, timestamp: 1 }));
      });
      await page.route(/^https:\/\//, route => route.abort());
      await page.route("**/api/newsletter", async (route) => {
        const body = route.request().postDataJSON();
        actions.push(body.action);
        const status = body.action === "prepare_unsubscribe" ? "ready" : body.action === "unsubscribe" ? "unsubscribed" : "subscribed";
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status }) });
      });
      await page.goto(path, { waitUntil: "domcontentloaded" });

      const newsletter = page.locator(".newsletter-card");
      await newsletter.scrollIntoViewIfNeeded();
      const form = page.locator("#newsletter-form");
      const email = page.locator("#newsletter-email");
      const submit = page.locator("#newsletter-submit");

      await submit.click();
      await expect(email).toHaveClass(/is-invalid/);

      await email.fill("updates@nexcore.test");
      await submit.click();
      await expect(page.locator("#newsletter-message")).not.toHaveClass(/is-error/);
      await expect(email).toHaveValue("");

      await email.fill("updates@nexcore.test");
      await page.locator("#newsletter-manage").click();
      await expect(form).toHaveAttribute("data-newsletter-mode", "manage");
      await expect(page.locator("#newsletter-manage")).toHaveAttribute("aria-expanded", "true");
      await submit.click();
      await expect(page.locator("#newsletter-unsubscribe-confirmation")).toBeVisible();
      await expect(page.locator("#newsletter-message")).not.toHaveText(/subscribed|مشترك/i);

      await page.locator("#newsletter-confirm-unsubscribe").click();
      await expect(page.locator(".nexcore-toast--success")).toBeVisible();
      await expect(page.locator("#newsletter-unsubscribe-confirmation")).toBeHidden();
      await expect(form).toHaveAttribute("data-newsletter-mode", "subscribe");
      await expect(email).toHaveValue("");
      expect(actions).toEqual(["subscribe", "prepare_unsubscribe", "unsubscribe"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
  }
}
