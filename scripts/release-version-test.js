"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const readJson = (file) => JSON.parse(read(file));

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const releases = readJson("assets/data/releases.json");
const version = packageJson.version;
const tag = `v${version}`;

assert(/^\d+\.\d+\.\d+$/.test(version), "package.json must use a stable semantic version");
assert.strictEqual(packageLock.version, version, "package-lock.json root version must match package.json");
assert.strictEqual(packageLock.packages?.[""]?.version, version, "package-lock.json package version must match package.json");
assert.strictEqual(releases.releases?.[0]?.version, tag, "latest release data must match package.json");
for (const release of releases.releases || []) {
  const [, major = 0, minor = 0] = release.version.match(/^v(\d+)\.(\d+)\.\d+$/)?.map(Number) || [];
  const hasStructuredTagSections = major > 3 || (major === 3 && minor >= 3);
  if (hasStructuredTagSections && (release.tags || []).includes("feature")) {
    assert(release.user_updates?.features?.length, `${release.version} has a feature tag but no user-facing features`);
  }
  if (hasStructuredTagSections && (release.tags || []).includes("improvement")) {
    assert(release.user_updates?.improvements?.length, `${release.version} has an improvement tag but no user-facing improvements`);
  }
  if (hasStructuredTagSections && (release.tags || []).includes("fix")) {
    assert(release.user_updates?.fixes?.length, `${release.version} has a fix tag but no user-facing fixes`);
  }
  for (const language of ["en", "ar"]) {
    assert(release.title?.[language], `${release.version} must have a ${language} title`);
    assert(release.summary?.[language], `${release.version} must have a ${language} summary`);
    if (release.visitor_announcement?.enabled) {
      assert(release.visitor_announcement.benefit?.[language], `${release.version} announcement must have a ${language} benefit`);
      assert.strictEqual(
        release.visitor_announcement.highlights?.[language]?.length,
        3,
        `${release.version} announcement must have exactly three ${language} highlights`
      );
      assert(
        release.visitor_announcement.highlights[language].every((item) => typeof item === "string" && item.trim()),
        `${release.version} announcement ${language} highlights must be non-empty strings`
      );
    }
    if (release.is_major_release) {
      assert(release.major_details?.[language]?.why_it_matters, `${release.version} major release must explain why it matters in ${language}`);
    }
  }
}

const releasesJs = read("assets/js/releases.js");
assert(releasesJs.includes("const tagMeta = {"), "Release renderer must use explicit tag metadata");
assert(!releasesJs.includes("return `<span class=\"rl-tag fix\""), "Unknown release tags must not render as Fixes");
assert(releasesJs.includes("security: { className: 'sec'"), "Release renderer must label security tags directly");
assert(releasesJs.includes("compliance: { className: 'comp'"), "Release renderer must label compliance tags directly");
assert(releasesJs.includes("admin: { className: 'admin'"), "Release renderer must label admin tags directly");

assert(read("version.js").includes(`const APP_VERSION = '${tag}';`), "version.js must match package.json");
assert(read("service-worker.js").includes(`const CACHE_VERSION = '${tag}';`), "service-worker cache must match package.json");

for (const file of ["CHANGELOG.md", "CHANGELOG.ar.md"]) {
  const firstVersion = read(file).match(/^## v(\d+\.\d+\.\d+)\b/m)?.[1];
  assert.strictEqual(firstVersion, version, `${file} latest release must match package.json`);
}

console.log(`Release version consistency tests passed (${tag}).`);
