"use strict";

const { validateInitiative } = require("../../lib/initiatives");
const { authenticateAdmin } = require("../../lib/api/auth");
const { logEvent } = require("../../lib/api/logger");
const { sendError, sendJson } = require("../../lib/api/http");

function send(res, status, payload) {
  return sendJson(res, status, payload);
}

function createHandler(dependencies = {}) {
  return async function initiativesAdminHandler(req, res) {
    if (req.method === "OPTIONS") {
      res.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
      return send(res, 200, { ok: true });
    }

    if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
      return send(res, 405, { error: "method_not_allowed" });
    }

    try {
      const session = await authenticateAdmin(req, dependencies);
      if (session.error) return sendError(res, session.error.status, session.error.code);
      const { user, adminClient } = session;

      if (req.method === "GET") {
        const { data, error } = await adminClient
          .from("initiatives")
          .select("*")
          .order("featured", { ascending: false })
          .order("sort_order", { ascending: true })
          .order("updated_at", { ascending: false });
        if (error) return send(res, 500, { error: "failed_to_load_initiatives" });
        return send(res, 200, { initiatives: data || [] });
      }

      if (req.method === "DELETE") {
        const id = String(req.body?.id || "").trim();
        if (!id) return send(res, 400, { error: "missing_initiative_id" });
        const { error } = await adminClient.from("initiatives").delete().eq("id", id);
        if (error) return send(res, 500, { error: "failed_to_delete_initiative" });
        return send(res, 200, { ok: true, id });
      }

      const { errors, data } = validateInitiative(req.body);
      if (errors.length) return send(res, 422, { error: "invalid_initiative", details: errors });
      const audit = req.method === "POST" ? { created_by: user.id, updated_by: user.id } : { updated_by: user.id };
      const values = { ...data, ...audit };

      if (req.method === "POST") {
        const { data: initiative, error } = await adminClient.from("initiatives").insert(values).select("*").single();
        if (error?.code === "23505") return send(res, 409, { error: "slug_already_exists" });
        if (error) return send(res, 500, { error: "failed_to_create_initiative" });
        return send(res, 201, { initiative });
      }

      const id = String(req.body?.id || "").trim();
      if (!id) return send(res, 400, { error: "missing_initiative_id" });
      const { data: initiative, error } = await adminClient.from("initiatives").update(values).eq("id", id).select("*").single();
      if (error?.code === "23505") return send(res, 409, { error: "slug_already_exists" });
      if (error) return send(res, 500, { error: "failed_to_update_initiative" });
      return send(res, 200, { initiative });
    } catch (error) {
      logEvent("error", "initiatives_admin_failed", { message: error?.message || String(error) });
      return sendError(res, 500, "initiatives_admin_failed");
    }
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
