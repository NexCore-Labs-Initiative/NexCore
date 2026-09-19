"use strict";
// Controlled response for old cached clients. Google pull is retired.
const { authenticateAdmin } = require("../api/auth");
const { allowMethods, sendError } = require("../api/http");
function createHandler(deps = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!allowMethods(req, res, ["POST"])) return;
    try {
      const auth = await authenticateAdmin(req, deps);
      if (auth.error) return sendError(res, auth.error.status, auth.error.code);
      return sendError(res, 410, "google_pull_retired");
    } catch {
      return sendError(res, 503, "submission_unavailable");
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
