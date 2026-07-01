"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pagePairs = [
  ["initiatives.html", "ar/initiatives.html"],
  ["project.html", "ar/project.html"],
  ["roadmap.html", "ar/roadmap.html"],
  ["admin-users.html", "ar/admin-users.html"]
];

for (const [englishFile, arabicFile] of pagePairs) {
  for (const file of [englishFile, arabicFile]) {
    const html = read(file);
    const prefix = file.startsWith("ar/") ? "../" : "";
    assert(html.includes(`src="${prefix}assets/js/count-up.js"`), `${file} must load the shared count-up animation`);

    for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(match[1]) || /application\/ld\+json/i.test(match[1])) continue;
      new vm.Script(match[2], { filename: `${file}:inline-script` });
    }
  }
}

const initiativesScript = read("assets/js/initiatives.js");
assert(initiativesScript.includes("window.CountUp.animate(count"), "Initiative summary counters must animate");

for (const file of ["project.html", "ar/project.html"]) {
  assert(read(file).includes("window.CountUp.animate(document.getElementById('viewCount')"), `${file} view counter must animate`);
}

for (const file of ["roadmap.html", "ar/roadmap.html"]) {
  const html = read(file);
  for (const id of ["stat-total", "stat-votes", "stat-done", "count-planned", "count-inprog", "count-done"]) {
    assert(html.includes(`animateStat('#${id}'`), `${file} must animate ${id}`);
  }
}

for (const file of ["admin-users.html", "ar/admin-users.html"]) {
  const html = read(file);
  for (const id of ["statApprovedUsers", "statAdmins", "statTotal", "statPendingOrders"]) {
    assert(html.includes(`animateAdminStat('${id}'`), `${file} must animate ${id}`);
  }
}

assert(read("service-worker.js").includes("'/assets/js/count-up.js'"), "The shared animation must remain precached");
console.log("Cross-page counter coverage tests passed.");
