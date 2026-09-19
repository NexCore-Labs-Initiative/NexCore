"use strict";

const TYPES = [
  "Study plan",
  "Books",
  "Slides",
  "Notes",
  "Practice papers",
  "Exams",
  "Quizzes",
  "Worked examples",
  "Study guide",
];
const FORMATS = ["pdf", "word", "powerpoint", "excel", "img", "other"];

function driveTarget(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "drive.google.com" ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    let match =
      /^\/file\/d\/([\w-]{5,200})(?:\/(?:view|preview|edit))?\/?$/.exec(
        url.pathname,
      );
    let folder = false;
    if (!match) {
      match = /^\/drive\/(?:u\/\d+\/)?folders\/([\w-]{5,200})\/?$/.exec(
        url.pathname,
      );
      folder = !!match;
    }
    const id =
      match?.[1] ||
      (url.pathname === "/open" || url.pathname === "/uc"
        ? url.searchParams.get("id")
        : null);
    if (!id || !/^[\w-]{5,200}$/.test(id)) return null;
    const canonical = new URL(
      `https://drive.google.com/${folder ? "drive/folders/" + id : "file/d/" + id + "/view"}`,
    );
    const resourceKey = url.searchParams.get("resourcekey");
    if (resourceKey) {
      if (!/^[\w-]{1,200}$/.test(resourceKey)) return null;
      canonical.searchParams.set("resourcekey", resourceKey);
    }
    return { url: canonical.href, key: id };
  } catch {
    return null;
  }
}

function normalizeContent(input = {}) {
  const errors = [];
  function str(value, name, max) {
    if (value == null) return "";
    if (typeof value !== "string" || value.trim().length > max) {
      errors.push(name);
      return "";
    }
    return value.trim();
  }
  function list(value, name) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 30) {
      errors.push(name);
      return [];
    }
    return [...new Set(value.map((v) => str(v, name, 100)).filter(Boolean))];
  }
  const data = {};
  for (const [key, max] of Object.entries({
    title: 200,
    description: 10000,
    semester: 20,
    type: 40,
    format: 20,
    drive_url: 2000,
    credit: 200,
    course_id: 36,
  })) {
    data[key] = str(input[key], key, max);
  }
  if (
    data.course_id &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      data.course_id,
    )
  )
    errors.push("course_id");
  data.topics = list(input.topics, "topics");
  data.languages = list(input.languages, "languages");
  if (data.languages.some((x) => !["ar", "en"].includes(x)))
    errors.push("languages");
  data.credit_permission = input.credit_permission === true;
  data.translations = {};
  for (const locale of ["ar", "en"]) {
    const source = input.translations?.[locale];
    if (source)
      data.translations[locale] = {
        title: str(source.title, "translation_title", 200),
        description: str(source.description, "translation_description", 10000),
        topics: list(source.topics, "translation_topics"),
      };
  }
  if (!data.course_id) {
    const p = input.course_proposal || {};
    data.course_proposal = {
      code: str(p.code, "course_code", 30).toUpperCase(),
      title: str(p.title, "course_title", 200),
      title_ar: str(p.title_ar, "course_title_ar", 200),
      college_id: str(p.college_id, "college_id", 100),
    };
  }
  const drive = driveTarget(data.drive_url);
  data.drive_key = drive?.key || "";
  if (drive) data.drive_url = drive.url;
  // Incomplete drafts are allowed; malformed links cannot be submitted by SQL validation.
  return { data, errors };
}

module.exports = { TYPES, FORMATS, driveTarget, normalizeContent };
