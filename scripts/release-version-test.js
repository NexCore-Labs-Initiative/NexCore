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
assert(read("version.js").includes(`const APP_VERSION = '${tag}';`), "version.js must match package.json");
assert(read("service-worker.js").includes(`const CACHE_VERSION = '${tag}';`), "service-worker cache must match package.json");

for (const file of ["CHANGELOG.md", "CHANGELOG.ar.md"]) {
  const firstVersion = read(file).match(/^## v(\d+\.\d+\.\d+)\b/m)?.[1];
  assert.strictEqual(firstVersion, version, `${file} latest release must match package.json`);
}

console.log(`Release version consistency tests passed (${tag}).`);
