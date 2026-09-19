"use strict";

const { sendError } = require("../../lib/api/http");

// One Vercel function preserves the existing URLs. Every handler owns its
// authorization; query/body values never select a different handler.
const handlers = new Map([
  ["access", require("../../lib/admin-handlers/access")],
  ["docs-feedback", require("../../lib/admin-handlers/docs-feedback")],
  ["initiatives", require("../../lib/admin-handlers/initiatives")],
  ["study-hub", require("../../lib/admin-handlers/study-hub")],
  ["study-hub-sync", require("../../lib/admin-handlers/study-hub-sync")],
]);

function createHandler(routes = handlers) {
  return function adminRouter(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    const path = String(req.url || "").split("?")[0];
    const match = /^\/api\/admin\/([a-z-]+)\/?$/.exec(path);
    const handler = match && routes.get(match[1]);
    if (!handler) return sendError(res, 404, "admin_route_not_found");
    return handler(req, res);
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
