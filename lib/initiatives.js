"use strict";

const STATUS_VALUES = new Set(["launched", "active", "in-development", "incubation", "concept"]);
const VISIBILITY_VALUES = new Set(["public", "draft", "private"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const asText = (value) => String(value || "").trim();

function localized(value, field, errors, { required = true } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const result = { en: asText(source.en), ar: asText(source.ar) };
  if (required && (!result.en || !result.ar)) {
    errors.push(`${field} must include English and Arabic values.`);
  }
  return result;
}

function isAllowedUrl(value) {
  const url = asText(value);
  if (!url) return true;
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeImageUrl(value) {
  let url = asText(value);
  if (!url) return "";
  if (url.startsWith("/") || /^https?:\/\//i.test(url)) {
    // Keep valid absolute/site-relative URLs intact before GitHub-specific handling below.
  } else if (/^(?:www\.)?github\.com\//i.test(url) || /^raw\.githubusercontent\.com\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "github.com" || host === "www.github.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const blobIndex = parts.indexOf("blob");
      if (parts.length >= 5 && blobIndex === 2) {
        const [owner, repo, , branch, ...filePath] = parts;
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath.join("/")}`;
      }
    }
  } catch {
    // Non-URL values are validated by isAllowedUrl after normalization.
  }

  return url;
}

function normalizeHighlights(value, errors) {
  if (!Array.isArray(value)) return [];
  return value.reduce((highlights, item, index) => {
    const normalized = localized(item, `highlights[${index}]`, errors);
    if (normalized.en && normalized.ar) highlights.push(normalized);
    return highlights;
  }, []);
}

function normalizeOptionalMedia(value, errors) {
  if (!value || typeof value !== "object" || !asText(value.src)) return null;
  const src = normalizeImageUrl(value.src);
  if (!isAllowedUrl(src)) errors.push("image.src must be a valid HTTP(S) or site-relative URL.");
  return { src, alt: localized(value.alt, "image.alt", errors) };
}

function normalizeOptionalLink(value, errors) {
  if (!value || typeof value !== "object" || !asText(value.url)) return null;
  const url = asText(value.url);
  if (!isAllowedUrl(url)) errors.push("primary_link.url must be a valid HTTP(S) or site-relative URL.");
  return { url, label: localized(value.label, "primary_link.label", errors) };
}

function validateInitiative(payload) {
  const errors = [];
  const source = payload && typeof payload === "object" ? payload : {};
  const slug = asText(source.slug).toLowerCase();
  const status = asText(source.status).toLowerCase();
  const visibility = asText(source.visibility).toLowerCase();
  const categories = [...new Set((Array.isArray(source.categories) ? source.categories : [])
    .map((category) => asText(category).toLowerCase())
    .filter(Boolean))];

  if (!SLUG_PATTERN.test(slug)) errors.push("slug must use lowercase letters, numbers, and single hyphens.");
  if (!STATUS_VALUES.has(status)) errors.push("status is invalid.");
  if (!VISIBILITY_VALUES.has(visibility)) errors.push("visibility is invalid.");
  if (!categories.length) errors.push("Select at least one category.");

  const sortOrder = Number(source.sort_order);
  if (!Number.isInteger(sortOrder)) errors.push("sort_order must be a whole number.");

  const launchedAt = asText(source.launched_at);
  if (launchedAt && Number.isNaN(Date.parse(launchedAt))) errors.push("launched_at must be a valid date.");

  const data = {
    slug,
    status,
    categories,
    featured: source.featured === true,
    sort_order: Number.isInteger(sortOrder) ? sortOrder : 0,
    visibility,
    title: localized(source.title, "title", errors),
    mission: localized(source.mission, "mission", errors),
    summary: localized(source.summary, "summary", errors),
    overview: localized(source.overview, "overview", errors),
    highlights: normalizeHighlights(source.highlights, errors),
    image: normalizeOptionalMedia(source.image, errors),
    primary_link: normalizeOptionalLink(source.primary_link, errors),
    launched_at: launchedAt || null
  };

  return { errors, data };
}

module.exports = {
  STATUS_VALUES,
  VISIBILITY_VALUES,
  normalizeImageUrl,
  validateInitiative
};
