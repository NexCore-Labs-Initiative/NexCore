const { test, expect } = require("@playwright/test");

test("signed private intake, correction, conversion and Arabic queue", async ({
  browser,
  request,
}) => {
  const admin = await browser.newPage();
  await session(admin, "admin");
  await admin.goto("http://127.0.0.1:4189/study-hub-admin.html");
  await expect(admin.locator("#submissionsPanel")).toBeVisible();
  const {
    env,
    payload: makePayload,
  } = require("../helpers/study-hub-ingestion-fixture.cjs");
  const { sign } = require("../../lib/study-hub-ingest");
  const input = makePayload(require("node:crypto").randomUUID());
  const delivered = await Promise.all(
    [1, 2].map(() =>
      request.post("http://127.0.0.1:4189/api/integrations/study-hub-ingest", {
        data: sign(input, env.STUDY_HUB_INGEST_SECRET),
      }),
    ),
  );
  expect(delivered.every((r) => r.status() === 200)).toBeTruthy();
  const acknowledgments = await Promise.all(delivered.map((r) => r.json()));
  expect(acknowledgments.map((r) => r.result).sort()).toEqual([
    "already_synced",
    "imported",
  ]);
  await admin.locator("#refreshSubmissions").click();
  await expect(admin.locator("#submissionsPanel")).toContainText("Apps Script");
  await admin
    .locator(".intake-queue button")
    .filter({ hasText: "Intake browser" })
    .first()
    .click();
  await expect(admin.locator("#submissionReview")).toContainText(
    "Private Student",
  );
  await expect(admin.locator("#title")).toBeEnabled();
  await expect(admin.locator("#credit")).toHaveValue("");
  await admin
    .locator("#actions")
    .getByRole("button", { name: "Approve into draft", exact: true })
    .click();
  await expect(admin.locator("#message")).toContainText(
    "Complete the required metadata",
  );
  await admin.locator("#college_id").selectOption("science");
  await admin.locator("#format").selectOption("pdf");
  await admin.locator("#lang_en").check();
  await admin.locator("#lang_ar").check();
  await admin.locator("#submissionNotes").fill("PRIVATE REVIEW");
  await admin
    .locator("#actions")
    .getByRole("button", { name: "Save review", exact: true })
    .click();
  await expect(admin.locator("#message")).toHaveText("Review saved.");
  // Concurrent real API conversions must return one draft, even with the same stale retry version.
  const headers = { Authorization: "Bearer admin" };
  const list = await (
    await request.get(
      "http://127.0.0.1:4189/api/admin/study-hub?kind=submissions",
      { headers },
    )
  ).json();
  const item = list.items.find((s) =>
    s.review_content.title.startsWith("Intake browser"),
  );
  const payload = {
    action: "submission_convert",
    id: item.id,
    version: item.version,
    payload: { content: item.review_content },
  };
  const outcomes = await Promise.all(
    [1, 2].map(() =>
      request.post("http://127.0.0.1:4189/api/admin/study-hub", {
        headers,
        data: payload,
      }),
    ),
  );
  const results = await Promise.all(outcomes.map((r) => r.json()));
  expect(outcomes.every((r) => r.status() === 200)).toBeTruthy();
  expect(results[0].resource_id).toBe(results[1].resource_id);
  const details = await (
    await request.get(
      "http://127.0.0.1:4189/api/admin/study-hub?kind=detail&id=" +
        results[0].resource_id,
      { headers },
    )
  ).json();
  expect(details.resource.status).toBe("draft");
  expect(details.resource.content).toBeNull();
  const resend = await request.post(
    "http://127.0.0.1:4189/api/integrations/study-hub-ingest",
    {
      data: sign(input, env.STUDY_HUB_INGEST_SECRET),
    },
  );
  expect((await resend.json()).result).toBe("already_synced");
  const changedInput = { ...input, values: [...input.values] };
  changedInput.values[6] = "Source edited after conversion";
  const conflict = await request.post(
    "http://127.0.0.1:4189/api/integrations/study-hub-ingest",
    {
      data: sign(changedInput, env.STUDY_HUB_INGEST_SECRET),
    },
  );
  expect(conflict.status()).toBe(409);
  const preserved = await (
    await request.get(
      "http://127.0.0.1:4189/api/admin/study-hub?kind=submission&id=" + item.id,
      { headers },
    )
  ).json();
  expect(preserved.status).toBe("converted");
  expect(preserved.resource_id).toBe(results[0].resource_id);
  expect(preserved.source_content.title).toBe(input.values[6]);
  expect(JSON.stringify(details.revisions[0].content)).not.toContain("PRIVATE");
  expect(JSON.stringify(details.revisions[0].content)).not.toContain(
    "Private Student",
  );
  // A repeated UI approval opens the already-created draft rather than duplicating it.
  await admin
    .locator("#actions")
    .getByRole("button", { name: "Approve into draft", exact: true })
    .click();
  await expect(admin.locator("#message")).toContainText(
    "Approved into a private draft",
  );
  await expect(admin.locator("#submissionReview")).toBeHidden();
  await expect(admin.locator("#actions")).toContainText("Submit for review");
  const editor = await browser.newPage();
  await session(editor, "editor");
  await editor.goto("http://127.0.0.1:4189/study-hub-admin.html");
  await expect(editor.locator("#app")).toBeVisible();
  await expect(editor.locator("#submissionsPanel")).toBeHidden();
  const forbidden = await request.get(
    "http://127.0.0.1:4189/api/admin/study-hub?kind=submissions",
    { headers: { Authorization: "Bearer editor" } },
  );
  expect(forbidden.status()).toBe(403);
  const publicRead = await request.get(
    "http://127.0.0.1:4189/rest/v1/study_hub_submissions",
  );
  expect(publicRead.status()).toBe(403);
  const arabic = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await session(arabic, "admin");
  await arabic.goto("http://127.0.0.1:4189/ar/study-hub-admin.html");
  await expect(arabic.locator("#submissionsPanel")).toBeVisible();
  await expect(arabic.locator("#refreshSubmissions")).toBeEnabled();
  await expect(arabic.locator("#submissionsPanel")).toContainText(
    "مساهمات نموذج Google",
  );
  expect(
    await arabic.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await arabic.screenshot({
    path: "test-results/study-hub-intake-ar.png",
    fullPage: true,
  });
  await Promise.all([admin.close(), editor.close(), arabic.close()]);
});
test.describe.configure({ mode: "serial" });
test.setTimeout(180000);
async function session(page, role) {
  await page.route("https://**", (route) => route.abort());
  await page.route("**/assets/js/supabase-client.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.addInitScript((role) => {
    window.supabaseClient = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: role } } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe() {} } },
        }),
      },
    };
  }, role);
  page.on("dialog", (dialog) => dialog.accept());
}
test("editor submission, admin approval, public bilingual card, revision and archive", async ({
  browser,
}) => {
  const editor = await browser.newPage();
  await session(editor, "editor");
  await editor.goto("http://127.0.0.1:4189/study-hub-admin.html");
  await expect(editor.locator("#app")).toBeVisible();
  await expect(editor.locator("#adminTools")).toBeHidden();
  await editor.locator("#newResource").click();
  const suffix = Date.now().toString().slice(-9),
    title = "Browser resource " + suffix;
  await editor.locator("#title").fill(title);
  await editor.locator("#course_id").selectOption("new");
  await editor.locator("#course_code").fill("TEST" + suffix);
  await editor.locator("#college_id").selectOption("science");
  await editor.locator("#course_title").fill("Browser test course");
  await editor.locator("#semester").selectOption("Fall27");
  await editor.locator("#type").selectOption("Study plan");
  await editor.locator("#format").selectOption("pdf");
  await editor.locator("#description").fill("A reviewed study guide.");
  await editor.locator("#topics").fill("Arrays, Loops");
  await editor.locator("#lang_ar").check();
  await editor.locator("#lang_en").check();
  await editor
    .locator("#drive_url")
    .fill("https://drive.google.com/drive/folders/browser_" + suffix);
  await editor.locator("#credit").fill("Student team");
  await editor.locator("#credit_permission").check();
  await editor
    .locator("#actions")
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await expect(editor.locator("#message")).toHaveText("Changes saved.");
  await editor
    .locator("#actions")
    .getByRole("button", { name: "Submit for review" })
    .click();
  await expect(editor.locator("#workflowStatus")).toContainText(
    "Awaiting review",
  );
  await expect(editor.locator("#title")).toBeDisabled();
  await expect(
    editor
      .locator("#actions")
      .getByRole("button", { name: "Approve and publish" }),
  ).toHaveCount(0);
  const admin = await browser.newPage();
  await session(admin, "admin");
  await admin.goto("http://127.0.0.1:4189/study-hub-admin.html");
  await expect(admin.locator("#app")).toBeVisible();
  await admin
    .locator("#queue")
    .getByRole("button", { name: new RegExp(title) })
    .click();
  await admin.locator("#reviewNote").fill("Please expand the description.");
  await admin
    .locator("#actions")
    .getByRole("button", { name: "Return to editor" })
    .click();
  await expect(admin.locator("#workflowStatus")).toHaveText("Draft");
  await editor.locator("#refresh").click();
  await expect(editor.locator("#title")).toBeEnabled();
  await editor.locator("#description").fill("Expanded reviewed study guide.");
  await editor
    .locator("#actions")
    .getByRole("button", { name: "Submit for review" })
    .click();
  await expect(editor.locator("#workflowStatus")).toContainText(
    "Awaiting review",
  );
  await admin.locator("#refresh").click();
  await expect(admin.locator("#reviewPanel")).toBeVisible();
  await admin.locator("#reviewConfirmed").check();
  await admin
    .locator("#actions")
    .getByRole("button", { name: "Approve and publish" })
    .click();
  await expect(admin.locator("#workflowStatus")).toHaveText("Published");
  const publicPage = await browser.newPage();
  await publicPage.goto("http://127.0.0.1:4190/");
  await publicPage.locator("#searchInput").fill(title);
  await expect(publicPage.locator(".resource-card")).toHaveCount(1);
  await publicPage.locator(".resource-card").press("Enter");
  await expect(publicPage.locator("#modalDetails")).toContainText(
    "Arabic / English",
  );
  await expect(publicPage.locator("#modalDetails")).toContainText(
    "Student team",
  );
  await expect(publicPage.locator("#modalOpenLink")).toHaveAttribute(
    "href",
    new RegExp("browser_" + suffix),
  );
  await editor.locator("#refresh").click();
  await editor
    .locator("#actions")
    .getByRole("button", { name: "Prepare revision" })
    .click();
  await expect(editor.locator("#title")).toBeEnabled();
  await editor.locator("#title").fill(title + " updated");
  await editor
    .locator("#actions")
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await expect(editor.locator("#message")).toHaveText("Changes saved.");
  await publicPage.reload();
  await expect(publicPage.locator(".resource-card h3")).toHaveText(title);
  await editor.locator("#credit_permission").check();
  await editor
    .locator("#actions")
    .getByRole("button", { name: "Submit for review" })
    .click();
  await expect(editor.locator("#workflowStatus")).toContainText(
    "Awaiting review",
  );
  await admin.locator("#refresh").click();
  await admin.locator("#reviewConfirmed").check();
  await admin
    .locator("#actions")
    .getByRole("button", { name: "Approve and publish" })
    .click();
  await expect(admin.locator("#workflowStatus")).toHaveText("Published");
  await publicPage.goto(
    "http://127.0.0.1:4190/ar/?q=" + encodeURIComponent(title),
  );
  await expect(publicPage.locator(".resource-card h3")).toHaveText(
    title + " updated",
  );
  await admin
    .locator("#actions")
    .getByRole("button", { name: "Archive resource" })
    .click();
  await expect(admin.locator("#workflowStatus")).toHaveText("Archived");
  await publicPage.reload();
  await expect(publicPage.locator(".resource-card")).toHaveCount(0);
  await editor.close();
  await admin.close();
  await publicPage.close();
});
test("Arabic mobile workspace and ordinary-user denial", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await session(page, "admin");
  await page.goto("http://127.0.0.1:4189/ar/study-hub-admin.html");
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("مساحة إدارة الموارد");
  await page.locator("#newResource").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/study-hub-ar-mobile.png",
    fullPage: true,
  });
  await page.close();
  const member = await browser.newPage();
  await session(member, "member");
  await member.goto("http://127.0.0.1:4189/study-hub-admin.html");
  await expect(member.locator("#message")).toContainText(
    "needs Study Hub Editor",
  );
  await expect(member.locator("#app")).toBeHidden();
  await member.close();
});
