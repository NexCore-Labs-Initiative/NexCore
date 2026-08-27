"use strict";

const { authenticateAdmin } = require("../../lib/api/auth");
const { allowMethods, sendError, sendJson } = require("../../lib/api/http");
const { checkRateLimit } = require("../../lib/api/rateLimit");
const { logEvent } = require("../../lib/api/logger");

const TABLE = "docs_feedback_responses";
const PAGE_KEY = "how-to-use";
const LOCALES = ["en", "ar"];
const VOTES = ["yes", "no"];

function getUTCDateStringDaysAgo(daysAgo, now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function helpfulRate(yes, total) {
  if (!total) return 0;
  return Math.round((yes / total) * 1000) / 10;
}

async function countFeedbackRows(adminClient, filters = {}) {
  let query = adminClient
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("page_key", PAGE_KEY);

  if (filters.locale) query = query.eq("locale", filters.locale);
  if (filters.vote) query = query.eq("vote", filters.vote);
  if (filters.fromDate) query = query.gte("response_date", filters.fromDate);

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function loadDailyRows(adminClient, fromDate) {
  const { data, error } = await adminClient
    .from(TABLE)
    .select("response_date, vote")
    .eq("page_key", PAGE_KEY)
    .gte("response_date", fromDate)
    .order("response_date", { ascending: true })
    .limit(5000);

  if (error) throw error;
  return data || [];
}

function buildDailySeries(rows, days, now = new Date()) {
  const byDate = new Map();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = getUTCDateStringDaysAgo(offset, now);
    byDate.set(date, { date, yes: 0, no: 0, total: 0 });
  }

  for (const row of rows || []) {
    const date = String(row.response_date || "").slice(0, 10);
    const bucket = byDate.get(date);
    if (!bucket || !VOTES.includes(row.vote)) continue;
    bucket[row.vote] += 1;
    bucket.total += 1;
  }

  return Array.from(byDate.values());
}

async function buildFeedbackStats(adminClient, now = new Date()) {
  const recentFromDate = getUTCDateStringDaysAgo(6, now);
  const trendFromDate = getUTCDateStringDaysAgo(13, now);

  const [
    total,
    yes,
    no,
    enTotal,
    enYes,
    enNo,
    arTotal,
    arYes,
    arNo,
    recentTotal,
    recentYes,
    recentNo,
    dailyRows
  ] = await Promise.all([
    countFeedbackRows(adminClient),
    countFeedbackRows(adminClient, { vote: "yes" }),
    countFeedbackRows(adminClient, { vote: "no" }),
    countFeedbackRows(adminClient, { locale: "en" }),
    countFeedbackRows(adminClient, { locale: "en", vote: "yes" }),
    countFeedbackRows(adminClient, { locale: "en", vote: "no" }),
    countFeedbackRows(adminClient, { locale: "ar" }),
    countFeedbackRows(adminClient, { locale: "ar", vote: "yes" }),
    countFeedbackRows(adminClient, { locale: "ar", vote: "no" }),
    countFeedbackRows(adminClient, { fromDate: recentFromDate }),
    countFeedbackRows(adminClient, { fromDate: recentFromDate, vote: "yes" }),
    countFeedbackRows(adminClient, { fromDate: recentFromDate, vote: "no" }),
    loadDailyRows(adminClient, trendFromDate)
  ]);

  const locales = {
    en: { total: enTotal, yes: enYes, no: enNo, helpful_rate: helpfulRate(enYes, enTotal) },
    ar: { total: arTotal, yes: arYes, no: arNo, helpful_rate: helpfulRate(arYes, arTotal) }
  };

  return {
    ok: true,
    page_key: PAGE_KEY,
    totals: { total, yes, no, helpful_rate: helpfulRate(yes, total) },
    recent: { days: 7, total: recentTotal, yes: recentYes, no: recentNo, helpful_rate: helpfulRate(recentYes, recentTotal) },
    locales,
    daily: { days: 14, items: buildDailySeries(dailyRows, 14, now) },
    updated_at: now.toISOString()
  };
}

function createHandler(dependencies = {}) {
  return async function docsFeedbackStatsHandler(req, res) {
    if (!allowMethods(req, res, ["GET"])) return;

    const rate = (dependencies.rateLimiter || checkRateLimit)(req, {
      limit: 60,
      windowMs: 60_000,
      scope: "admin-docs-feedback"
    });
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfter));
      return sendError(res, 429, "rate_limited");
    }

    try {
      const authenticate = dependencies.authenticateAdmin || authenticateAdmin;
      const session = await authenticate(req, dependencies);
      if (session.error) return sendError(res, session.error.status, session.error.code);

      const now = dependencies.now ? dependencies.now() : new Date();
      const stats = await buildFeedbackStats(session.adminClient, now);
      return sendJson(res, 200, stats);
    } catch (error) {
      logEvent("error", "admin_docs_feedback_failed", { message: error?.message || String(error) });
      return sendError(res, 500, "admin_docs_feedback_failed");
    }
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.buildDailySeries = buildDailySeries;
module.exports.buildFeedbackStats = buildFeedbackStats;
module.exports.getUTCDateStringDaysAgo = getUTCDateStringDaysAgo;
