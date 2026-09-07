"use strict";
const assert = require("node:assert/strict");
const { normalizeApplication, createCareerApplicationsHandler } = require("../api/career-applications");
const valid = { role: "marketing", full_name: "Test Student", email: "student@student.squ.edu.om",
  college_major: "Science", academic_year: "Year 2", motivation: "Help students discover useful tools.",
  experience: "Student activities", portfolio_url: "", weekly_availability: "3 hours", role_answer: "A student campaign", consent: true };
async function main() {
  assert.equal(normalizeApplication(valid).portfolio_url, null);
  assert.equal(normalizeApplication({ ...valid, status: "accepted", id: "injected" }).status, undefined);
  for (const changes of [{ email: "x@squ.edu.om.evil.test" }, { email: "x@gmail.com" }, { role: "admin" },
    { consent: false }, { motivation: " " }, { experience: "x".repeat(2001) }, { full_name: {} },
    { portfolio_url: "javascript:alert(1)" }, { portfolio_url: "https://user:secret@example.com" }]) {
    assert.equal(normalizeApplication({ ...valid, ...changes }), null);
  }
  assert.equal(normalizeApplication("bad json"), null);
  assert.equal(normalizeApplication([]), null);
  let writes = 0, fail = false, limited = false;
  const handler = createCareerApplicationsHandler({
    getAdminClient: () => ({ from: table => {
      assert.equal(table, "career_applications");
      return { insert: async row => { writes++; assert.equal(row.email, valid.email); return { error: fail ? { details: "private applicant" } : null }; } };
    } }),
    rateLimiter: () => ({ allowed: !limited, retryAfter: 60 })
  });
  async function call(body, method = "POST", type = "application/json") {
    const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(s) { this.code = s; return this; }, json(p) { this.payload = p; } };
    await handler({ method, body, headers: { "content-type": type } }, res);
    assert.equal(res.headers["Cache-Control"], "no-store");
    return res;
  }
  assert.equal((await call(valid, "GET")).code, 405);
  assert.equal((await call(valid, "POST", "text/plain")).code, 415);
  assert.equal((await call({ ...valid, consent: false })).code, 400);
  assert.equal(writes, 0);
  const saved = await call(JSON.stringify(valid));
  assert.equal(saved.code, 201); assert.deepEqual(saved.payload, { ok: true });
  fail = true; const failed = await call(valid);
  assert.equal(failed.code, 503); assert(!JSON.stringify(failed.payload).includes("private"));
  limited = true; assert.equal((await call(valid)).code, 429); assert.equal(writes, 2);
  console.log("Careers validation, private responses, method restrictions, failure handling and rate limiting passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
