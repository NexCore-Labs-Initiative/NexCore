"use strict";
const { createHmac, timingSafeEqual } = require("node:crypto");
const { HEADERS, mapHeaders, mapRow, fault } = require("./study-hub-intake");
const MAX_BYTES = 64000;
function configuration(env = process.env) {
  const secret = env.STUDY_HUB_INGEST_SECRET || "";
  const spreadsheet = env.STUDY_HUB_GOOGLE_SPREADSHEET_ID || "";
  const sheet = env.STUDY_HUB_GOOGLE_SHEET_ID;
  if (
    !/^[a-f0-9]{64}$/i.test(secret) ||
    !/^[\w-]{10,100}$/.test(spreadsheet) ||
    !/^\d{1,10}$/.test(sheet || "") ||
    Number(sheet) > 2147483647
  )
    throw fault("ingest_configuration_missing", 503);
  return {
    secret,
    spreadsheet,
    sheetId: Number(sheet),
    enabled: env.STUDY_HUB_INGEST_ENABLED === "true",
  };
}
function sign(
  payload,
  secret,
  timestamp = String(Math.floor(Date.now() / 1000)),
) {
  const message =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    version: 1,
    timestamp,
    payload: message,
    signature: createHmac("sha256", secret)
      .update(`v1\n${timestamp}\n${message}`, "utf8")
      .digest("hex"),
  };
}
function authenticate(req, cfg, now = Date.now()) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(req.headers?.["content-type"] || "")
  )
    throw fault("json_required", 415);
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (
    Buffer.byteLength(
      typeof body === "string" ? body : JSON.stringify(body || {}),
    ) > MAX_BYTES
  )
    throw fault("payload_too_large", 413);
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      throw fault("invalid_json", 400);
    }
  }
  if (
    !body ||
    body.version !== 1 ||
    typeof body.payload !== "string" ||
    typeof body.timestamp !== "string" ||
    !/^\d{10}$/.test(body.timestamp) ||
    typeof body.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.signature) ||
    Math.abs(Math.floor(now / 1000) - Number(body.timestamp)) > 300
  )
    throw fault("ingest_unauthorized", 401);
  const expected = sign(body.payload, cfg.secret, body.timestamp).signature;
  if (
    !timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(body.signature, "hex"),
    )
  )
    throw fault("ingest_unauthorized", 401);
  let payload;
  try {
    payload = JSON.parse(body.payload);
  } catch {
    throw fault("invalid_payload", 422);
  }
  return payload;
}
function validatePayload(p, cfg) {
  if (
    !p ||
    typeof p !== "object" ||
    Array.isArray(p) ||
    Object.keys(p).some(
      (k) =>
        ![
          "kind",
          "spreadsheet_id",
          "sheet_id",
          "row_number",
          "timezone",
          "headers",
          "values",
        ].includes(k),
    ) ||
    !["check", "submission"].includes(p.kind)
  )
    throw fault("invalid_payload", 422);
  if (p.spreadsheet_id !== cfg.spreadsheet || p.sheet_id !== cfg.sheetId)
    throw fault("source_not_allowed", 403);
  if (
    !Array.isArray(p.headers) ||
    p.headers.length > Object.keys(HEADERS).length ||
    p.headers.some((h) => typeof h !== "string" || h.length > 300)
  )
    throw fault("invalid_headers", 422);
  const mapping = mapHeaders(p.headers);
  // Producers must discard unknown values before transmission, not send a raw response.
  if (mapping.ignoredColumns.length) throw fault("unmapped_columns", 422);
  if (p.kind === "check") {
    if (p.values !== undefined) throw fault("invalid_payload", 422);
    return mapping.columns;
  }
  if (
    !Number.isSafeInteger(p.row_number) ||
    p.row_number < 2 ||
    p.row_number > 50000 ||
    !Array.isArray(p.values) ||
    p.values.length !== p.headers.length ||
    p.values.some((v) => !["string", "number"].includes(typeof v)) ||
    typeof p.timezone !== "string" ||
    p.timezone.length > 100
  )
    throw fault("invalid_payload", 422);
  try {
    new Intl.DateTimeFormat("en", { timeZone: p.timezone });
  } catch {
    throw fault("invalid_timezone", 422);
  }
  // Validate every cell before any database operation; incomplete publication metadata is reviewable.
  mapRow(p.values, mapping.columns, p.timezone);
  return mapping.columns;
}
module.exports = {
  configuration,
  authenticate,
  validatePayload,
  sign,
  MAX_BYTES,
};
