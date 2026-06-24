"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { validateInitiative } = require("../lib/initiatives");
const { createHandler } = require("../api/admin/initiatives");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const validPayload = {
  slug: "nexcore-study-hub",
  status: "in-development",
  categories: ["ai-dev-tools"],
  featured: false,
  sort_order: 0,
  visibility: "draft",
  title: { en: "NexCore Study Hub", ar: "مركز NexCore للدراسة" },
  mission: { en: "Useful study resources.", ar: "مصادر دراسية مفيدة." },
  summary: { en: "A curated catalogue.", ar: "دليل منسق." },
  overview: { en: "A fuller description.", ar: "وصف أكثر تفصيلاً." },
  highlights: [{ en: "Curated", ar: "منسق" }],
  image: { src: "/assets/images/study-hub.webp", alt: { en: "Study Hub", ar: "مركز الدراسة" } },
  primary_link: { url: "https://study.nexcorelabs.com", label: { en: "Explore", ar: "استكشف" } }
};

assert.deepStrictEqual(validateInitiative(validPayload).errors, [], "A complete bilingual initiative should validate");
assert(validateInitiative({ ...validPayload, title: { en: "English only" } }).errors.length > 0, "Both title locales are required");
assert(validateInitiative({ ...validPayload, categories: [] }).errors.length > 0, "A category is required");
assert(validateInitiative({ ...validPayload, primary_link: { url: "javascript:alert(1)", label: { en: "Open", ar: "فتح" } } }).errors.length > 0, "Unsafe URLs are rejected");

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    setHeader() {},
    status(status) { this.statusCode = status; return this; },
    json(payload) { this.payload = payload; return payload; }
  };
}

(async () => {
  const noAuth = createHandler();
  const noAuthRes = createResponse();
  await noAuth({ method: "GET", headers: {} }, noAuthRes);
  assert.strictEqual(noAuthRes.statusCode, 401, "Requests without a bearer token are rejected");

  const nonAdmin = createHandler({
    createAuthClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "person@example.com" } }, error: null }) } }),
    getAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) })
  });
  const nonAdminRes = createResponse();
  await nonAdmin({ method: "GET", headers: { authorization: "Bearer token" } }, nonAdminRes);
  assert.strictEqual(nonAdminRes.statusCode, 403, "Non-admin users are rejected");

  const mutations = [];
  const adminClient = {
    from(table) {
      if (table === "admins") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: "admin@example.com" }, error: null }) }) }) };
      }
      if (table !== "initiatives") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({ order: () => ({ order: () => ({ order: async () => ({ data: [{ id: "initiative-1", ...validPayload }], error: null }) }) }) }),
        insert(values) { mutations.push({ method: "insert", values }); return { select: () => ({ single: async () => ({ data: { id: "initiative-2", ...values }, error: null }) }) }; },
        update(values) { mutations.push({ method: "update", values }); return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: "initiative-1", ...values }, error: null }) }) }) }; },
        delete() { return { eq: async (id) => { mutations.push({ method: "delete", id }); return { error: null }; } }; }
      };
    }
  };
  const verifiedAdmin = createHandler({
    createAuthClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "admin-id", email: "admin@example.com" } }, error: null }) } }),
    getAdminClient: () => adminClient
  });
  const listRes = createResponse();
  await verifiedAdmin({ method: "GET", headers: { authorization: "Bearer token" } }, listRes);
  assert.strictEqual(listRes.statusCode, 200, "Verified admins can list initiatives");
  const createRes = createResponse();
  await verifiedAdmin({ method: "POST", headers: { authorization: "Bearer token" }, body: validPayload }, createRes);
  assert.strictEqual(createRes.statusCode, 201, "Verified admins can create initiatives");
  assert.deepStrictEqual(mutations[0].values.created_by, "admin-id", "Create records the author");
  const updateRes = createResponse();
  await verifiedAdmin({ method: "PATCH", headers: { authorization: "Bearer token" }, body: { ...validPayload, id: "initiative-1", visibility: "public" } }, updateRes);
  assert.strictEqual(updateRes.statusCode, 200, "Verified admins can publish initiatives");
  assert.deepStrictEqual(mutations[1].values.updated_by, "admin-id", "Update records the editor");
  const deleteRes = createResponse();
  await verifiedAdmin({ method: "DELETE", headers: { authorization: "Bearer token" }, body: { id: "initiative-1" } }, deleteRes);
  assert.strictEqual(deleteRes.statusCode, 200, "Verified admins can delete initiatives");

  for (const file of ["admin-users.html", "ar/admin-users.html"]) {
    const html = read(file);
    assert(html.includes('data-tab="initiatives"'), `${file} must expose the Initiatives tab`);
    assert(html.includes('id="initiativeForm"'), `${file} must include the initiative form`);
    assert(html.includes('id="initiativesTableBody"'), `${file} must include the initiative list`);
    assert(html.includes('assets/js/initiatives-admin.js'), `${file} must load the shared authoring behavior`);
  }

  console.log("Initiatives admin tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
