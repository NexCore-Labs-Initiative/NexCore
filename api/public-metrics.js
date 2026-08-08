"use strict";

const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { allowMethods, sendError, sendJson } = require("../lib/api/http");
const { checkRateLimit } = require("../lib/api/rateLimit");
const { logEvent } = require("../lib/api/logger");

function countQuery(client, table, configure = (query) => query) {
  return configure(client.from(table).select("id", { count: "exact", head: true }));
}

function createHandler(dependencies = {}) {
  return async function publicMetricsHandler(req, res) {
    if (!allowMethods(req, res, ["GET"])) return;
    const rate = checkRateLimit(req, { limit: 120, scope: "public-metrics" });
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfter));
      return sendError(res, 429, "rate_limited");
    }

    try {
      const client = dependencies.getAdminClient ? dependencies.getAdminClient() : getSupabaseAdmin();
      const slugs = String(req.query?.slugs || "")
        .split(",")
        .map((slug) => slug.trim().toLowerCase())
        .filter((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
        .slice(0, 50);
      const projectPaths = slugs.map((slug) => `/project/${slug}`);
      const projectViewsQuery = projectPaths.length
        ? client.from("page_visits_daily").select("page_path, visits").in("page_path", projectPaths)
        : Promise.resolve({ data: [], error: null });
      const [projects, initiatives, visits, projectViews] = await Promise.all([
        countQuery(client, "projects", (query) => query.eq("published", true)),
        countQuery(client, "initiatives", (query) => query.eq("visibility", "public")),
        client.from("page_visits_daily").select("visits"),
        projectViewsQuery
      ]);
      const error = projects.error || initiatives.error || visits.error || projectViews.error;
      if (error) throw error;

      const totalVisits = (visits.data || []).reduce((sum, row) => sum + Number(row.visits || 0), 0);
      const viewsBySlug = Object.fromEntries(slugs.map((slug) => [slug, 0]));
      (projectViews.data || []).forEach((row) => {
        const slug = String(row.page_path || "").replace(/^\/project\//, "");
        if (Object.hasOwn(viewsBySlug, slug)) viewsBySlug[slug] += Number(row.visits || 0);
      });
      return sendJson(res, 200, {
        status: "available",
        projects: projects.count || 0,
        initiatives: initiatives.count || 0,
        visits: totalVisits,
        project_views: viewsBySlug,
        updated_at: new Date().toISOString()
      }, {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900"
      });
    } catch (error) {
      logEvent("error", "public_metrics_failed", { message: error?.message || String(error) });
      return sendError(res, 503, "metrics_unavailable");
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
