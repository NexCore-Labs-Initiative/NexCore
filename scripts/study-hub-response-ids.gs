/** Standalone immutable V1 intake. Configure Script Properties; see management docs.
 * No credentials belong in this source. Keep the Sheet Restricted and trust all script editors.
 */
const STUDY_HUB_HEADERS = {
  id: ["NexCore Submission ID"],
  timestamp: ["Timestamp"],
  name: ["Your Name"],
  code: ["Course code", "Course code | رمز المقرر"],
  course: ["Course title", "Course title | اسم المقرر"],
  semester: ["Semester", "Semester | الفصل الدراسي"],
  title: ["Resource title", "Resource title | عنوان المورد"],
  type: ["Resource type", "Resource type | نوع المورد"],
  topics: ["Main topics", "Main topics | الموضوعات الرئيسية"],
  url: ["Google Drive link", "Google Drive link | رابط Google Drive"],
  description: ["Description", "Description | الوصف"],
  consent: [
    "Want your name to appear for others once your file got included in NexCore Study Hub website?",
  ],
  terms: ["Contribution Terms"],
  note: ["Notes for reviewers", "Notes for reviewers | ملاحظات للمراجعين"],
  format: ["Resource format", "Resource format | صيغة المورد"],
  languages: ["Resource language", "Resource language | لغة المورد"],
};
const STUDY_HUB_ID_HEADER = "NexCore Submission ID";
const STUDY_HUB_STATUS_HEADER = "NexCore Delivery Status";
const STUDY_HUB_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function studyHubFail_(code) {
  throw Object.assign(new Error(code), { code: code });
}
function studyHubClean_(v) {
  return String(v).normalize("NFKC").replace(/\s+/g, " ").trim();
}
function studyHubConfig_() {
  const p = PropertiesService.getScriptProperties();
  const cfg = {
    url: p.getProperty("STUDY_HUB_INGEST_URL"),
    secret: p.getProperty("STUDY_HUB_INGEST_SECRET"),
    spreadsheet: p.getProperty("STUDY_HUB_GOOGLE_SPREADSHEET_ID"),
    sheetId: p.getProperty("STUDY_HUB_GOOGLE_SHEET_ID"),
    vercelBypass: p.getProperty("STUDY_HUB_VERCEL_BYPASS_SECRET") || "",
    vercelBypassHost: p.getProperty("STUDY_HUB_VERCEL_BYPASS_HOST") || "",
  };
  // Exact HTTPS endpoint; no redirects, credentials, fragments or query parameters.
  if (
    !/^https:\/\/[a-z0-9.-]+\/api\/integrations\/study-hub-ingest$/.test(
      cfg.url || "",
    ) ||
    !/^[a-f0-9]{64}$/i.test(cfg.secret || "") ||
    !/^[\w-]{10,100}$/.test(cfg.spreadsheet || "") ||
    !/^\d{1,10}$/.test(cfg.sheetId || "") ||
    Number(cfg.sheetId) > 2147483647
  )
    studyHubFail_("script_configuration_missing");
  // An optional transport credential, independent of the ingestion HMAC secret.
  // Bind it to the operator-approved host; never send it through redirects or URLs.
  if (cfg.vercelBypass || cfg.vercelBypassHost) {
    if (
      !/^[A-Za-z0-9_-]{32,256}$/.test(cfg.vercelBypass) ||
      cfg.vercelBypass.toLowerCase() === cfg.secret.toLowerCase() ||
      !/^[a-z0-9.-]+$/.test(cfg.vercelBypassHost) ||
      cfg.url !==
        "https://" + cfg.vercelBypassHost + "/api/integrations/study-hub-ingest"
    )
      studyHubFail_("vercel_bypass_configuration_invalid");
  }
  cfg.sheetId = Number(cfg.sheetId);
  return cfg;
}
function studyHubSheet_(cfg) {
  const book = SpreadsheetApp.openById(cfg.spreadsheet);
  if (book.getId() !== cfg.spreadsheet) studyHubFail_("wrong_spreadsheet");
  const sheet = book.getSheets().find((s) => s.getSheetId() === cfg.sheetId);
  if (!sheet) studyHubFail_("response_tab_missing");
  if (sheet.getLastColumn() > 100 || sheet.getLastRow() > 50000)
    studyHubFail_("sheet_too_large");
  return sheet;
}
function withStudyHubLock_(fn) {
  // Standalone projects have no document lock. All deliveries must use this one project.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const value = fn();
    SpreadsheetApp.flush();
    return value;
  } finally {
    lock.releaseLock();
  }
}
function studyHubColumn_(sheet, name) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const matches = headers.flatMap((h, i) =>
    studyHubClean_(h) === name ? [i + 1] : [],
  );
  if (matches.length > 1) studyHubFail_("ambiguous_columns");
  if (matches.length) return matches[0];
  const column = sheet.getLastColumn() + 1;
  if (column > sheet.getMaxColumns())
    sheet.insertColumnAfter(sheet.getMaxColumns());
  sheet.getRange(1, column).setValue(name);
  return column;
}
function studyHubMapping_(headers) {
  const columns = {};
  Object.keys(STUDY_HUB_HEADERS).forEach((k) => {
    const aliases = STUDY_HUB_HEADERS[k].map(studyHubClean_);
    const matches = headers.flatMap((h, i) =>
      aliases.includes(studyHubClean_(h)) ? [i] : [],
    );
    if (matches.length > 1) studyHubFail_("ambiguous_columns");
    if (!matches.length && !["note", "format", "languages"].includes(k))
      studyHubFail_("missing_columns");
    if (matches.length) columns[k] = matches[0];
  });
  return columns;
}
function studyHubRows_(sheet) {
  const rows = sheet
    .getRange(1, 1, Math.max(1, sheet.getLastRow()), sheet.getLastColumn())
    .getValues();
  const columns = studyHubMapping_(rows[0]);
  const seen = new Set();
  rows.slice(1).forEach((row) => {
    const id = String(row[columns.id] || "").toLowerCase();
    if (id && !STUDY_HUB_UUID.test(id)) studyHubFail_("invalid_response_id");
    if (id && seen.has(id)) studyHubFail_("duplicate_response_id");
    if (id) seen.add(id);
  });
  return { rows: rows, columns: columns };
}
function studyHubGuard_(fn) {
  try {
    const result = fn();
    PropertiesService.getScriptProperties().setProperty(
      "STUDY_HUB_LAST_RESULT",
      JSON.stringify(result),
    );
    console.log(JSON.stringify(result)); // Counts / fixed status codes only.
    return result;
  } catch (e) {
    const code = e.code || "script_execution_failed";
    PropertiesService.getScriptProperties().setProperty(
      "STUDY_HUB_LAST_RESULT",
      code,
    );
    throw new Error(code); // Do not log Google exception bodies or submitted values.
  }
}
function setupStudyHubIntake() {
  return studyHubGuard_(() =>
    withStudyHubLock_(() => {
      // A failed recheck must not leave a previous setup approval active.
      PropertiesService.getScriptProperties().deleteProperty(
        "STUDY_HUB_SETUP_VERIFIED",
      );
      const cfg = studyHubConfig_(),
        sheet = studyHubSheet_(cfg);
      const formUrl = sheet.getParent().getFormUrl();
      if (!formUrl) studyHubFail_("linked_form_missing");
      // Authoritative read-only setting check; never change the Form configuration.
      if (FormApp.openByUrl(formUrl).getAllowResponseEdits())
        studyHubFail_("editable_responses_require_review");
      studyHubColumn_(sheet, STUDY_HUB_ID_HEADER);
      studyHubColumn_(sheet, STUDY_HUB_STATUS_HEADER);
      studyHubRows_(sheet);
      studyHubInstallTriggers_(cfg);
      PropertiesService.getScriptProperties().setProperty(
        "STUDY_HUB_SETUP_VERIFIED",
        cfg.spreadsheet + ":" + cfg.sheetId,
      );
      return { result: "setup_verified", response_edits_allowed: false };
    }),
  );
}
function studyHubInstallTriggers_(cfg) {
  let submit = false,
    retry = false;
  // Google returns only this project's triggers owned by the current user.
  // Preserve unrelated triggers; remove duplicates/stale targets of our own handlers.
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    const handler = trigger.getHandlerFunction();
    if (handler === "onStudyHubFormSubmit") {
      if (
        !submit &&
        trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT &&
        trigger.getTriggerSourceId() === cfg.spreadsheet
      )
        submit = true;
      else ScriptApp.deleteTrigger(trigger);
    } else if (handler === "retryStudyHubAutomatically") {
      if (!retry && trigger.getEventType() === ScriptApp.EventType.CLOCK)
        retry = true;
      else ScriptApp.deleteTrigger(trigger);
    } else if (handler === "stampStudyHubId") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  if (!submit)
    ScriptApp.newTrigger("onStudyHubFormSubmit")
      .forSpreadsheet(cfg.spreadsheet)
      .onFormSubmit()
      .create();
  if (!retry)
    ScriptApp.newTrigger("retryStudyHubAutomatically")
      .timeBased()
      .everyMinutes(5)
      .create();
}
function studyHubReady_(cfg) {
  if (
    PropertiesService.getScriptProperties().getProperty(
      "STUDY_HUB_SETUP_VERIFIED",
    ) !==
    cfg.spreadsheet + ":" + cfg.sheetId
  )
    studyHubFail_("run_setup_first");
}
function studyHubSend_(cfg, payload) {
  const body = JSON.stringify(payload),
    timestamp = String(Math.floor(Date.now() / 1000));
  const bytes = Utilities.computeHmacSha256Signature(
    "v1\n" + timestamp + "\n" + body,
    cfg.secret,
    Utilities.Charset.UTF_8,
  );
  const signature = bytes
    .map((b) => ("0" + ((b + 256) % 256).toString(16)).slice(-2))
    .join("");
  const envelope = JSON.stringify({
    version: 1,
    timestamp: timestamp,
    payload: body,
    signature: signature,
  });
  if (Utilities.newBlob(envelope).getBytes().length > 64000)
    return { error: "payload_too_large", retry: false };
  let response;
  try {
    response = UrlFetchApp.fetch(cfg.url, {
      method: "post",
      contentType: "application/json",
      headers: cfg.vercelBypass
        ? { "x-vercel-protection-bypass": cfg.vercelBypass }
        : {},
      payload: envelope,
      followRedirects: false,
      muteHttpExceptions: true,
    });
  } catch (_) {
    return { error: "network_failure", retry: true };
  }
  const status = response.getResponseCode();
  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (_) {
    data = {};
  }
  if (status === 200 && payload.kind === "check" && data.result === "ready")
    return data;
  if (
    status === 200 &&
    ["imported", "already_synced"].includes(data.result) &&
    data.external_response_id === payload.values[0]
  )
    return data;
  const allowed = [
    "source_conflict",
    "ingest_unauthorized",
    "ingest_disabled",
    "ingest_configuration_missing",
    "ingest_database_failure",
    "source_not_allowed",
    "missing_columns",
    "ambiguous_columns",
    "invalid_payload",
    "invalid_cell",
    "invalid_timestamp",
    "invalid_response_id",
    "invalid_headers",
    "unmapped_columns",
    "invalid_timezone",
    "payload_too_large",
    "invalid_json",
    "json_required",
  ];
  return {
    error: allowed.includes(data.error) ? data.error : "http_" + status,
    retry: status === 429 || status >= 500 || status === 200,
  };
}
function testStudyHubConnection() {
  return studyHubGuard_(() => {
    const cfg = studyHubConfig_();
    // Preflight must work before setup installs delivery/retry triggers. Read
    // only the header row; never inspect responses, stamp IDs or approve setup.
    const sheet = studyHubSheet_(cfg);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    // Setup creates this operational column later. Include its contract name
    // in the check without modifying a Sheet that has not been initialized.
    if (!headers.some((h) => studyHubClean_(h) === STUDY_HUB_ID_HEADER))
      headers.push(STUDY_HUB_ID_HEADER);
    const columns = studyHubMapping_(headers);
    return studyHubSend_(cfg, {
      kind: "check",
      spreadsheet_id: cfg.spreadsheet,
      sheet_id: cfg.sheetId,
      headers: Object.keys(columns).map((k) => headers[columns[k]]),
    });
  });
}
function repairStudyHubIds() {
  return studyHubGuard_(() => {
    const cfg = studyHubConfig_();
    studyHubReady_(cfg);
    return withStudyHubLock_(() => {
      const sheet = studyHubSheet_(cfg),
        snapshot = studyHubRows_(sheet);
      let stamped = 0;
      snapshot.rows.slice(1).forEach((row, i) => {
        if (
          row[snapshot.columns.timestamp] !== "" &&
          !row[snapshot.columns.id]
        ) {
          sheet
            .getRange(i + 2, snapshot.columns.id + 1)
            .setValue(Utilities.getUuid());
          stamped++;
        }
      });
      return { stamped: stamped };
    });
  });
}
function studyHubDeliverRow_(cfg, rowNumber) {
  const prepared = withStudyHubLock_(() => {
    const sheet = studyHubSheet_(cfg),
      snapshot = studyHubRows_(sheet);
    const row = snapshot.rows[rowNumber - 1];
    if (!row || rowNumber < 2 || row[snapshot.columns.timestamp] === "")
      return null;
    const statusColumn = studyHubColumn_(sheet, STUDY_HUB_STATUS_HEADER);
    if (sheet.getRange(rowNumber, statusColumn).getValue() === "delivered")
      return null;
    if (!row[snapshot.columns.id]) {
      row[snapshot.columns.id] = Utilities.getUuid();
      sheet
        .getRange(rowNumber, snapshot.columns.id + 1)
        .setValue(row[snapshot.columns.id]);
    }
    const keys = Object.keys(snapshot.columns),
      zone = sheet.getParent().getSpreadsheetTimeZone();
    const values = keys.map((k) => {
      const value = row[snapshot.columns[k]];
      if (k !== "timestamp")
        return value === ""
          ? ""
          : typeof value === "string"
            ? value
            : String(value);
      if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
        studyHubFail_("invalid_timestamp");
      const parts = Utilities.formatDate(value, zone, "yyyy,MM,dd,HH,mm,ss,SSS")
        .split(",")
        .map(Number);
      return (
        Date.UTC(
          parts[0],
          parts[1] - 1,
          parts[2],
          parts[3],
          parts[4],
          parts[5],
          parts[6],
        ) /
          86400000 +
        25569
      );
    });
    values[0] = String(values[0]).toLowerCase();
    return {
      kind: "submission",
      spreadsheet_id: cfg.spreadsheet,
      sheet_id: cfg.sheetId,
      row_number: rowNumber,
      timezone: zone,
      headers: keys.map((k) => snapshot.rows[0][snapshot.columns[k]]),
      values: values,
    };
  });
  if (!prepared) return "skipped";
  const result = studyHubSend_(cfg, prepared);
  withStudyHubLock_(() => {
    const sheet = studyHubSheet_(cfg),
      snapshot = studyHubRows_(sheet);
    // Find the permanent ID again: network calls happen outside the lock and rows may move.
    const index = snapshot.rows.findIndex(
      (row, i) =>
        i > 0 &&
        String(row[snapshot.columns.id]).toLowerCase() === prepared.values[0],
    );
    if (index < 1) studyHubFail_("response_row_missing");
    const cell = sheet.getRange(
      index + 1,
      studyHubColumn_(sheet, STUDY_HUB_STATUS_HEADER),
    );
    // A concurrent successful acknowledgment wins over a delayed failed attempt.
    if (cell.getValue() !== "delivered")
      cell.setValue(
        result.error
          ? (result.retry ? "retry: " : "error: ") + result.error
          : "delivered",
      );
  });
  return result.error ? "failed" : result.result;
}
function onStudyHubFormSubmit(event) {
  return studyHubGuard_(() => {
    const cfg = studyHubConfig_();
    studyHubReady_(cfg);
    if (!event || !event.range) studyHubFail_("use_form_submit_trigger");
    if (event.range.getSheet().getParent().getId() !== cfg.spreadsheet)
      return { result: "ignored_spreadsheet" };
    if (event.range.getSheet().getSheetId() !== cfg.sheetId)
      return { result: "ignored_tab" };
    return { result: studyHubDeliverRow_(cfg, event.range.getRow()) };
  });
}
function studyHubPending_(includeErrors) {
  const cfg = studyHubConfig_();
  studyHubReady_(cfg);
  const sheet = studyHubSheet_(cfg),
    snapshot = studyHubRows_(sheet);
  const statusColumn = studyHubColumn_(sheet, STUDY_HUB_STATUS_HEADER);
  const summary = {
    imported: 0,
    already_synced: 0,
    skipped: 0,
    failed: 0,
    remaining: 0,
  };
  const deadline = Date.now() + 45000;
  let attempts = 0;
  // Round-robin cursor prevents persistent failures from starving later pending rows.
  const props = PropertiesService.getScriptProperties();
  const start = Math.max(
    2,
    Number(props.getProperty("STUDY_HUB_RETRY_CURSOR")) || 2,
  );
  const order = snapshot.rows.map((_, i) => i + 1).filter((n) => n >= 2);
  order.sort((a, b) => (a < start) - (b < start) || a - b);
  order.forEach((n) => {
    const row = snapshot.rows[n - 1],
      status = String(row[statusColumn - 1] || "");
    if (
      row[snapshot.columns.timestamp] === "" ||
      status === "delivered" ||
      (!includeErrors && status.startsWith("error:"))
    )
      return;
    if (attempts >= 25 || Date.now() >= deadline) {
      summary.remaining++;
      return;
    }
    attempts++;
    try {
      summary[studyHubDeliverRow_(cfg, n)]++;
    } catch (e) {
      summary.failed++;
      // Metadata failures are visible; do not copy the source value into a status cell.
      sheet
        .getRange(n, statusColumn)
        .setValue("error: " + (e.code || "script_execution_failed"));
    }
    props.setProperty("STUDY_HUB_RETRY_CURSOR", String(n + 1));
  });
  return summary;
}
function retryPendingStudyHub() {
  return studyHubGuard_(() => studyHubPending_(true));
}
function retryStudyHubAutomatically() {
  return studyHubGuard_(() => studyHubPending_(false));
}
function backfillStudyHubResponses() {
  repairStudyHubIds();
  return retryPendingStudyHub();
}
