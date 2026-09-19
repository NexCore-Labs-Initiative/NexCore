const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHandler } = require("../api/integrations/study-hub-ingest");
const { sign, configuration } = require("../lib/study-hub-ingest");
const { env, payload } = require("./helpers/study-hub-ingestion-fixture.cjs");
function response() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
  };
}
function database() {
  const rows = new Map();
  const calls = [];
  return {
    calls,
    rows,
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        single() {
          return q;
        },
        then(resolve) {
          resolve({ data: table === "study_hub_settings" ? {} : [] });
        },
      };
      return q;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      const key = args.p_data.external_response_id,
        old = rows.get(key);
      if (!old) rows.set(key, args.p_data);
      return {
        data: {
          result: !old
            ? "imported"
            : old.source_hash === args.p_data.source_hash
              ? "already_synced"
              : "source_conflict",
        },
      };
    },
  };
}
async function invoke(options = {}) {
  const db = options.db || database(),
    res = response();
  await createHandler({ env: options.env || env, getAdminClient: () => db })(
    {
      method: options.method || "POST",
      headers: { "content-type": "application/json", ...options.headers },
      body:
        options.body === undefined
          ? sign(payload(), env.STUDY_HUB_INGEST_SECRET)
          : options.body,
    },
    res,
  );
  return { res, db };
}
test("POST only; ordinary user/admin bearer tokens cannot authenticate machine ingestion", async () => {
  for (const method of ["GET", "PUT", "DELETE", "OPTIONS"])
    assert.equal((await invoke({ method })).res.statusCode, 405);
  for (const token of ["", "Bearer member", "Bearer editor", "Bearer admin"]) {
    const { res, db } = await invoke({
      headers: { authorization: token },
      body: {},
    });
    assert.equal(res.statusCode, 401);
    assert.equal(db.calls.length, 0);
  }
});
test("HMAC rejects tampering, wrong keys, expired/future requests and malformed signatures", async () => {
  const good = sign(payload(), env.STUDY_HUB_INGEST_SECRET);
  for (const body of [
    { ...good, payload: good.payload + " " },
    { ...good, signature: "0".repeat(64) },
    { ...good, signature: "xx" },
    sign(payload(), "b".repeat(64)),
    sign(
      payload(),
      env.STUDY_HUB_INGEST_SECRET,
      String(Math.floor(Date.now() / 1000) - 301),
    ),
    sign(
      payload(),
      env.STUDY_HUB_INGEST_SECRET,
      String(Math.floor(Date.now() / 1000) + 600),
    ),
  ]) {
    const { res, db } = await invoke({ body });
    assert.equal(res.statusCode, 401);
    assert.equal(db.calls.length, 0);
  }
});
test("missing config, disabled ingestion and no-write signed preflight are controlled", async () => {
  assert.throws(
    () => configuration({}),
    (e) => e.code === "ingest_configuration_missing",
  );
  assert.equal(
    (await invoke({ env: {} })).res.body.error,
    "ingest_configuration_missing",
  );
  const disabled = { ...env, STUDY_HUB_INGEST_ENABLED: "false" };
  assert.equal(
    (await invoke({ env: disabled })).res.body.error,
    "ingest_disabled",
  );
  const p = payload();
  p.kind = "check";
  delete p.values;
  const { res, db } = await invoke({
    env: disabled,
    body: sign(p, env.STUDY_HUB_INGEST_SECRET),
  });
  assert.deepEqual(res.body, { result: "ready", enabled: false });
  assert.equal(db.calls.length, 0);
});
test("malformed JSON, payload limits, content types, fields, headers and source allowlist", async () => {
  assert.equal((await invoke({ body: "{" })).res.statusCode, 400);
  assert.equal((await invoke({ body: "x".repeat(64001) })).res.statusCode, 413);
  assert.equal(
    (await invoke({ headers: { "content-type": "text/plain" } })).res
      .statusCode,
    415,
  );
  const mutations = [
    (p) => {
      p.sheet_id = 9;
    },
    (p) => {
      p.spreadsheet_id = "wrong_sheet";
    },
    (p) => {
      p.status = "published";
    },
    (p) => {
      p.values[0] = "bad";
    },
    (p) => {
      p.values[2] = "x".repeat(201);
    },
    (p) => {
      p.values[1] = "1/2/2026";
    },
    (p) => {
      p.headers[1] = "Changed question";
    },
    (p) => {
      p.headers[1] = p.headers[0];
    },
    (p) => {
      p.timezone = "bad";
    },
    (p) => {
      p.row_number = -1;
    },
    (p) => {
      p.headers.push("Email Address");
      p.values.push("private@example.invalid");
    },
  ];
  for (const mutate of mutations) {
    const p = payload();
    mutate(p);
    const { res, db } = await invoke({
      body: sign(p, env.STUDY_HUB_INGEST_SECRET),
    });
    assert.ok([403, 422].includes(res.statusCode), JSON.stringify(res.body));
    assert.equal(db.calls.length, 0);
  }
});
test("repeated and concurrent deliveries import once; changed content conflicts without overwrite", async () => {
  const db = database();
  const responses = await Promise.all([invoke({ db }), invoke({ db })]);
  assert.deepEqual(responses.map((r) => r.res.body.result).sort(), [
    "already_synced",
    "imported",
  ]);
  assert.equal(db.rows.size, 1);
  const moved = payload();
  moved.row_number = 22;
  assert.equal(
    (await invoke({ db, body: sign(moved, env.STUDY_HUB_INGEST_SECRET) })).res
      .body.result,
    "already_synced",
  );
  const changed = payload();
  changed.values[6] = "Changed";
  assert.equal(
    (await invoke({ db, body: sign(changed, env.STUDY_HUB_INGEST_SECRET) })).res
      .statusCode,
    409,
  );
  assert.ok(
    db.rows
      .values()
      .next()
      .value.source_content.title.startsWith("Intake browser"),
  );
  assert.ok(
    db.calls.every(
      (c) => c.name === "study_hub_ingest_submission" && !("p_actor" in c.args),
    ),
  );
});
test("incomplete metadata stays private; no resource writes or private response echo", async () => {
  const { res, db } = await invoke();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.needs_completion, true);
  assert.match(res.headers["Cache-Control"], /no-store/);
  assert.ok(!JSON.stringify(res.body).includes("Private"));
  const record = db.calls[0].args.p_data;
  assert.equal(record.source_content.credit, "");
  assert.ok(!JSON.stringify(record.source_content).includes("Private"));
});
test("database failures hide SQL and provider details", async () => {
  const db = database();
  db.rpc = async () => ({ error: { message: "PRIVATE STUDENT secret SQL" } });
  const { res } = await invoke({ db });
  assert.deepEqual(res.body, { error: "ingest_database_failure" });
  assert.equal(res.statusCode, 503);
});
