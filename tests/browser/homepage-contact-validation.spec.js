"use strict";

const { test, expect } = require("@playwright/test");

for (const path of ["/index.html", "/ar/index.html"]) {
  test(`${path} uses button-based contact validation and reveals the newsletter card`, async ({ page }) => {
    const copy = path.startsWith("/ar/") ? {
      default: "إرسال الرسالة",
      required: "يرجى تعبئة الحقول المطلوبة",
      email: "أدخل بريدًا إلكترونيًا صالحًا",
      sending: "جارٍ الإرسال...",
      sent: "تم الإرسال",
      failed: "تعذر الإرسال"
    } : {
      default: "Send Message",
      required: "Fill required fields",
      email: "Enter a valid email",
      sending: "Sending...",
      sent: "Sent",
      failed: "Failed to send"
    };
    let shouldFail = false;

    await page.addInitScript(() => {
      localStorage.setItem("nexcore_cookie_preferences", JSON.stringify({ necessary: true, analytics: false, external_media: false, ai_services: false, timestamp: 1 }));
    });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route("https://api.web3forms.com/submit", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 160));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: !shouldFail })
      });
    });
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const form = page.locator("#contactForm");
    const submit = form.locator('button[type="submit"]');
    const reset = form.locator('button[type="reset"]');
    await expect(form).toHaveJSProperty("noValidate", true);
    await expect(submit).toHaveText(copy.default);
    await expect(page.locator("#formNotice")).toHaveClass(/sr-only/);

    await submit.click();
    for (const field of ["#name", "#email", "#message"]) {
      await expect(page.locator(field)).toHaveClass(/is-invalid/);
      await expect(page.locator(field)).toHaveAttribute("aria-invalid", "true");
    }
    await expect(submit).toHaveText(copy.required);
    await expect(submit).toHaveAttribute("data-contact-state", "required");
    await expect(submit).toHaveCSS("color", "rgb(255, 226, 168)");
    await expect(page.locator(".nexcore-toast")).toHaveCount(0);

    await page.locator("#name").fill("NexCore");
    await page.locator("#email").fill("not-an-email");
    await page.locator("#message").fill("A test message.");
    await expect(page.locator("#email")).toHaveClass(/is-invalid/);
    await expect(submit).toHaveText(copy.email);
    await expect(submit).toHaveAttribute("data-contact-state", "email-invalid");

    await page.locator("#email").fill("hello@nexcore.test");
    await expect(page.locator("#email")).not.toHaveClass(/is-invalid/);
    await expect(submit).toHaveText(copy.default);

    await submit.click();
    await expect(submit).toHaveText(copy.sending);
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("data-contact-state", "sending");
    await expect(submit).toHaveText(copy.sent);
    await expect(submit).toHaveAttribute("data-contact-state", "success");
    await expect(submit).toHaveCSS("color", "rgb(6, 34, 23)");
    await expect(page.locator(".nexcore-toast--success")).toBeVisible();
    await expect(form.locator("#name")).toHaveValue("");
    await page.waitForTimeout(1900);
    await expect(submit).toHaveText(copy.default);

    shouldFail = true;
    await page.locator("#name").fill("NexCore");
    await page.locator("#email").fill("hello@nexcore.test");
    await page.locator("#message").fill("A test message.");
    await submit.click();
    await expect(submit).toHaveText(copy.sending);
    await expect(submit).toHaveText(copy.failed);
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveAttribute("data-contact-state", "error");
    await expect(submit).toHaveCSS("color", "rgb(255, 192, 198)");
    await page.waitForTimeout(2700);
    await expect(submit).toHaveText(copy.default);

    await page.locator("#name").fill("");
    await expect(submit).toHaveText(copy.required);
    await reset.click();
    await expect(submit).toHaveText(copy.default);
    await expect(page.locator("#name")).not.toHaveClass(/is-invalid/);

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

  test(`${path} keeps the contact status button within the mobile form`, async ({ page }) => {
    const requiredLabel = path.startsWith("/ar/") ? "يرجى تعبئة الحقول المطلوبة" : "Fill required fields";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("nexcore_cookie_preferences", JSON.stringify({ necessary: true, analytics: false, external_media: false, ai_services: false, timestamp: 1 }));
    });
    await page.route(/^https:\/\//, route => route.abort());
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const form = page.locator("#contactForm");
    await form.scrollIntoViewIfNeeded();
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('button[type="submit"]')).toHaveText(requiredLabel);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}
