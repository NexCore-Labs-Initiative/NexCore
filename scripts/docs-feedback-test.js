"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createDocsFeedbackHandler, getCoarseRequestIdentity, normalizeFeedbackPayload } = require("../api/docs-feedback");
const { createHandler: createDocsFeedbackStatsHandler } = require("../api/admin/docs-feedback");

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

function request(overrides = {}) {
  return {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.44" },
    socket: { remoteAddress: "198.51.100.9" },
    body: {
      page_key: "how-to-use",
      page_path: "/how-to-use.html",
      locale: "en",
      vote: "yes"
    },
    ...overrides
  };
}

function createSupabaseMock(calls, error = null) {
  return {
    from(table) {
      calls.push({ table });
      return {
        async upsert(row, options) {
          calls.push({ row, options });
          return { data: null, error };
        }
      };
    }
  };
}

function createStatsAdminMock(rows, calls, error = null) {
  return {
    from(table) {
      calls.push({ table });
      const query = {
        filters: [],
        selectColumns: "",
        selectOptions: {},
        select(columns, options = {}) {
          this.selectColumns = columns;
          this.selectOptions = options;
          calls.push({ select: columns, options });
          return this;
        },
        eq(column, value) {
          this.filters.push({ type: "eq", column, value });
          return this;
        },
        gte(column, value) {
          this.filters.push({ type: "gte", column, value });
          return this;
        },
        order(column, options = {}) {
          calls.push({ order: column, options });
          return this;
        },
        limit(value) {
          calls.push({ limit: value });
          return this;
        },
        execute() {
          if (error) return Promise.resolve({ data: null, count: null, error });
          const filtered = rows.filter((row) => this.filters.every((filter) => {
            if (filter.type === "eq") return row[filter.column] === filter.value;
            if (filter.type === "gte") return String(row[filter.column] || "") >= filter.value;
            return true;
          }));
          if (this.selectOptions.head) {
            return Promise.resolve({ data: null, count: filtered.length, error: null });
          }
          const data = filtered.map((row) => ({
            response_date: row.response_date,
            vote: row.vote
          }));
          return Promise.resolve({ data, count: filtered.length, error: null });
        },
        then(resolve, reject) {
          return this.execute().then(resolve, reject);
        }
      };
      return query;
    }
  };
}

