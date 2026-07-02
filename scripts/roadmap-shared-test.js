"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const controller = read("assets/js/roadmap.js");

new vm.Script(controller, { filename: "assets/js/roadmap.js" });

for (const [file, scriptSource, styleSource] of [
  ["roadmap.html", "assets/js/roadmap.js", "assets/css/roadmap.css"],
  ["ar/roadmap.html", "../assets/js/roadmap.js", "../assets/css/roadmap.css"],
]) {
  const html = read(file);
  assert(html.includes(`<script src="${scriptSource}"></script>`), `${file} must load the shared roadmap controller`);
  assert(html.includes(`<link rel="stylesheet" href="${styleSource}">`), `${file} must load the shared roadmap stylesheet`);
  assert(!html.includes("function getAnonFingerprint"), `${file} must not retain a duplicated inline roadmap controller`);
  assert(!/<style>[\s\S]*?<\/style>/i.test(html), `${file} must not retain duplicated embedded roadmap styles`);
  assert.strictEqual((html.match(/roadmap\.js/g) || []).length, 1, `${file} must load the shared controller once`);
  assert.strictEqual((html.match(/roadmap\.css/g) || []).length, 1, `${file} must load the shared stylesheet once`);
}

assert(controller.includes('document.documentElement.lang.toLowerCase().startsWith("ar")'), "Controller must derive its locale from the page language");
assert(controller.includes("roadmapText"), "Controller must centralize localized runtime text");
assert(controller.includes("Suggest a feature") && controller.includes("اقترح ميزة"), "Controller must retain bilingual suggestion labels");
assert(controller.includes("/dashboard.html") && controller.includes("/ar/dashboard.html"), "Controller must retain localized OAuth redirects");

for (const behavior of [
  "loadFeatures",
  "buildCard",
  "handleVote",
  "updateFeatureStatus",
  "submitFeature",
  "submitComment",
  "deleteOwnComment",
  "bindConfirmModal",
]) {
  assert(controller.includes(`function ${behavior}`) || controller.includes(`async function ${behavior}`), `Controller must retain ${behavior}`);
}

assert(read("service-worker.js").includes("'/assets/js/roadmap.js'"), "Shared roadmap controller must be precached");

const styles = read("assets/css/roadmap.css");
for (const selector of [".roadmap-wrap", ".feature-card", ".modal-panel", ".fab"]) {
  assert(styles.includes(selector), `Shared roadmap stylesheet must retain ${selector}`);
}
assert(read("service-worker.js").includes("'/assets/css/roadmap.css'"), "Shared roadmap stylesheet must be precached");

console.log("Shared bilingual roadmap assets tests passed.");
