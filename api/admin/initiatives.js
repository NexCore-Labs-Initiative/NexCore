"use strict";

const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("../../lib/supabaseAdmin");
const { validateInitiative } = require("../../lib/initiatives");

function send(res, status, payload) {
  res.status(status).json(payload);
}

function getToken(req) {
  const value = String(req.headers?.authorization || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function authenticateAdmin(req, dependencies = {}) {
  const token = getToken(req);
  if (!token) return { error: { status: 401, code: "missing_authorization" } };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if ((!supabaseUrl || !supabaseAnonKey) && !dependencies.createAuthClient) {
    return { error: { status: 500, code: "server_misconfigured" } };
  }

  const authClient = dependencies.createAuthClient
    ? dependencies.createAuthClient(supabaseUrl, supabaseAnonKey, token)
    : createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user?.email) return { error: { status: 401, code: "invalid_or_expired_authorization" } };

  const adminClient = dependencies.getAdminClient ? dependencies.getAdminClient() : getSupabaseAdmin();
  const { data: admin, error: adminError } = await adminClient
    .from("admins")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (adminError || !admin) return { error: { status: 403, code: "admin_required" } };

  return { user, adminClient };
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
      if (session.error) return send(res, session.error.status, { error: session.error.code });
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
      console.error("Initiatives admin API failed", error);
      return send(res, 500, { error: "initiatives_admin_failed" });
    }
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
