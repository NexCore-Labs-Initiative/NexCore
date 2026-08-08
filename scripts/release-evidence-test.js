"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const releases = JSON.parse(fs.readFileSync(path.join(root, "assets", "data", "releases.json"), "utf8"));

function collectEvidence(value, output = []) {
  if (Array.isArray(value)) value.forEach((item) => collectEvidence(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectEvidence(item, output));
  else if (typeof value === "string" && value.startsWith("file:")) output.push(value.slice(5));
  return output;
}

for (const release of releases.releases) {
  const missing = [...new Set(collectEvidence(release))].filter((file) => !fs.existsSync(path.join(root, file)));
  assert.deepEqual(missing, [], `${release.version} references missing evidence: ${missing.join(", ")}`);
}

console.log(`Release evidence validated for ${releases.releases.length} releases.`);
