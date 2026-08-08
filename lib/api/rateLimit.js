"use strict";

const buckets = new Map();

function getClientKey(req) {
  return String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function checkRateLimit(req, { limit = 60, windowMs = 60_000, scope = "api" } = {}) {
  const now = Date.now();
  const key = `${scope}:${getClientKey(req)}`;
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfter: Math.ceil((existing.resetAt - now) / 1000)
  };
}

module.exports = { checkRateLimit };
