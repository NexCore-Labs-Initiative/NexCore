"use strict";

function getBearerToken(headers = {}) {
  const value = headers.authorization || headers.Authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function authenticateUser({ headers, createClient, supabaseUrl, supabaseAnonKey }) {
  const token = getBearerToken(headers);
  if (!token) {
    return { ok: false, status: 401, error: "Missing or invalid authorization token" };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } = {}, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { ok: false, status: 401, error: "Invalid or expired token", authError: error };
  }

  return { ok: true, supabase, user, token };
}

module.exports = { authenticateUser, getBearerToken };
