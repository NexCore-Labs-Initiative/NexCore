"use strict";

const { authenticateUser } = require("../../lib/api/auth");
const { getSupabaseAdmin } = require("../../lib/supabaseAdmin");
const { allowMethods, sendError, sendJson } = require("../../lib/api/http");
const { normalizeContent } = require("../../lib/study-hub");

const ACTIONS = new Set([
  "create",
  "save",
  "submit",
  "withdraw",
  "return",
  "publish",
  "discard",
  "revise",
  "archive",
  "restore",
  "grant_editor",
  "revoke_editor",
  "semesters",
]);
const ADMIN_ACTIONS = new Set([
  "return",
  "publish",
  "archive",
  "restore",
  "grant_editor",
  "revoke_editor",
  "semesters",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createHandler(dependencies = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    if (!allowMethods(req, res, ["GET", "POST"])) return;
    if (
      ["submissions", "submission"].includes(req.query?.kind) ||
      String(req.body?.action || "").startsWith("submission_")
    )
      return require("../../lib/study-hub-submissions").createHandler(
        dependencies,
      )(req, res);
    try {
      const session = await authenticateUser(req, dependencies);
      if (session.error)
        return sendError(res, session.error.status, session.error.code);
      const db = dependencies.getAdminClient
        ? dependencies.getAdminClient()
        : getSupabaseAdmin();
      const { user } = session;
      const [admin, editor] = await Promise.all([
        db
          .from("admins")
          .select("id")
          .eq("email", String(user.email || "").toLowerCase())
          .maybeSingle(),
        db
          .from("study_hub_editors")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (admin.error || editor.error) throw admin.error || editor.error;
      const isAdmin = !!admin.data;
      if (!isAdmin && !editor.data)
        return sendError(res, 403, "study_hub_access_required");
      if (req.method === "GET") {
        const kind = req.query?.kind || "bootstrap";
        if (kind === "bootstrap") {
          const results = await Promise.all([
            db.from("study_hub_settings").select("*").single(),
            db.from("study_hub_colleges").select("*").order("code"),
            db.from("study_hub_courses").select("*").order("id").range(0, 499),
          ]);
          for (const item of results) if (item.error) throw item.error;
          return sendJson(res, 200, {
            isAdmin,
            userId: user.id,
            settings: results[0].data,
            colleges: results[1].data,
            courses: results[2].data,
          });
        }
        if (kind === "detail") {
          const id = String(req.query?.id || "");
          if (!UUID.test(id)) return sendError(res, 422, "invalid_id");
          const [resource, revisions] = await Promise.all([
            db.from("study_hub_resources").select("*").eq("id", id).single(),
            db
              .from("study_hub_resource_revisions")
              .select("*")
              .eq("resource_id", id)
              .order("created_at", { ascending: false })
              .range(0, 99),
          ]);
          if (resource.error || revisions.error)
            throw resource.error || revisions.error;
          return sendJson(res, 200, {
            resource: resource.data,
            revisions: revisions.data,
          });
        }
        if (kind === "editors") {
          if (!isAdmin) return sendError(res, 403, "admin_required");
          const { data, error } = await db
            .from("study_hub_editors")
            .select("user_id,granted_at")
            .order("user_id");
          if (error) throw error;
          const items = await Promise.all(
            data.map(async (item) => {
              const profile = await db.auth.admin.getUserById(item.user_id);
              if (profile.error) throw profile.error;
              return { ...item, email: profile.data.user?.email || "" };
            }),
          );
          return sendJson(res, 200, { items });
        }
        if (!["resources", "revisions", "courses"].includes(kind))
          return sendError(res, 422, "invalid_kind");
        const offset = Number(req.query?.offset || 0);
        if (!Number.isSafeInteger(offset) || offset < 0)
          return sendError(res, 422, "invalid_offset");
        const columns =
          kind === "revisions"
            ? "id,resource_id,state,version,content,updated_at"
            : "*";
        const { data, error } = await db
          .from(
            "study_hub_" + (kind === "revisions" ? "resource_revisions" : kind),
          )
          .select(columns)
          .order("id")
          .range(offset, offset + 99);
        if (error) throw error;
        return sendJson(res, 200, { items: data });
      }

      if (Buffer.byteLength(JSON.stringify(req.body || {}), "utf8") > 60000)
        return sendError(res, 413, "payload_too_large");
      const { action, id, version } = req.body || {};
      if (!ACTIONS.has(action)) return sendError(res, 422, "invalid_action");
      if (ADMIN_ACTIONS.has(action) && !isAdmin)
        return sendError(res, 403, "admin_required");
      let payload = req.body.payload || {};
      let targetId = id || null;
      if (action === "grant_editor") {
        // Search Auth users server-side; don't expose a directory of private user emails.
        const email = String(payload.email || "")
          .trim()
          .toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return sendError(res, 422, "invalid_email");
        let found;
        for (let page = 1; !found; page++) {
          const { data, error } = await db.auth.admin.listUsers({
            page,
            perPage: 100,
          });
          if (error) throw error;
          found = data.users.find((u) => u.email?.toLowerCase() === email);
          if (data.users.length < 100) break;
        }
        if (!found) return sendError(res, 422, "existing_labs_user_required");
        targetId = found.id;
        payload = {};
      }
      if (
        !["create", "semesters"].includes(action) &&
        !UUID.test(String(targetId || ""))
      )
        return sendError(res, 422, "invalid_id");
      if (
        !["create", "grant_editor", "revoke_editor"].includes(action) &&
        (!Number.isSafeInteger(version) || version < 1)
      )
        return sendError(res, 422, "invalid_version");
      if (["create", "save"].includes(action)) {
        const normalized = normalizeContent(payload);
        if (normalized.errors.length)
          return sendJson(res, 422, {
            error: "invalid_fields",
            fields: normalized.errors,
          });
        payload = normalized.data;
      }
      const { data, error } = await db.rpc("study_hub_mutate", {
        p_actor: user.id,
        p_actor_email: String(user.email || "")
          .trim()
          .toLowerCase(),
        p_action: action,
        p_id: targetId,
        p_version: version || null,
        p_payload: payload,
      });
      if (error) {
        const code = {
          40001: 409,
          23505: 409,
          22023: 422,
          42501: 403,
          P0002: 404,
        }[error.code];
        if (code)
          return sendError(
            res,
            code,
            error.code === "23505"
              ? "duplicate_resource_or_course"
              : error.message,
          );
        throw error;
      }
      return sendJson(res, 200, data);
    } catch (error) {
      console.error("study_hub_request_failed", error?.code || "unknown");
      return sendError(res, 503, "study_hub_unavailable");
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
