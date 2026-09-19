"use strict";
const { createHash } = require("node:crypto");
const { normalizeContent, TYPES, FORMATS } = require("./study-hub");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADERS = {
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
const OPTIONAL = new Set(["note", "format", "languages"]);
const clean = (v) =>
  String(v ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
function fault(code, status = 422, details = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}
function mapHeaders(headers) {
  const columns = {},
    unknown = [];
  const labels = headers.map(clean);
  for (const [field, aliases] of Object.entries(HEADERS)) {
    const found = labels.flatMap((v, i) =>
      aliases.map(clean).includes(v) ? [i] : [],
    );
    if (found.length > 1)
      throw fault("ambiguous_columns", 422, { fields: [field] });
    if (!found.length && !OPTIONAL.has(field))
      throw fault("missing_columns", 422, { fields: [field] });
    if (found.length) columns[field] = found[0];
  }
  labels.forEach((v, i) => {
    if (v && !Object.values(columns).includes(i)) unknown.push(i + 1);
  });
  return { columns, ignoredColumns: unknown };
}
// Sheets serials represent local wall time. Never parse locale-dependent date strings.
function sheetTime(serial, zone) {
  if (
    typeof serial !== "number" ||
    !Number.isFinite(serial) ||
    serial < 1 ||
    serial > 100000
  )
    throw fault("invalid_timestamp");
  const wall = Math.round((serial - 25569) * 86400000);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let utc = wall;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      fmt.formatToParts(new Date(utc)).map((x) => [x.type, x.value]),
    );
    const represented = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    utc += wall - represented;
  }
  return new Date(utc).toISOString();
}
function mapRow(row, columns, zone, courses = [], settings = {}) {
  const value = (k, max = 10000) => {
    const v = row[columns[k]] ?? "";
    if (typeof v !== "string" || v.length > max)
      throw fault("invalid_cell", 422, { fields: [k] });
    return v.trim();
  };
  const id = value("id", 36).toLowerCase();
  if (!UUID.test(id)) throw fault("invalid_response_id");
  const name = value("name", 200),
    consent = clean(value("consent", 100)) === "Yes";
  const type = value("type", 100),
    code = clean(value("code", 30)).toUpperCase();
  const course = courses.find((c) => c.code.toUpperCase() === code);
  const language = value("languages", 100);
  const languageMap = {
    Arabic: "ar",
    English: "en",
    العربية: "ar",
    الإنجليزية: "en",
    ar: "ar",
    en: "en",
  };
  const languages = language
    ? language.split(/[,،/]/).map((v) => languageMap[clean(v)] || clean(v))
    : [];
  const formatMap = {
    PDF: "pdf",
    Word: "word",
    PowerPoint: "powerpoint",
    Excel: "excel",
    Image: "img",
    "Image | صورة": "img",
    Other: "other",
    "Other | أخرى": "other",
  };
  const format = value("format", 50);
  const proposed = {
    title: value("title", 200),
    description: value("description"),
    semester: clean(value("semester", 20)),
    type:
      { Book: "Books", "Practice material": "Practice papers" }[type] || type,
    topics: value("topics", 3000).split(/[,،]/).map(clean).filter(Boolean),
    drive_url: value("url", 2000),
    format: formatMap[format] || format,
    languages,
    credit: consent ? name : "",
    credit_permission: consent,
    course_id: course?.id || "",
    course_proposal: { code, title: value("course", 200), college_id: "" },
  };
  const normalized = normalizeContent(proposed);
  // Invalid vocabulary is reviewable, not grounds to silently guess a value.
  const issues = [...normalized.errors];
  for (const k of [
    "title",
    "description",
    "semester",
    "type",
    "format",
    "drive_key",
  ])
    if (!normalized.data[k]) issues.push(k);
  if (!(settings.resource_types || TYPES).includes(normalized.data.type))
    issues.push("type");
  if (!(settings.formats || FORMATS).includes(normalized.data.format))
    issues.push("format");
  if (
    settings.semesters &&
    !settings.semesters.includes(normalized.data.semester)
  )
    issues.push("semester");
  if (!normalized.data.topics.length) issues.push("topics");
  if (!normalized.data.languages.length) issues.push("languages");
  if (!course) issues.push("course");
  const accepted =
    value("terms", 200) === "I have read and agree to the Contribution Terms.";
  if (!accepted) issues.push("terms");
  const record = {
    external_response_id: id,
    submitted_at: sheetTime(row[columns.timestamp], zone),
    submitter_name: name,
    submitter_note: value("note", 2000),
    credit_consent: consent,
    terms_accepted: accepted,
    source_content: normalized.data,
    validation_issues: [...new Set(issues)],
  };
  // Hash source values only: reference course/settings changes must not look like student edits.
  const source = Object.keys(columns)
    .filter((k) => k !== "id")
    .map((k) => [k, row[columns[k]] ?? ""]);
  record.source_hash = createHash("sha256")
    .update(JSON.stringify(source))
    .digest("hex");
  return record;
}
module.exports = { HEADERS, UUID, clean, fault, mapHeaders, mapRow, sheetTime };
