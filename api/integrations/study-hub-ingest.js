"use strict";
const { allowMethods, sendJson } = require("../../lib/api/http");
const { getSupabaseAdmin } = require("../../lib/supabaseAdmin");
const {
  configuration,
  authenticate,
  validatePayload,
} = require("../../lib/study-hub-ingest");
const { mapRow, fault, clean } = require("../../lib/study-hub-intake");
function createHandler(deps = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!allowMethods(req, res, ["POST"])) return;
    try {
      const cfg = configuration(deps.env || process.env);
      const payload = authenticate(
        req,
        cfg,
        deps.now ? deps.now() : Date.now(),
      );
      const columns = validatePayload(payload, cfg);
      if (payload.kind === "check")
        return sendJson(res, 200, { result: "ready", enabled: cfg.enabled });
      if (!cfg.enabled) throw fault("ingest_disabled", 503);
      const db = (deps.getAdminClient || getSupabaseAdmin)();
      const settings = await db.from("study_hub_settings").select("*").single();
      if (settings.error) throw settings.error;
      const code = clean(payload.values[columns.code]).toUpperCase();
      const courses = await db
        .from("study_hub_courses")
        .select("id,code")
        .eq("code", code);
      if (courses.error) throw courses.error;
      const data = mapRow(
        payload.values,
        columns,
        payload.timezone,
        courses.data || [],
        settings.data || {},
      );
      const result = await db.rpc("study_hub_ingest_submission", {
        p_source: cfg.spreadsheet,
        p_sheet: cfg.sheetId,
        p_row: payload.row_number,
        p_data: data,
      });
      if (result.error) throw result.error;
      if (result.data.result === "source_conflict")
        throw fault("source_conflict", 409);
      return sendJson(res, 200, {
        result: result.data.result,
        external_response_id: data.external_response_id,
        needs_completion: data.validation_issues.length > 0,
      });
    } catch (e) {
      // Only our errors have HTTP status. Never return provider bodies, SQL details or student data.
      return sendJson(res, e.status || 503, {
        error: e.status ? e.code : "ingest_database_failure",
        ...(e.fields ? { fields: e.fields } : {}),
      });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
