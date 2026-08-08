"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createHandler: createAccessHandler } = require("../api/admin/access");
const { createHandler: createMetricsHandler } = require("../api/public-metrics");

function response() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

function adminClient() {
  const rows = {
    admins: [{ id: "admin-1", email: "admin@squ.edu.om", added_at: "2026-01-01" }],
    approved_users: [{ id: "user-1", email: "guest@example.com", created_at: "2026-01-01" }]
  };
  return {
    from(table) {
      const state = { table, mode: "select", values: null, email: null };
      const query = {
        select() { return query; },
        order() {
          const data = rows[state.table] || [];
          return Promise.resolve({ data, count: data.length, error: null });
        },
        eq(column, value) {
          if (column === "email") state.email = value;
          return query;
        },
        maybeSingle() {
          return Promise.resolve({ data: (rows[state.table] || []).find((row) => row.email === state.email) || null, error: null });
        },
        insert(values) { state.mode = "insert"; state.values = values; return query; },
        update(values) { state.mode = "update"; state.values = values; return query; },
        delete() { state.mode = "delete"; return query; },
        single() { return Promise.resolve({ data: { id: "new", ...state.values }, error: null }); },
        then(resolve) {
          if (state.mode === "delete") return resolve({ data: [{ id: "deleted" }], error: null });
          return resolve({ data: rows[state.table] || [], error: null });
        }
      };
      return query;
    }
  };
}

function authClient() {
  return { auth: { getUser: async () => ({ data: { user: { id: "uid-1", email: "admin@squ.edu.om" } }, error: null }) } };
}

async function testAdminAccess() {
  const handler = createAccessHandler({ createAuthClient: authClient, getAdminClient: adminClient });
  const missing = response();
  await handler({ method: "GET", headers: {}, query: {} }, missing);
  assert.equal(missing.statusCode, 401);
  assert.deepEqual(missing.payload, { error: "missing_authorization" });

  const ok = response();
  await handler({ method: "GET", headers: { authorization: "Bearer valid" }, query: { resource: "approved_users" } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.payload.count, 1);
  assert.equal(ok.payload.items[0].email, "guest@example.com");
}

async function testPublicMetrics() {
  const client = {
    from(table) {
      return {
        select(columns, options) {
          if (table === "page_visits_daily") return Promise.resolve({ data: [{ visits: 2 }, { visits: 3 }], error: null });
          return {
            eq: async () => ({ count: table === "projects" ? 4 : 2, error: null })
          };
        }
      };
    }
  };
  const handler = createMetricsHandler({ getAdminClient: () => client });
  const res = response();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual({ projects: res.payload.projects, initiatives: res.payload.initiatives, visits: res.payload.visits }, { projects: 4, initiatives: 2, visits: 5 });
  assert.equal(res.payload.status, "available");
}

function testMigrationContract() {
  const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
  const file = fs.readdirSync(migrationsDir).find((name) => name.endsWith("_v3_3_trust_foundations.sql"));
  assert(file, "v3.3 migration must exist");
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  for (const table of ["page_visits_daily", "project_counter", "project_moderation"]) {
    assert(sql.includes(`alter table public.${table} enable row level security`), `${table} must enable RLS`);
  }
  assert(sql.includes("drop function if exists public.toggle_feature_vote(uuid, uuid)"));
  assert(sql.includes("create or replace function public.toggle_feature_vote(p_feature_id uuid)"));
  assert(sql.includes("caller_id uuid := (select auth.uid())"));
  assert(sql.includes("alter view public.user_public_profiles set (security_invoker = true)"));
  assert(!sql.includes("grant execute on function public.toggle_feature_vote(uuid) to anon"));
}

(async () => {
  await testAdminAccess();
  await testPublicMetrics();
  testMigrationContract();
  console.log("Trust foundations API and migration contracts passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
