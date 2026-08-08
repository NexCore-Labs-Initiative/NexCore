"use strict";

const { authenticateAdmin } = require("../../lib/api/auth");
const { allowMethods, sendError, sendJson } = require("../../lib/api/http");
const { cleanOptionalText, validateEmail } = require("../../lib/api/validation");
const { checkRateLimit } = require("../../lib/api/rateLimit");
const { logEvent } = require("../../lib/api/logger");

const RESOURCES = {
  approved_users: {
    select: "id, email, approved_by, reason, approved_at, created_at, updated_at",
    order: "created_at",
    noteField: "reason",
    actorField: "approved_by"
  },
  admins: {
    select: "id, email, added_by, added_at, notes",
    order: "added_at",
    noteField: "notes",
    actorField: "added_by"
  }
};

function createHandler(dependencies = {}) {
  return async function adminAccessHandler(req, res) {
    if (!allowMethods(req, res, ["GET", "POST", "PATCH", "DELETE"])) return;
    const rate = checkRateLimit(req, { limit: 90, scope: "admin-access" });
    if (!rate.allowed) return sendError(res, 429, "rate_limited");

    try {
      const session = await authenticateAdmin(req, dependencies);
      if (session.error) return sendError(res, session.error.status, session.error.code);

      const resourceName = String(req.query?.resource || req.body?.resource || "approved_users");
      const resource = RESOURCES[resourceName];
      if (!resource) return sendError(res, 400, "invalid_resource");
      const { adminClient, user } = session;

      if (req.method === "GET") {
        const { data, error, count } = await adminClient
          .from(resourceName)
          .select(resource.select, { count: "exact" })
          .order(resource.order, { ascending: false });
        if (error) throw error;
        return sendJson(res, 200, { resource: resourceName, count: count || 0, items: data || [] });
      }

      const email = validateEmail(req.body?.email);
      if (!email) return sendError(res, 422, "invalid_email");
      if (req.method === "DELETE" && resourceName === "admins" && email === user.email?.toLowerCase()) {
        return sendError(res, 409, "cannot_remove_self");
      }

      if (req.method === "DELETE") {
        const { data, error } = await adminClient.from(resourceName).delete().eq("email", email).select("id");
        if (error) throw error;
        if (!data?.length) return sendError(res, 404, "access_record_not_found");
        logEvent("info", "admin_access_deleted", { actor_id: user.id, resource: resourceName });
        return sendJson(res, 200, { ok: true, email });
      }

      const note = cleanOptionalText(req.body?.note ?? req.body?.reason ?? req.body?.notes, 500);
      const values = {
        email,
        [resource.noteField]: note,
        [resource.actorField]: user.email.toLowerCase()
      };

      const query = req.method === "POST"
        ? adminClient.from(resourceName).insert(values)
        : adminClient.from(resourceName).update(values).eq("email", email);
      const { data, error } = await query.select(resource.select).single();
      if (error?.code === "23505") return sendError(res, 409, "access_record_exists");
      if (error) throw error;
      logEvent("info", req.method === "POST" ? "admin_access_created" : "admin_access_updated", {
        actor_id: user.id,
        resource: resourceName
      });
      return sendJson(res, req.method === "POST" ? 201 : 200, { item: data });
    } catch (error) {
      logEvent("error", "admin_access_failed", { message: error?.message || String(error) });
      return sendError(res, 500, "admin_access_failed");
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