async function runApiTests() {
  const calls = [];
  const handler = createDocsFeedbackHandler({
    getAdminClient: () => createSupabaseMock(calls),
    rateLimiter: () => ({ allowed: true, remaining: 9 }),
    env: { DOCS_FEEDBACK_SALT: "test-salt" },
    now: () => new Date("2026-08-27T10:15:30.000Z"),
    logger: { error() {} }
  });

  const ok = responseMock();
  await handler(request(), ok);
  assert.strictEqual(ok.statusCode, 200);
  assert.deepStrictEqual(ok.body, { ok: true, status: "saved" });
  assert.strictEqual(calls[0].table, "docs_feedback_responses");
  assert.deepStrictEqual(calls[1].options, { onConflict: "page_key,locale,client_hash,response_date" });
  assert.strictEqual(calls[1].row.page_key, "how-to-use");
  assert.strictEqual(calls[1].row.page_path, "/how-to-use");
  assert.strictEqual(calls[1].row.locale, "en");
  assert.strictEqual(calls[1].row.vote, "yes");
  assert.strictEqual(calls[1].row.response_date, "2026-08-27");
  assert.match(calls[1].row.client_hash, /^[a-f0-9]{64}$/);
  assert(!Object.hasOwn(calls[1].row, "ip_address"), "Raw IP must not be stored");
  assert(!Object.hasOwn(calls[1].row, "user_agent"), "User agent must not be stored");
  assert(!Object.hasOwn(calls[1].row, "referrer"), "Referrer must not be stored");
  assert(!Object.hasOwn(calls[1].row, "user_id"), "Account identity must not be stored");

  assert.strictEqual(getCoarseRequestIdentity(request()), "203.0.113.0");
  assert.deepStrictEqual(normalizeFeedbackPayload({ page_path: "/ar/how-to-use", page_key: "how-to-use", locale: "ar", vote: "no" }), {
    pageKey: "how-to-use",
    pagePath: "/ar/how-to-use",
    locale: "ar",
    vote: "no"
  });
  assert.deepStrictEqual(normalizeFeedbackPayload({ page_path: "/how-to-use/", page_key: "how-to-use", locale: "en", vote: "yes" }), {
    pageKey: "how-to-use",
    pagePath: "/how-to-use",
    locale: "en",
    vote: "yes"
  });
  assert.deepStrictEqual(normalizeFeedbackPayload({ page_path: "/ar/how-to-use.html/", page_key: "how-to-use", locale: "ar", vote: "no" }), {
    pageKey: "how-to-use",
    pagePath: "/ar/how-to-use",
    locale: "ar",
    vote: "no"
  });

  const invalidVote = responseMock();
  await handler(request({ body: { page_key: "how-to-use", page_path: "/how-to-use.html", locale: "en", vote: "maybe" } }), invalidVote);
  assert.strictEqual(invalidVote.statusCode, 400);
  assert.strictEqual(invalidVote.body.error, "invalid_vote");

  const invalidPage = responseMock();
  await handler(request({ body: { page_key: "faq", page_path: "/faq.html", locale: "en", vote: "yes" } }), invalidPage);
  assert.strictEqual(invalidPage.statusCode, 400);
  assert.strictEqual(invalidPage.body.error, "invalid_page");

  const rateLimited = responseMock();
  await createDocsFeedbackHandler({
    getAdminClient: () => createSupabaseMock([]),
    rateLimiter: () => ({ allowed: false, retryAfter: 42 }),
    env: { DOCS_FEEDBACK_SALT: "test-salt" },
    logger: { error() {} }
  })(request(), rateLimited);
  assert.strictEqual(rateLimited.statusCode, 429);
  assert.strictEqual(rateLimited.headers["Retry-After"], "42");

  const wrongMethod = responseMock();
  await handler(request({ method: "GET" }), wrongMethod);
  assert.strictEqual(wrongMethod.statusCode, 405);

  const dbFailure = responseMock();
  await createDocsFeedbackHandler({
    getAdminClient: () => createSupabaseMock([], new Error("db down")),
    rateLimiter: () => ({ allowed: true }),
    env: { DOCS_FEEDBACK_SALT: "test-salt" },
    logger: { error() {} }
  })(request(), dbFailure);
  assert.strictEqual(dbFailure.statusCode, 503);
  assert.strictEqual(dbFailure.body.error, "feedback_unavailable");

  const statsCalls = [];
  const statsHandler = createDocsFeedbackStatsHandler({
    authenticateAdmin: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      adminClient: createStatsAdminMock([
        { page_key: "how-to-use", locale: "en", vote: "yes", response_date: "2026-08-27", client_hash: "secret-1" },
        { page_key: "how-to-use", locale: "en", vote: "no", response_date: "2026-08-27", client_hash: "secret-2" },
        { page_key: "how-to-use", locale: "ar", vote: "yes", response_date: "2026-08-26", client_hash: "secret-3" },
        { page_key: "how-to-use", locale: "ar", vote: "yes", response_date: "2026-08-15", client_hash: "secret-4" },
        { page_key: "faq", locale: "en", vote: "yes", response_date: "2026-08-27", client_hash: "secret-5" }
      ], statsCalls)
    }),
    rateLimiter: () => ({ allowed: true }),
    now: () => new Date("2026-08-27T12:00:00.000Z")
  });

  const statsRes = responseMock();
  await statsHandler({ method: "GET", headers: { authorization: "Bearer admin-token" } }, statsRes);
  assert.strictEqual(statsRes.statusCode, 200);
  assert.strictEqual(statsRes.body.ok, true);
  assert.strictEqual(statsRes.body.totals.total, 4);
  assert.strictEqual(statsRes.body.totals.yes, 3);
  assert.strictEqual(statsRes.body.totals.no, 1);
  assert.strictEqual(statsRes.body.totals.helpful_rate, 75);
  assert.strictEqual(statsRes.body.locales.en.total, 2);
  assert.strictEqual(statsRes.body.locales.ar.yes, 2);
  assert.strictEqual(statsRes.body.recent.total, 3);
  assert.strictEqual(statsRes.body.daily.items.length, 14);
  assert(!JSON.stringify(statsRes.body).includes("secret-"), "Admin stats must not expose client hashes");
  assert(statsCalls.some((call) => call.table === "docs_feedback_responses"), "Stats API must read the feedback table");
  assert(statsCalls.every((call) => !call.select || !call.select.includes("client_hash")), "Stats API must not select client_hash");

  const nonAdminRes = responseMock();
  await createDocsFeedbackStatsHandler({
    authenticateAdmin: async () => ({ error: { status: 403, code: "admin_required" } }),
    rateLimiter: () => ({ allowed: true })
  })({ method: "GET", headers: { authorization: "Bearer user-token" } }, nonAdminRes);
  assert.strictEqual(nonAdminRes.statusCode, 403);
  assert.strictEqual(nonAdminRes.body.error, "admin_required");

  const statsRateLimited = responseMock();
  await createDocsFeedbackStatsHandler({
    authenticateAdmin: async () => {
      throw new Error("auth should not run after rate limit");
    },
    rateLimiter: () => ({ allowed: false, retryAfter: 30 })
  })({ method: "GET", headers: { authorization: "Bearer token" } }, statsRateLimited);
  assert.strictEqual(statsRateLimited.statusCode, 429);
  assert.strictEqual(statsRateLimited.headers["Retry-After"], "30");

  const statsWrongMethod = responseMock();
  await statsHandler({ method: "POST", headers: { authorization: "Bearer admin-token" } }, statsWrongMethod);
  assert.strictEqual(statsWrongMethod.statusCode, 405);
}

