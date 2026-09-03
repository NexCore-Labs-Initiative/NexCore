"use strict";

const crypto = require("crypto");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { allowMethods, sendError, sendJson } = require("../lib/api/http");
const { checkRateLimit } = require("../lib/api/rateLimit");

const VALID_LOCALES = new Set(["en", "ar"]);
const VALID_VOTES = new Set(["yes", "no"]);
const DEFAULT_PAGE_KEY = "how-to-use";
const ALLOWED_PATHS_BY_PAGE_KEY = new Map([
  ["how-to-use", new Set(["/how-to-use", "/ar/how-to-use"])],
  ["faq", new Set(["/faq", "/ar/faq"])]
]);

function parseBody(body) {
  if (!body || typeof body === "object") return body || {};
  if (typeof body !== "string") return {};
  try {
    return JSON.parse(body);
  } catch (_) {
    return {};
  }
}

function normalizePagePath(value) {
  let path = String(value || "").trim().replace(/\/index(?:\.html)?$/i, "");
  path = path.startsWith("/") ? path : `/${path}`;
  path = path.length > 1 ? path.replace(/\/+$/g, "") : path;
  if (path === "/how-to-use.html") return "/how-to-use";
  if (path === "/ar/how-to-use.html") return "/ar/how-to-use";
  if (path === "/faq.html") return "/faq";
  if (path === "/ar/faq.html") return "/ar/faq";
  return path;
}

function getTodayUTCDateString(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getHeader(req, name) {
  const headers = req.headers || {};
  return String(headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "");
}

function getCoarseRequestIdentity(req) {
  const forwardedFor = getHeader(req, "x-forwarded-for").split(",")[0].trim();
  const raw = forwardedFor || req.socket?.remoteAddress || "unknown";
  const withoutPort = raw.replace(/^\[|\]$/g, "").replace(/:\d+$/, "");

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(withoutPort)) {
    return withoutPort.split(".").slice(0, 3).join(".") + ".0";
  }

  if (withoutPort.includes(":")) {
    return withoutPort.split(":").slice(0, 4).join(":") + "::";
  }

  return "unknown";
}

function buildClientHash(req, env = process.env) {
  const salt = env.DOCS_FEEDBACK_SALT || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) {
    throw new Error("Missing DOCS_FEEDBACK_SALT or SUPABASE_SERVICE_ROLE_KEY");
  }
  return crypto
    .createHash("sha256")
    .update(`${salt}:${getCoarseRequestIdentity(req)}`)
    .digest("hex");
}

function normalizeFeedbackPayload(body) {
  const payload = parseBody(body);
  const pageKey = String(payload.page_key || DEFAULT_PAGE_KEY).trim().toLowerCase();
  const pagePath = normalizePagePath(payload.page_path);
  const locale = String(payload.locale || "").trim().toLowerCase();
  const vote = String(payload.vote || "").trim().toLowerCase();

  const allowedPaths = ALLOWED_PATHS_BY_PAGE_KEY.get(pageKey);
  if (!allowedPaths || !allowedPaths.has(pagePath)) return { error: "invalid_page" };
  if (!VALID_LOCALES.has(locale)) return { error: "invalid_locale" };
  if (!VALID_VOTES.has(vote)) return { error: "invalid_vote" };

  return { pageKey, pagePath, locale, vote };
}

function createDocsFeedbackHandler({
  getAdminClient = getSupabaseAdmin,
  rateLimiter = checkRateLimit,
  env = process.env,
  now = () => new Date(),
  logger = console
} = {}) {
  return async function docsFeedbackHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;

    const rate = rateLimiter(req, { limit: 10, windowMs: 60_000, scope: "docs-feedback" });
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfter));
      return sendError(res, 429, "rate_limited");
    }

    const feedback = normalizeFeedbackPayload(req.body);
    if (feedback.error) {
      return sendError(res, 400, feedback.error);
    }

    try {
      const currentTime = now();
      const row = {
        page_path: feedback.pagePath,
        page_key: feedback.pageKey,
        locale: feedback.locale,
        vote: feedback.vote,
        client_hash: buildClientHash(req, env),
        response_date: getTodayUTCDateString(currentTime),
        updated_at: currentTime.toISOString()
      };

      const { error } = await getAdminClient()
        .from("docs_feedback_responses")
        .upsert(row, { onConflict: "page_key,locale,client_hash,response_date" });

      if (error) throw error;
      return sendJson(res, 200, { ok: true, status: "saved" });
    } catch (error) {
      logger.error("[docs-feedback] Request failed:", error);
      return sendError(res, 503, "feedback_unavailable");
    }
  };
}

module.exports = createDocsFeedbackHandler();
module.exports.createDocsFeedbackHandler = createDocsFeedbackHandler;
module.exports.buildClientHash = buildClientHash;
module.exports.getCoarseRequestIdentity = getCoarseRequestIdentity;
module.exports.getTodayUTCDateString = getTodayUTCDateString;
module.exports.normalizeFeedbackPayload = normalizeFeedbackPayload;
