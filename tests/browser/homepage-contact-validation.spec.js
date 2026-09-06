"use strict";

const { test, expect } = require("@playwright/test");

for (const path of ["/index.html", "/ar/index.html"]) {
  test(`${path} uses inline contact validation and reveals the newsletter card`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexcore_cookie_preferences", JSON.stringify({ necessary: true, analytics: false, external_media: false, ai_services: false, timestamp: 1 }));
    });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route("https://api.web3forms.com/submit", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true })
    }));
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const form = page.locator("#contactForm");
    await expect(form).toHaveJSProperty("noValidate", true);
    await form.locator('button[type="submit"]').click();

    for (const field of ["#name", "#email", "#message"]) {
      await expect(page.locator(field)).toHaveClass(/is-invalid/);
      await expect(page.locator(field)).toHaveAttribute("aria-invalid", "true");
    }
    await expect(page.locator("#formNotice")).toBeVisible();
    await expect(page.locator(".nexcore-toast")).toHaveCount(0);

    await page.locator("#name").fill("NexCore");
    await expect(page.locator("#name")).not.toHaveClass(/is-invalid/);
    await expect(page.locator("#email")).toHaveClass(/is-invalid/);

    await page.locator("#email").fill("hello@nexcore.test");
    await page.locator("#message").fill("A test message.");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator(".nexcore-toast--success")).toBeVisible();
    await expect(form.locator("#name")).toHaveValue("");
    await expect(page).toHaveURL(new RegExp(`${path.replace(".", "\\.")}$`));

    const newsletter = page.locator(".newsletter-card");
    await newsletter.scrollIntoViewIfNeeded();
    await expect(newsletter).toHaveClass(/visible/);
    await expect(newsletter).toHaveCSS("opacity", "1");

    const newsletterForm = page.locator("#newsletter-form");
    const newsletterEmail = page.locator("#newsletter-email");
    await expect(newsletterForm).toHaveJSProperty("noValidate", true);
    await newsletterForm.locator('button[type="submit"]').click();
    await expect(newsletterEmail).toHaveClass(/is-invalid/);
    await expect(newsletterEmail).toHaveAttribute("aria-invalid", "true");
    await newsletterEmail.fill("updates@nexcore.test");
    await expect(newsletterEmail).not.toHaveClass(/is-invalid/);
    await expect(newsletterEmail).toHaveAttribute("aria-invalid", "false");
  });
}
