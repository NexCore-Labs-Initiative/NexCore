"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

for (const file of ["assets/js/unminified-js.js", "assets/js/script.js"]) {
  const javascript = read(file);
  assert(javascript.includes('a[href^="#"]'), `${file} must retain same-page anchor handling`);
  assert(javascript.includes("getElementById"), `${file} must resolve fragments by HTML id`);
  assert(javascript.includes("scrollHeight"), `${file} must detect the element that actually owns page scrolling`);
  assert(javascript.includes("document.body"), `${file} must support the current body scroll container`);
  assert(javascript.includes("scrollTo"), `${file} must retain smooth scrolling`);
  assert(javascript.includes("history.pushState"), `${file} must keep the URL hash in sync`);
}

const index = read("index.html");
const ids = [...index.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
const idCounts = ids.reduce((counts, id) => {
  counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}, new Map());

for (const match of index.matchAll(/\bhref\s*=\s*["']#([^"']+)["']/gi)) {
  const fragment = match[1];
  assert.strictEqual(idCounts.get(fragment), 1, `index.html#${fragment} must resolve to exactly one id`);
}

const releaseTag = `v${require("../package.json").version}`;
assert(read("service-worker.js").includes(`const CACHE_VERSION = '${releaseTag}';`), "Service worker cache must publish the corrected shared assets");

console.log("Anchor navigation tests passed.");
