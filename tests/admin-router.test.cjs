const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const router = require("../api/admin/[route]");

function response() {
  return {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("all existing admin URLs retain unauthenticated rejection", async () => {
  for (const name of ["access", "docs-feedback", "initiatives", "study-hub", "study-hub-sync"]) {
    const res = response();
    await router({ url: `/api/admin/${name}`, method: name.endsWith("sync") ? "POST" : "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401, name);
    assert.equal(res.headers["Cache-Control"], "private, no-store");
  }
});

test("dispatch preserves request data and ignores conflicting route parameters", () => {
  const calls = [];
  const dispatch = router.createHandler(new Map([
    ["study-hub", (req, res) => { calls.push(req); return res.status(202).json({ ok: true }); }],
    ["access", () => assert.fail("query/body must not redirect dispatch")],
  ]));
  const req = { url: "/api/admin/study-hub?route=access&kind=submissions", method: "POST", query: { route: "access", kind: "submissions" }, body: { route: "access", action: "submission_convert" }, headers: { authorization: "Bearer synthetic" } };
  const res = response();
  dispatch(req, res);
  assert.equal(calls[0], req);
  assert.equal(res.statusCode, 202);
});

test("unknown, nested and traversal paths never invoke a handler", () => {
  for (const url of ["/api/admin/unknown", "/api/admin/constructor", "/api/admin", "/api/admin/study-hub/extra", "/api/admin/../access", "/api/admin/%61ccess"]) {
    const res = response();
    router({ url, query: { route: "access" }, headers: {} }, res);
    assert.equal(res.statusCode, 404, url);
  }
});

test("method rules remain owned by each handler", async () => {
  const res = response();
  await router({ url: "/api/admin/study-hub-sync", method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("API entry points stay within the Hobby function budget", () => {
  const root = path.resolve(__dirname, "../api");
  const entries = fs.readdirSync(root, { recursive: true }).filter(f => /\.(?:[cm]?js|ts|py|go|rb)$/.test(f));
  assert.ok(entries.length <= 12, `Found ${entries.length} functions; maximum is 12`);
  assert.ok(entries.some(f => f.replaceAll(path.sep, "/") === "integrations/study-hub-ingest.js"));
});
