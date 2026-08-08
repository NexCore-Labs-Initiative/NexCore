"use strict";

function sendJson(res, status, payload, headers = {}) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  return res.status(status).json(payload);
}

function sendError(res, status, error, message) {
  const payload = { error };
  if (message) payload.message = message;
  return sendJson(res, status, payload);
}

function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  sendError(res, 405, "method_not_allowed");
  return false;
}

function getBearerToken(req) {
  const value = String(req.headers?.authorization || req.headers?.Authorization || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

module.exports = { allowMethods, getBearerToken, sendError, sendJson };
