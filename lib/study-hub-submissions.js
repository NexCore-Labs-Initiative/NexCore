"use strict";
const { authenticateAdmin } = require("./api/auth");
const { sendJson, sendError } = require("./api/http");
const { normalizeContent } = require("./study-hub");
const { UUID } = require("./study-hub-intake");
function createHandler(deps = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const auth = await authenticateAdmin(req, deps);
      if (auth.error) return sendError(res, auth.error.status, auth.error.code);
      const db = auth.adminClient;
      if (req.method === "GET") {
        if (req.query.kind === "submission") {
          if (!UUID.test(req.query.id || ""))
            return sendError(res, 422, "invalid_id");
          const { data, error } = await db
            .from("study_hub_submissions")
            .select("*")
            .eq("id", req.query.id)
            .single();
          if (error) throw error;
          return sendJson(res, 200, data);
        }
        const status = req.query.status || "pending",
          offset = Number(req.query.offset || 0);
        if (
          !["pending", "rejected", "converted"].includes(status) ||
          !Number.isSafeInteger(offset) ||
          offset < 0
        )
          return sendError(res, 422, "invalid_query");
        const [list, count, latest] = await Promise.all([
          db
            .from("study_hub_submissions")
            .select(
              "id,submitted_at,review_content,status,source_changed,validation_issues,version",
            )
            .eq("status", status)
            .order("created_at", { ascending: false })
            .order("id")
            .range(offset, offset + 24),
          db
            .from("study_hub_submissions")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          db
            .from("study_hub_submissions")
            .select("created_at")
            .order("created_at", { ascending: false })
            .range(0, 0),
        ]);
        if (list.error || count.error || latest.error)
          throw list.error || count.error || latest.error;
        return sendJson(res, 200, {
          items: list.data,
          pending: count.count,
          lastImportedAt: latest.data[0]?.created_at || null,
          nextOffset: list.data.length === 25 ? offset + 25 : null,
        });
      }
      if (Buffer.byteLength(JSON.stringify(req.body || {})) > 60000)
        return sendError(res, 413, "payload_too_large");
      const { action, id, version, payload = {} } = req.body || {};
      const operation = action?.replace(/^submission_/, "");
      if (
        !["save", "reject", "reopen", "convert"].includes(operation) ||
        !UUID.test(id || "") ||
        !Number.isSafeInteger(version) ||
        version < 1
      )
        return sendError(res, 422, "invalid_submission_action");
      const safe = {
        note: payload.note,
        acknowledge_source: payload.acknowledge_source === true,
      };
      if (
        safe.note != null &&
        (typeof safe.note !== "string" || safe.note.length > 2000)
      )
        return sendError(res, 422, "invalid_note");
      if (["save", "convert"].includes(operation)) {
        if (
          !payload.content ||
          typeof payload.content !== "object" ||
          Array.isArray(payload.content)
        )
          return sendError(res, 422, "invalid_content");
        const normal = normalizeContent(payload.content);
        if (normal.errors.length)
          return sendJson(res, 422, {
            error: "invalid_fields",
            fields: normal.errors,
          });
        safe.content = normal.data;
      }
      const { data, error } = await db.rpc("study_hub_review_submission", {
        p_actor: auth.user.id,
        p_actor_email: auth.user.email.trim().toLowerCase(),
        p_action: operation,
        p_id: id,
        p_version: version,
        p_payload: safe,
      });
      if (error) throw error;
      if (data.duplicate_resource_id)
        return sendJson(res, 409, {
          error: "duplicate_drive_resource",
          resourceId: data.duplicate_resource_id,
        });
      return sendJson(res, 200, data);
    } catch (e) {
      const status = { 40001: 409, 22023: 422, 42501: 403, P0002: 404 }[e.code];
      // Only our fixed SQL validation messages are returned, never provider response bodies.
      const message =
        status && /^[a-z_]+(?::[a-z_]+)?$/.test(e.message || "")
          ? e.message
          : "submission_unavailable";
      return sendError(res, status || 503, message);
    }
  };
}
module.exports = { createHandler };