function runStaticTests() {
  const migration = read("supabase/migrations/20260827000100_create_docs_feedback_responses.sql");
  for (const expected of [
    "create table if not exists public.docs_feedback_responses",
    "client_hash text not null",
    "create unique index if not exists docs_feedback_responses_daily_client_unique",
    "alter table public.docs_feedback_responses enable row level security",
    "revoke all on table public.docs_feedback_responses from anon",
    "revoke all on table public.docs_feedback_responses from authenticated",
    "grant all on table public.docs_feedback_responses to service_role"
  ]) {
    assert(migration.includes(expected), `Migration must include: ${expected}`);
  }

  for (const [file, locale, yes, no] of [
    ["how-to-use.html", "en", "Yes", "No"],
    ["ar/how-to-use.html", "ar", "نعم", "لا"]
  ]) {
    const html = read(file);
    assert(html.includes("data-docs-feedback"), `${file} must expose docs feedback root`);
    assert(html.includes(`data-feedback-locale="${locale}"`), `${file} must declare feedback locale`);
    assert(html.includes('data-feedback-vote="yes"'), `${file} must expose yes vote`);
    assert(html.includes('data-feedback-vote="no"'), `${file} must expose no vote`);
    assert(html.includes("data-feedback-status"), `${file} must include feedback status region`);
    assert(html.includes("@tabler/icons-webfont"), `${file} must load Tabler outline icons`);
    assert(html.includes("ti ti-thumb-up"), `${file} must use Tabler thumbs-up icon`);
    assert(html.includes("ti ti-thumb-down"), `${file} must use Tabler thumbs-down icon`);
    assert(html.includes(yes), `${file} must retain yes label`);
    assert(html.includes(no), `${file} must retain no label`);
  }

  const js = read("assets/js/unminified-js.js");
  assert(js.includes("function initDocsFeedback"), "Shared JS must initialize docs feedback");
  assert(js.includes('fetch("/api/docs-feedback"'), "Shared JS must post feedback to the API");
  assert(js.includes("data-feedback-vote"), "Shared JS must use stable vote attributes");
  assert(js.includes("active-yes"), "Shared JS must support the yes active state");
  assert(js.includes("active-no"), "Shared JS must support the no active state");
  assert(js.includes("feedbackMessageYes"), "Shared JS must support yes-specific feedback copy");
  assert(js.includes("feedbackMessageNo"), "Shared JS must support no-specific feedback copy");

  for (const [file, title] of [
    ["admin-users.html", "How-To-Use Feedback"],
    ["ar/admin-users.html", "آراء دليل الاستخدام"]
  ]) {
    const html = read(file);
    assert(html.includes(title), `${file} must include the docs feedback stats panel`);
    assert(html.includes("loadDocsFeedbackStats"), `${file} must load docs feedback stats`);
    assert(html.includes("/api/admin/docs-feedback"), `${file} must call the protected feedback stats API`);
    assert(html.includes("docsFeedbackDailyChart"), `${file} must render the feedback trend chart`);
  }
}

runApiTests()
  .then(() => {
    runStaticTests();
    console.log("Docs feedback tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
