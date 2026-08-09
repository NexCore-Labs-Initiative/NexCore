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
  const archiveFile = path.join(__dirname, "..", "docs", "archive", "sql", "20260808125353_v3_3_trust_foundations.applied.sql");
  const markerFile = path.join(migrationsDir, "20260808125353_v3_3_trust_foundations.sql");
  const baselineFile = fs.readdirSync(migrationsDir).find((name) => name.endsWith("_production_schema_baseline.sql"));
  assert(fs.existsSync(archiveFile), "applied v3.3 SQL must remain archived as release evidence");
  assert(fs.existsSync(markerFile), "applied v3.3 migration marker must remain in the ledger");
  assert(baselineFile, "canonical production schema baseline must exist");
  assert(fs.statSync(path.join(migrationsDir, baselineFile)).size > 0, "canonical production schema baseline must not be empty");
  const baseline = fs.readFileSync(path.join(migrationsDir, baselineFile), "utf8");
  const publicTables = baseline.match(/CREATE TABLE IF NOT EXISTS "public"\./g) || [];
  const rlsTables = baseline.match(/ALTER TABLE "public"\.\S+ ENABLE ROW LEVEL SECURITY;/g) || [];
  assert(publicTables.length > 0, "baseline must define the public schema");
  assert.equal(rlsTables.length, publicTables.length, "every baseline public table must enable RLS");
  assert(baseline.includes('CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public"'));
  assert(!baseline.includes('COPY "public".'), "baseline must not contain production rows");
  assert(!baseline.includes("-- Data for Name:"), "baseline must be schema-only");
  const sql = fs.readFileSync(archiveFile, "utf8");
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
