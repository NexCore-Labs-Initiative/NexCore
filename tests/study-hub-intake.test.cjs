const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  HEADERS,
  mapHeaders,
  mapRow,
  sheetTime,
} = require("../lib/study-hub-intake");

const management = require("../api/admin/study-hub").createHandler;
const sync = require("../api/admin/study-hub-sync").createHandler;
const headers = Object.values(HEADERS).map((x) => x[0]);
const columns = mapHeaders(headers).columns;
const row = (overrides = {}) => {
  const values = {
    id: "30000000-0000-0000-0000-000000000001",
    timestamp: 46000,
    name: "Private Name",
    code: "comp1001",
    course: "Computing",
    semester: "Spring26",
    title: "Array notes",
    type: "Book",
    topics: "Arrays، Loops,Arrays",
    url: "https://drive.google.com/file/d/abcde123/view",
    description: "Description",
    consent: "No",
    terms: "I have read and agree to the Contribution Terms.",
    note: "ملاحظات خاصة",
    format: "",
    languages: "",
    ...overrides,
  };
  return Object.keys(HEADERS).map((k) => values[k]);
};
test("headers are position independent, normalize spaces and reject missing/ambiguous columns", () => {
  const reversed = [...headers].reverse();
  assert.equal(mapHeaders(reversed).columns.id, reversed.length - 1);
  assert.equal(
    mapHeaders(headers.map((h) => " " + h.replaceAll(" ", "\u00a0") + " "))
      .columns.title,
    columns.title,
  );
  assert.throws(
    () => mapHeaders(headers.filter((h) => h !== "Timestamp")),
    (e) => e.code === "missing_columns",
  );
  assert.throws(
    () => mapHeaders([...headers, "Timestamp"]),
    (e) => e.code === "ambiguous_columns",
  );
  assert.equal(
    mapHeaders([...headers, "Your SQU id", "Email Address"]).ignoredColumns
      .length,
    2,
  );
});
test("mapping excludes identities without consent, keeps private notes separate, requires missing metadata", () => {
  const result = mapRow(
    [...row(), "s123456", "private@example.invalid"],
    columns,
    "Asia/Muscat",
  );
  assert.equal(result.source_content.type, "Books");
  assert.equal(result.source_content.credit, "");
  assert.deepEqual(result.source_content.topics, ["Arrays", "Loops"]);
  assert.deepEqual(result.source_content.languages, []);
  assert.ok(result.validation_issues.includes("format"));
  assert.ok(result.validation_issues.includes("course"));
  assert.equal(result.submitter_note, "ملاحظات خاصة");
  assert.ok(!JSON.stringify(result).includes("s123456"));
  assert.ok(!JSON.stringify(result).includes("private@example.invalid"));
  assert.ok(!JSON.stringify(result.source_content).includes("Private Name"));
  assert.ok(!JSON.stringify(result.source_content).includes("ملاحظات خاصة"));
});
test("consented credit, bilingual optional values, course resolution, stable source hash", () => {
  const r = row({
    consent: "Yes",
    type: "Practice material",
    format: "PDF",
    languages: "العربية, English",
  });
  const first = mapRow(r, columns, "Asia/Muscat");
  const second = mapRow(r, columns, "Asia/Muscat", [
    { id: "30000000-0000-0000-0000-000000000003", code: "COMP1001" },
  ]);
  assert.equal(first.source_content.credit, "Private Name");
  assert.equal(first.source_content.type, "Practice papers");
  assert.deepEqual(first.source_content.languages, ["ar", "en"]);
  assert.equal(first.source_content.format, "pdf");
  assert.equal(first.source_hash, second.source_hash);
  assert.ok(second.source_content.course_id);
});
test("bad IDs/cells fail ingestion; malformed URLs remain private and need correction", () => {
  assert.throws(() => mapRow(row({ id: "" }), columns, "Asia/Muscat"));
  assert.throws(() =>
    mapRow(row({ name: "x".repeat(201) }), columns, "Asia/Muscat"),
  );
  assert.throws(() =>
    mapRow(row({ timestamp: "1/2/2026" }), columns, "Asia/Muscat"),
  );
  assert.ok(
    mapRow(
      row({ url: "javascript:alert(1)" }),
      columns,
      "Asia/Muscat",
    ).validation_issues.includes("drive_key"),
  );
  assert.equal(sheetTime(25569, "Asia/Muscat"), "1969-12-31T20:00:00.000Z");
});
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
    json(body) {
      this.body = body;
      return this;
    },
  };
}
function deps(admin, extras = {}) {
  return {
    createAuthClient: () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "30000000-0000-0000-0000-000000000001",
              email: "admin@example.invalid",
            },
          },
        }),
      },
    }),
    getAdminClient: () => ({
      from(table) {
        const q = {
          select() {
            return q;
          },
          eq() {
            return q;
          },
          order() {
            return q;
          },
          range() {
            return q;
          },
          single() {
            return q;
          },
          maybeSingle() {
            return q;
          },
          then(resolve) {
            resolve(
              table === "admins"
                ? { data: admin ? { id: "admin" } : null }
                : { data: [], count: 0 },
            );
          },
        };
        return q;
      },
    }),
    ...extras,
  };
}
test("anonymous, members and Study Hub Editors cannot list, detail, mutate or sync intake", async () => {
  for (const kind of ["submissions", "submission"])
    for (const signedIn of [false, true]) {
      const res = response();
      await management(deps(false))(
        {
          method: "GET",
          headers: signedIn ? { authorization: "Bearer member" } : {},
          query: { kind },
        },
        res,
      );
      assert.equal(res.statusCode, signedIn ? 403 : 401);
    }
  for (const action of [
    "submission_save",
    "submission_reject",
    "submission_reopen",
    "submission_convert",
  ]) {
    const res = response();
    await management(deps(false))(
      {
        method: "POST",
        headers: { authorization: "Bearer editor" },
        body: { action },
      },
      res,
    );
    assert.equal(res.statusCode, 403);
  }
  for (const signedIn of [false, true]) {
    const res = response();
    let called = false;
    await sync(
      deps(false, {
        readBatch: async () => {
          called = true;
        },
      }),
    )(
      {
        method: "POST",
        headers: signedIn ? { authorization: "Bearer editor" } : {},
        body: {},
      },
      res,
    );
    assert.equal(res.statusCode, signedIn ? 403 : 401);
    assert.equal(called, false);
  }
});
test("authorized admin can list private queue; old pull endpoint is retired", async () => {
  const res = response();
  await management(deps(true))(
    {
      method: "GET",
      headers: { authorization: "Bearer admin" },
      query: { kind: "submissions" },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pending, 0);
  assert.match(res.headers["Cache-Control"], /no-store/);
  const pre = response();
  await sync(deps(true, { readBatch: async () => ({ preflight: true }) }))(
    {
      method: "POST",
      headers: { authorization: "Bearer admin" },
      body: { preflight: true },
    },
    pre,
  );
  assert.equal(pre.statusCode, 410);
  assert.equal(pre.body.error, "google_pull_retired");
});
test("conversion API strips private and forged identity fields before RPC", async () => {
  let captured;
  const d = deps(true);
  const db = d.getAdminClient();
  db.rpc = async (name, args) => {
    captured = args;
    return { data: { resource_id: "resource" } };
  };
  d.getAdminClient = () => db;
  const res = response();
  await management(d)(
    {
      method: "POST",
      headers: { authorization: "Bearer admin" },
      body: {
        action: "submission_convert",
        id: "30000000-0000-0000-0000-000000000005",
        version: 1,
        payload: {
          content: {
            title: "Notes",
            submitter_note: "PRIVATE",
            submitter_name: "NO CONSENT",
            is_admin: true,
            course_proposal: { code: "X1", email: "PRIVATE" },
          },
        },
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(captured.p_actor_email, "admin@example.invalid");
  assert.ok(!JSON.stringify(captured.p_payload).includes("PRIVATE"));
  assert.ok(!JSON.stringify(captured.p_payload).includes("NO CONSENT"));
});
