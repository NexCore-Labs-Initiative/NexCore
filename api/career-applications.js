"use strict";

const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { allowMethods, sendError, sendJson } = require("../lib/api/http");
const { checkRateLimit } = require("../lib/api/rateLimit");

function normalizeApplication(body) {
  if (typeof body === "string") {
    if (Buffer.byteLength(body) > 20000) return null;
    try { body = JSON.parse(body); } catch (_) { return null; }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const limits = { full_name: 120, email: 254, college_major: 160, academic_year: 80,
    motivation: 2000, experience: 2000, portfolio_url: 500, weekly_availability: 120, role_answer: 1500 };
  const row = {};
  for (const [key, max] of Object.entries(limits)) {
    if (typeof body[key] !== "string" && !(key === "portfolio_url" && body[key] == null)) return null;
    const value = (body[key] || "").trim();
    if (value.length > max || (!value && key !== "portfolio_url")) return null;
    row[key] = value;
  }
  row.email = row.email.toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*squ\.edu\.om$/i.test(row.email)) return null;
  if (!["marketing", "social-media"].includes(body.role) || body.consent !== true) return null;
  if (row.portfolio_url) {
    try {
      const url = new URL(row.portfolio_url);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    } catch (_) { return null; }
  } else row.portfolio_url = null;
  row.role = body.role;
  return row;
}

function createCareerApplicationsHandler({ getAdminClient = getSupabaseAdmin, rateLimiter = checkRateLimit } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (!allowMethods(req, res, ["POST"])) return;
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers?.["content-type"] || "")) return sendError(res, 415, "invalid_content_type");
    const rate = rateLimiter(req, { limit: 5, windowMs: 600000, scope: "career-applications" });
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfter));
      return sendError(res, 429, "rate_limited");
    }
    const row = normalizeApplication(req.body);
    if (!row) return sendError(res, 400, "invalid_application");
    try {
      // No select/returning: applicant details never leave this endpoint.
      const { error } = await getAdminClient().from("career_applications").insert(row);
      if (error) return sendError(res, 503, "applications_unavailable");
      return sendJson(res, 201, { ok: true });
    } catch (_) {
      // Database errors may contain personal information; do not log them.
      return sendError(res, 503, "applications_unavailable");
    }
  };
}

module.exports = createCareerApplicationsHandler();
module.exports.createCareerApplicationsHandler = createCareerApplicationsHandler;
module.exports.normalizeApplication = normalizeApplication;
