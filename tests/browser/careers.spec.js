"use strict";
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

for (const locale of ["en", "ar"]) {
  test(`Careers ${locale}: role selection, validation, submission, mobile and accessibility`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let responseCode = 503, calls = 0;
    await page.route("**/api/career-applications", async route => {
      calls++;
      const payload = route.request().postDataJSON();
      expect(payload.role).toBe("social-media"); expect(payload.consent).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 150));
      await route.fulfill({ status: responseCode, contentType: "application/json", body: JSON.stringify(responseCode === 201 ? { ok: true } : { error: "applications_unavailable" }) });
    });
    await page.goto(locale === "ar" ? "/ar/careers.html" : "/careers.html");
    await page.locator("#ncc-reject-opt").click();
    const form = page.locator("#career-form");
    const submit = form.locator('[type="submit"]');
    await expect(page.locator("h1")).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `test-results/careers-${locale}-desktop.png`, fullPage: true });
    await expect(page.locator(".careers-grid article")).toHaveCount(2);
    await page.locator('#social-media summary').click();
    await expect(page.locator('#social-media details')).toHaveAttribute('open', '');
    await page.locator('[data-apply-role="social-media"]').click();
    await expect(form.locator('[name="role"]')).toHaveValue("social-media");
    await submit.click();
    await expect(form.locator('[name="full_name"]')).toBeFocused();
    expect(calls).toBe(0);
    const values = { full_name: "Test Student", email: "wrong@example.com", college_major: "Science", academic_year: "2",
      motivation: "I want to help students.", experience: "Content planning", weekly_availability: "3 hours", role_answer: "Introduce a useful student tool." };
    for (const [name,value] of Object.entries(values)) await form.locator(`[name="${name}"]`).fill(value);
    await form.locator('[name="consent"]').check();
    await submit.click();
    await expect(form.locator('[name="email"]')).toHaveAttribute("aria-invalid", "true");
    expect(calls).toBe(0);
    await form.locator('[name="email"]').fill("test@student.squ.edu.om");
    await submit.click(); await expect(submit).toBeDisabled();
    await expect(page.locator("#career-status")).toContainText(locale === "ar" ? "تعذر" : "could not");
    await expect(form.locator('[name="full_name"]')).toHaveValue("Test Student");
    responseCode = 429; await submit.click();
    await expect(page.locator("#career-status")).toContainText("10");
    responseCode = 201; await submit.click();
    await expect(page.locator("#career-status")).toContainText(locale === "ar" ? "وصل طلبك" : "Application received");
    await expect(form.locator('[name="full_name"]')).toHaveValue("");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(form).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (locale === "ar") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const axe = await new AxeBuilder({ page }).include("#main-content").analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: `test-results/careers-${locale}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#coreMenu").focus();
    await page.keyboard.press("Enter");
    await page.locator(".lang-switch-pill").click();
    await expect(page).toHaveURL(locale === "ar" ? /\/careers.html$/ : /\/ar\/careers.html$/);
    expect(errors).toEqual([]);
  });
}

test("Homepage shared menu exposes Careers", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#ncc-reject-opt").click();
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await page.locator("#coreMenu").click();
  await expect(page.locator("[data-careers-nav]")).toHaveAttribute("href", "/careers");
});
