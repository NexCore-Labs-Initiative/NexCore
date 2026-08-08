"use strict";

const { createClient } = require("@supabase/supabase-js");
const { getSupabaseAdmin } = require("../supabaseAdmin");
const { getBearerToken } = require("./http");

async function authenticateUser(req, dependencies = {}) {
  const token = getBearerToken(req);
  if (!token) return { error: { status: 401, code: "missing_authorization" } };

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if ((!supabaseUrl || !publishableKey) && !dependencies.createAuthClient) {
    return { error: { status: 500, code: "server_misconfigured" } };
  }

  const client = dependencies.createAuthClient
    ? dependencies.createAuthClient(supabaseUrl, publishableKey, token)
    : createClient(supabaseUrl, publishableKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { error: { status: 401, code: "invalid_or_expired_authorization" } };
  }

  return { user: data.user, token };
}

async function authenticateAdmin(req, dependencies = {}) {
  const session = await authenticateUser(req, dependencies);
  if (session.error) return session;

  const adminClient = dependencies.getAdminClient
    ? dependencies.getAdminClient()
    : getSupabaseAdmin();
  const email = String(session.user.email || "").trim().toLowerCase();
  if (!email) return { error: { status: 403, code: "admin_required" } };

  const { data, error } = await adminClient
    .from("admins")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { error: { status: 403, code: "admin_required" } };
  return { ...session, admin: data, adminClient };
}

module.exports = { authenticateAdmin, authenticateUser };
