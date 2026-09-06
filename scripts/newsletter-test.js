"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createNewsletterHandler, normalizeEmail } = require("../api/newsletter");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function responseMock() {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function request(body, method = "POST") {
  return { method, body, headers: {}, socket: {} };
}

function createSupabaseMock({ subscriber = null, selectError = null, updateError = null, insertError = null } = {}) {
  const calls = [];
  const client = {
    from(table) {
      calls.push({ type: "from", table });
      return {
        select(columns) {
          calls.push({ type: "select", columns });
          return this;
        },
        eq(column, value) {
          calls.push({ type: "eq", column, value });
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: subscriber, error: selectError });
        },
        update(payload) {
          calls.push({ type: "update", payload });
          return {
            eq(column, value) {
              calls.push({ type: "update-eq", column, value });
              return Promise.resolve({ error: updateError });
            }
          };
        },
        insert(payload) {
          calls.push({ type: "insert", payload });
          return Promise.resolve({ error: insertError });
        }
      };
    }
  };
  return { client, calls };
}

async function callHandler(mock, body, method = "POST") {
  const handler = createNewsletterHandler(() => mock.client);
  const response = responseMock();
  await handler(request(body, method), response);
  return response;
}

async function runApiTests() {
  assert.strictEqual(normalizeEmail("  Updates@NexCore.test "), "updates@nexcore.test");

  const invalid = await callHandler(createSupabaseMock(), { action: "prepare_unsubscribe", email: "not-an-email" });
  assert.strictEqual(invalid.statusCode, 400);
  assert.strictEqual(invalid.body.error, "A valid email address is required");

  const invalidAction = await callHandler(createSupabaseMock(), { action: "delete", email: "updates@nexcore.test" });
  assert.strictEqual(invalidAction.statusCode, 400);
  assert.strictEqual(invalidAction.body.error, "Invalid action");

  for (const subscriber of [{ id: "active", is_active: true }, { id: "inactive", is_active: false }, null]) {
    const mock = createSupabaseMock({ subscriber });
    const response = await callHandler(mock, { action: "prepare_unsubscribe", email: "updates@nexcore.test" });
    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.body, { ok: true, status: "ready" });
    assert(!mock.calls.some((call) => call.type === "update"), "Preparation must not change subscription state");
    assert(!JSON.stringify(response.body).includes("active"), "Preparation must not expose subscription membership");
  }

  const activeUnsubscribe = createSupabaseMock({ subscriber: { id: "active", is_active: true } });
  const activeResponse = await callHandler(activeUnsubscribe, { action: "unsubscribe", email: "updates@nexcore.test" });
  assert.deepStrictEqual(activeResponse.body, { ok: true, status: "unsubscribed" });
  assert.deepStrictEqual(activeUnsubscribe.calls.find((call) => call.type === "update").payload.is_active, false);

  for (const subscriber of [{ id: "inactive", is_active: false }, null]) {
    const mock = createSupabaseMock({ subscriber });
    const response = await callHandler(mock, { action: "unsubscribe", email: "updates@nexcore.test" });
    assert.deepStrictEqual(response.body, { ok: true, status: "unsubscribed" });
    assert(!mock.calls.some((call) => call.type === "update"), "Inactive and missing emails must be a neutral no-op");
  }

  const subscribe = createSupabaseMock();
  const subscribeResponse = await callHandler(subscribe, { action: "subscribe", email: "updates@nexcore.test" });
  assert.deepStrictEqual(subscribeResponse.body, { ok: true, status: "subscribed" });
  assert.deepStrictEqual(subscribe.calls.find((call) => call.type === "insert").payload, { email: "updates@nexcore.test", is_active: true });

  const honeypot = createSupabaseMock();
  const honeypotResponse = await callHandler(honeypot, {
    action: "prepare_unsubscribe",
    email: "updates@nexcore.test",
    company: "bot company"
  });
  assert.deepStrictEqual(honeypotResponse.body, { ok: true, status: "ready" });
  assert.strictEqual(honeypot.calls.length, 0, "Honeypot requests must not reach Supabase");

  const methodResponse = await callHandler(createSupabaseMock(), {}, "GET");
  assert.strictEqual(methodResponse.statusCode, 405);
  assert.strictEqual(methodResponse.headers.Allow, "POST");
}

function runStaticTests() {
  for (const file of ["index.html", "ar/index.html"]) {
    const html = read(file);
    assert(html.includes('id="newsletter-manage"'), `${file} must expose the manage subscription control`);
    assert(html.includes('class="btn primary newsletter-status-button"'), `${file} must use the status-aware newsletter submit button`);
    assert(!html.includes('id="newsletter-unsubscribe-confirmation"'), `${file} must not render a separate unsubscribe confirmation button`);
    assert(!html.includes('id="newsletter-confirm-unsubscribe"'), `${file} must reuse the primary action for unsubscribe confirmation`);
    assert(html.includes('id="newsletter-message" class="sr-only"'), `${file} must keep newsletter status announcements screen-reader-only`);
    assert(!html.includes('href="unsubscribe.html"'), `${file} must not link to the removed unsubscribe page`);
  }

  assert(!fs.existsSync(path.join(root, "unsubscribe.html")), "English unsubscribe page must be removed");
  assert(!fs.existsSync(path.join(root, "ar", "unsubscribe.html")), "Arabic unsubscribe page must be removed");
  assert(!fs.existsSync(path.join(root, "assets", "js", "unsubscribe.js")), "Standalone unsubscribe script must be removed");
  assert(!read("vercel.json").includes('"/unsubscribe"'), "Vercel must not rewrite the removed unsubscribe route");
  assert(!read("service-worker.js").includes("'/unsubscribe'"), "Service worker must not precache the removed unsubscribe route");
  assert(!read("service-worker.js").includes("'/assets/js/unsubscribe.js'"), "Service worker must not precache the removed unsubscribe script");
}

runApiTests()
  .then(() => {
    runStaticTests();
    console.log("Newsletter API and homepage flow checks passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
