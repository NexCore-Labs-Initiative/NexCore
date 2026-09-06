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
        if (body.email === "failure@nexcore.test" && body.action === "subscribe") {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Temporary failure" }) });
          return;
        }
        const status = body.action === "prepare_unsubscribe" ? "ready" : body.action === "unsubscribe" ? "unsubscribed" : "subscribed";
        await new Promise(resolve => setTimeout(resolve, 150));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status }) });
      });
      await page.goto(path, { waitUntil: "domcontentloaded" });

      const newsletter = page.locator(".newsletter-card");
      await newsletter.scrollIntoViewIfNeeded();
      const form = page.locator("#newsletter-form");
      const email = page.locator("#newsletter-email");
      const submit = page.locator("#newsletter-submit");
      const isArabic = path.startsWith("/ar/");
      const labels = isArabic ? {
        subscribe: "اشترك",
        invalid: "أدخل بريدًا إلكترونيًا صالحًا",
        subscribing: "جارٍ الاشتراك...",
        subscribed: "تم الاشتراك",
        check: "تحقق من البريد",
        checking: "جارٍ التحقق...",
        ready: "جاهز لتأكيد الإلغاء",
        unsubscribing: "جارٍ إلغاء الاشتراك...",
        updated: "تم تحديث التفضيلات",
        failed: "تعذر إتمام الاشتراك"
      } : {
        subscribe: "Subscribe",
        invalid: "Enter a valid email",
        subscribing: "Subscribing...",
        subscribed: "Subscribed",
        check: "Check email",
        checking: "Checking...",
        ready: "Ready to unsubscribe",
        unsubscribing: "Unsubscribing...",
        updated: "Preferences updated",
        failed: "Failed to subscribe"
      };

      await submit.click();
      await expect(email).toHaveClass(/is-invalid/);
      await expect(submit).toHaveText(labels.invalid);
      await expect(submit).toHaveAttribute("data-newsletter-state", "invalid");

      await email.fill("updates@nexcore.test");
      await expect(submit).toHaveText(labels.subscribe);
      await submit.click();
      await expect(submit).toHaveText(labels.subscribing);
      await expect(submit).toBeDisabled();
      await expect(submit).toHaveText(labels.subscribed);
      await expect(submit).toHaveAttribute("data-newsletter-state", "success");
      await expect(page.locator(".nexcore-toast--success").last()).toBeVisible();
      await expect(email).toHaveValue("");

      await email.fill("updates@nexcore.test");
      await page.locator("#newsletter-manage").click();
      await expect(form).toHaveAttribute("data-newsletter-mode", "manage");
      await expect(page.locator("#newsletter-manage")).toHaveAttribute("aria-expanded", "true");
      await expect(submit).toHaveText(labels.check);
      await submit.click();
      await expect(submit).toHaveText(labels.checking);
      await expect(page.locator("#newsletter-unsubscribe-confirmation")).toBeVisible();
      await expect(submit).toHaveText(labels.ready);
      await expect(submit).toBeDisabled();
      await expect(page.locator("#newsletter-message")).not.toHaveText(/subscribed|مشترك/i);

      const confirmButton = page.locator("#newsletter-confirm-unsubscribe");
      await confirmButton.click();
      await expect(confirmButton).toHaveText(labels.unsubscribing);
      await expect(confirmButton).toHaveText(labels.updated);
      await expect(page.locator(".nexcore-toast--success").last()).toBeVisible();
      await expect(page.locator("#newsletter-unsubscribe-confirmation")).toBeHidden();
      await expect(form).toHaveAttribute("data-newsletter-mode", "subscribe");
      await expect(email).toHaveValue("");

      await email.fill("failure@nexcore.test");
      await submit.click();
      await expect(submit).toHaveText(labels.failed);
      await expect(submit).toHaveAttribute("data-newsletter-state", "error");
      await expect(email).toHaveValue("failure@nexcore.test");
      expect(actions).toEqual(["subscribe", "prepare_unsubscribe", "unsubscribe", "subscribe"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
  }
}
