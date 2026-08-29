"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const sharedJs = read("assets/js/unminified-js.js");
const builtJs = read("assets/js/script.js");
const sharedCss = read("assets/css/unminified-css.css");

new vm.Script(sharedJs, { filename: "assets/js/unminified-js.js" });
new vm.Script(builtJs, { filename: "assets/js/script.js" });
new vm.Script(read("assets/js/roadmap.js"), { filename: "assets/js/roadmap.js" });

for (const snippet of [
  "window.NexCoreNotify",
  "window.showToast",
  "success:",
  "error:",
  "warning:",
  "info:",
  "text.textContent = message",
  "aria-live",
  "nexcore-toast-region",
]) {
  assert(sharedJs.includes(snippet), `Shared JS must include ${snippet}`);
}

for (const snippet of [
  "window.NexCoreNotify",
  "window.showToast",
  "nexcore-toast-region",
  "nexcore-toast--",
]) {
  assert(builtJs.includes(snippet), `Built JS must include ${snippet}`);
}

for (const snippet of [
  ".nexcore-toast-region",
  ".nexcore-toast--success",
  ".nexcore-toast--error",
  ".nexcore-toast--warning",
  ".nexcore-toast--info",
  ".nexcore-toast__close",
  "@media screen and (max-width: 600px)",
]) {
  assert(sharedCss.includes(snippet), `Shared CSS must include ${snippet}`);
}

const htmlFiles = fs.readdirSync(root)
  .filter((file) => file.endsWith(".html"))
  .concat(fs.readdirSync(path.join(root, "ar"))
    .filter((file) => file.endsWith(".html"))
    .map((file) => `ar/${file}`));

for (const file of htmlFiles) {
  const html = read(file);
  assert(!html.includes("function showToast"), `${file} must not define a page-local showToast function`);
  assert(!html.includes("window.showToast=function"), `${file} must not overwrite the shared showToast function`);
  assert(!html.includes('id="toast"'), `${file} must not include legacy #toast markup`);
  assert(!html.includes('id="toastContainer"'), `${file} must not include legacy toastContainer markup`);
  assert(!html.includes("#toast{"), `${file} must not include legacy #toast inline styles`);
}

for (const file of ["admin-users.html", "ar/admin-users.html"]) {
  const html = read(file);
  assert(!html.includes("toast.innerHTML"), `${file} must not render toast messages through innerHTML`);
  assert(html.includes("showToast(`") || html.includes("showToast('"), `${file} must retain admin notification calls`);
}

for (const file of ["dashboard.html", "ar/dashboard.html"]) {
  const html = read(file);
  assert(!html.includes("showToast(reason, true);"), `${file} moderation reason toast must not always be an error`);
  assert(html.includes('showToast(reason, tone === "blocked" || tone === "review" ? "error" : "info")'), `${file} must type moderation reason toasts`);
}

const roadmap = read("assets/js/roadmap.js");
assert(roadmap.includes("function notifyRoadmap"), "Roadmap must use a typed notification adapter");
assert(!roadmap.includes("function showToast"), "Roadmap must not define a local showToast");
for (const match of roadmap.matchAll(/notifyRoadmap\(([\s\S]*?)\);/g)) {
  assert(!match[1].includes("<i class="), "Roadmap notifications must not pass raw icon HTML");
}
assert(roadmap.includes('notifyRoadmap(roadmapText("Failed to load features."'), "Roadmap errors must use notifyRoadmap");
assert(roadmap.includes('"success", "check"'), "Roadmap success notifications must preserve check icon intent");
assert(roadmap.includes('"warning", "lock"'), "Roadmap warning notifications must preserve lock icon intent");

assert(read("ar/index.html").includes('<script src="../assets/js/script.js"></script>'), "Arabic homepage must load the built shared script");
assert(!read("ar/index.html").includes("../assets/js/unminified-js.js"), "Arabic homepage must not load the unminified shared script in production markup");

console.log("Sitewide toast notification tests passed.");
