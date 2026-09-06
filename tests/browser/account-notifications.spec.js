"use strict";

const { test, expect } = require("@playwright/test");

for (const [path, message] of [
  ["/auth.html", "You have been logged out successfully."],
  ["/ar/auth.html", "تم تسجيل الخروج بنجاح."]
]) {
  test(`${path} shows the queued logout notification once`, async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route("**/assets/js/supabase-client.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.supabaseClient = { auth: { getSession: () => new Promise(() => {}), onAuthStateChange: () => ({ data: {} }) } };"
    }));
    await page.addInitScript(() => {
      sessionStorage.setItem("nexcore_logout_toast", "success");
      localStorage.setItem("nexcore_cookie_preferences", JSON.stringify({ necessary: true, analytics: false, external_media: false, ai_services: false, timestamp: 1 }));
    });
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const toast = page.locator(".nexcore-toast--success");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(message);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("nexcore_logout_toast"))).toBeNull();
  });
}

for (const [path, message] of [
  ["/auth.html", "Access is currently limited to eligible SQU email addresses. External access is paused."],
  ["/ar/auth.html", "الوصول متاح حالياً لحسابات جامعة السلطان قابوس المؤهلة فقط. الوصول الخارجي متوقف مؤقتاً."]
]) {
  test(`${path} explains a rejected non-SQU Google sign-in`, async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route("**/assets/js/supabase-client.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.supabaseClient = { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: {} }) } };"
    }));
    await page.addInitScript(() => {
      sessionStorage.setItem("nexcore_google_auth_attempt", String(Date.now()));
      localStorage.setItem("nexcore_cookie_preferences", JSON.stringify({ necessary: true, analytics: false, external_media: false, ai_services: false, timestamp: 1 }));
    });
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const toast = page.locator(".nexcore-toast--error");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(message);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("nexcore_google_auth_attempt"))).toBeNull();
  });
}

for (const path of ["/account.html", "/ar/account.html"]) {
  test(`${path} account messages use shared notifications`, async ({ page }) => {
    await page.setViewportSize({ width: path.startsWith("/ar/") ? 390 : 1280, height: 844 });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route("**/assets/js/supabase-client.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.supabaseClient = { auth: { getSession: () => new Promise(() => {}) } };"
    }));
    await page.route("**/assets/js/auth-ui-db.js", route => route.fulfill({ body: "" }));
    await page.addInitScript(() => {
      localStorage.setItem("nexcore_cookie_preferences", JSON.stringify({ necessary: true, analytics: false, external_media: false, ai_services: false, timestamp: 1 }));
    });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      document.getElementById("userId").textContent = "test-user-id";
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } });
      await copyUserId();
    });
    const toast = page.locator(".nexcore-toast");
    await expect(toast).toBeVisible();
    expect(await toast.evaluate(el => {
      const box = el.getBoundingClientRect();
      return box.top >= document.querySelector(".nav-container").getBoundingClientRect().bottom && box.right <= innerWidth && box.left >= 0;
    })).toBe(true);
    await page.screenshot({ path: test.info().outputPath("account-toast.png") });
    await toast.locator(".nexcore-toast__close").click();
    await expect(toast).toHaveCount(0);
    await page.evaluate(async () => {
      navigator.clipboard.writeText = async () => { throw new Error("Clipboard unavailable"); };
      await copyUserId();
    });
    await expect(page.locator(".nexcore-toast--error")).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 10000 });
    await page.evaluate(() => setMsg("", "Account notification check"));
    await expect(page.locator(".nexcore-toast--info")).toBeVisible();
  });
}
