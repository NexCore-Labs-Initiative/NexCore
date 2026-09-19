const test = require("node:test");
const assert = require("node:assert/strict");
const { driveTarget, normalizeContent } = require("../lib/study-hub");
const { createHandler } = require("../api/admin/study-hub");

test("Drive normalization accepts files, folders, resource keys and shared file aliases", () => {
  assert.deepEqual(
    driveTarget("https://drive.google.com/open?id=abcdef_1&usp=sharing"),
    { key: "abcdef_1", url: "https://drive.google.com/file/d/abcdef_1/view" },
  );
  assert.equal(
    driveTarget(
      "https://drive.google.com/drive/u/0/folders/abcdef_1?resourcekey=abc-123",
    ).url,
    "https://drive.google.com/drive/folders/abcdef_1?resourcekey=abc-123",
  );
  for (const url of [
    "https://evildrive.google.com/file/d/abcdef/view",
    "javascript:alert(1)",
    "https://drive.google.com.evil.test/file/d/abcdef/view",
    "http://drive.google.com/file/d/abcdef/view",
    "https://user@drive.google.com/file/d/abcdef/view",
    "https://drive.google.com/anything",
  ])
    assert.equal(driveTarget(url), null, url);
});
test("normalizer allows incomplete drafts but removes untrusted fields and normalizes bilingual data", () => {
  const result = normalizeContent({
    title: " Test ",
    languages: ["ar", "en", "ar"],
    topics: [" a ", "a"],
    credit_permission: true,
    is_admin: true,
    reviewed_by: "attacker",
    status: "published",
    course_proposal: { code: "comp1001", title: "Programming" },
    translations: { ar: { title: "مورد", topics: ["موضوع"] } },
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.data.title, "Test");
  assert.deepEqual(result.data.languages, ["ar", "en"]);
  assert.deepEqual(result.data.topics, ["a"]);
  assert.equal(result.data.course_proposal.code, "COMP1001");
  assert.equal(result.data.is_admin, undefined);
  assert.equal(result.data.status, undefined);
  assert.equal(result.data.reviewed_by, undefined);
  assert.ok(
    normalizeContent({ title: "x".repeat(201) }).errors.includes("title"),
  );
});
function harness({ admin = false, editor = false, signedIn = true } = {}) {
  const calls = [];
  const db = {
    from(table) {
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        async maybeSingle() {
          return {
            data:
              table === "admins" && admin
                ? { id: "admin" }
                : table === "study_hub_editors" && editor
                  ? { user_id: "editor" }
                  : null,
          };
        },
      };
      return chain;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: { ok: true } };
    },
  };
  const handler = createHandler({
    createAuthClient: () => ({
      auth: {
        getUser: async () =>
          signedIn
            ? {
                data: {
                  user: {
                    id: "10000000-0000-0000-0000-000000000002",
                    email: "editor@example.invalid",
                  },
                },
              }
            : { error: { message: "expired" } },
      },
    }),
    getAdminClient: () => db,
  });
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return {
    calls,
    res,
    invoke: (body, headers = { authorization: "Bearer test-token" }) =>
      handler({ method: "POST", headers, body }, res),
  };
}
test("API refuses missing sessions, normal users and editor escalation", async () => {
  let h = harness();
  await h.invoke({ action: "create" }, {});
  assert.equal(h.res.statusCode, 401);
  h = harness({ signedIn: false });
  await h.invoke({ action: "create" });
  assert.equal(h.res.statusCode, 401);
  h = harness();
  await h.invoke({ action: "create" });
  assert.equal(h.res.statusCode, 403);
  for (const action of [
    "publish",
    "return",
    "archive",
    "restore",
    "grant_editor",
    "revoke_editor",
    "semesters",
  ]) {
    h = harness({ editor: true });
    await h.invoke({ action });
    assert.equal(h.res.statusCode, 403);
    assert.equal(h.calls.length, 0);
  }
});
test("API derives actor from verified session, ignores client permissions and never caches", async () => {
  const h = harness({ editor: true });
  await h.invoke({
    action: "create",
    p_actor: "attacker",
    isAdmin: true,
    payload: { title: "Notes", status: "published" },
  });
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.calls[0].args.p_actor, "10000000-0000-0000-0000-000000000002");
  assert.equal(h.calls[0].args.p_payload.status, undefined);
  assert.equal(h.res.headers["Cache-Control"], "private, no-store");
});
test("API requires optimistic version and rejects unexpected actions", async () => {
  const h = harness({ editor: true });
  await h.invoke({
    action: "save",
    id: "10000000-0000-0000-0000-000000000001",
  });
  assert.equal(h.res.statusCode, 422);
  await h.invoke({ action: "delete_everything" });
  assert.equal(h.res.statusCode, 422);
  assert.equal(h.calls.length, 0);
});
