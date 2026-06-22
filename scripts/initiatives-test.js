"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const initiatives = JSON.parse(fs.readFileSync(path.join(root, "assets/data/initiatives.json"), "utf8"));
const allowed = {
  type: new Set(["platform", "program", "campaign", "event"]),
  status: new Set(["active", "beta", "upcoming", "completed", "archived"]),
  category: new Set(["academic-learning", "campus-services", "research-innovation", "community", "student-life", "digital-infrastructure"]),
};

assert.strictEqual(initiatives.schemaVersion, 1, "initiative data must declare schemaVersion 1");
assert(Array.isArray(initiatives.initiatives) && initiatives.initiatives.length > 0, "initiative data must contain initiatives");

const slugs = new Set();
for (const initiative of initiatives.initiatives) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(initiative.slug), `${initiative.id} must have a stable slug`);
  assert(!slugs.has(initiative.slug), `${initiative.slug} must be unique`);
  slugs.add(initiative.slug);
  ["type", "status", "category"].forEach((field) => assert(allowed[field].has(initiative[field]), `${initiative.slug} has invalid ${field}`));
  assert(Number.isInteger(initiative.launchYear), `${initiative.slug} must have an integer launch year`);
  assert(/^https:\/\//.test(initiative.links?.primary || ""), `${initiative.slug} must have an HTTPS primary link`);
  ["en", "ar"].forEach((locale) => {
    const content = initiative[locale] || {};
    ["name", "summary", "description", "teamLabel", "primaryCta"].forEach((field) => assert(content[field], `${initiative.slug} is missing ${locale}.${field}`));
  });
}

const studyHub = initiatives.initiatives.find((initiative) => initiative.slug === "study-hub");
assert(studyHub && studyHub.featured && studyHub.status === "active", "Study Hub must be the featured active initiative");
assert.strictEqual(studyHub.type, "platform", "Study Hub must be a platform");
assert.strictEqual(studyHub.category, "academic-learning", "Study Hub must be academic learning");

for (const file of [
  "initiatives.html",
  "ar/initiatives.html",
  "initiative.html",
  "ar/initiative.html",
  "initiatives/study-hub/index.html",
  "ar/initiatives/study-hub/index.html",
]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert(html.includes('class="dropdown"'), `${file} must use the shared site navigation`);
  assert(html.includes("footer-inner"), `${file} must use the shared site footer`);
  assert(html.includes("nexcore-sign"), `${file} must use the shared NexCore signature`);
  assert(!html.includes("initiative-detail-nav"), `${file} must not use a custom initiative navigation shell`);
}

assert(
  !fs.readFileSync(path.join(root, "assets/css/initiatives.css"), "utf8").includes("initiative-detail-nav"),
  "initiative stylesheet must not own navigation styles"
);

console.log("Initiative data tests passed.");
