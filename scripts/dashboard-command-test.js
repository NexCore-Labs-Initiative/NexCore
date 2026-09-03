"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const sharedRequiredIds = [
  "commandSaveState",
  "commandProjectName",
  "commandAiRemaining",
  "commandAiFill",
  "commandNextAction",
  "readinessName",
  "readinessSlug",
  "readinessCard",
  "readinessPage",
  "readinessImage",
  "readinessModeration",
  "previewImage",
  "previewTitle",
  "previewDescription",
  "summaryStatus",
  "summaryModeration",
  "commandSaveBtn",
  "commandPublishBtn",
  "commandOpenPublicBtn",
  "saveCardBtn",
  "saveProfileBtn",
  "saveLinksBtn",
  "togglePublishBtn",
  "copyProjectPageLink",
  "deleteBtn"
];

const behaviorHooks = [
  "function updateCommandCenter()",
  "function updateReadiness(",
  "function initDashboardTabs()",
  "dashboard-panel-stage",
  "dashboard-panel.is-entering",
  "dashboard-panel.is-leaving",
  "__nexcoreDashboardPanelTransition",
  "prefers-reduced-motion: reduce",
  "function initDashboardDirtyTracking()",
  "function initCommandActions()",
  "markDashboardDirty();",
  "updateCommandAiQuota(r, max);",
  "captureDashboardSnapshot();"
];

for (const [file, heading, publicPath] of [
  ["dashboard.html", "Project Command Center", "/project.html?slug="],
  ["ar/dashboard.html", "مركز قيادة المشروع", "/ar/project.html?slug="]
]) {
  const html = read(file);

  assert(html.includes(heading), `${file} must expose the command center heading`);
  assert(html.includes('class="command-band"'), `${file} must include the top command band`);
  assert(html.includes('class="readiness-band"'), `${file} must include the readiness checklist`);
  assert(html.includes('class="preview-panel"'), `${file} must include the preview panel`);
  assert(html.includes('class="dashboard-panel-stage"'), `${file} must wrap dashboard panels in a transition stage`);
  assert(html.includes('class="action-dock"'), `${file} must include the action dock`);
  assert(html.includes(publicPath), `${file} must use the locale-specific public path`);

  for (const id of sharedRequiredIds) {
    const matches = html.match(new RegExp(`id="${id}"`, "g")) || [];
    assert.strictEqual(matches.length, 1, `${file} must contain exactly one #${id}`);
  }

  for (const hook of behaviorHooks) {
    assert(html.includes(hook), `${file} must include ${hook}`);
  }

  const tabSwitches = html.match(/function setDashboardTab\(name\) \{[\s\S]*?\n    \}/g) || [];
  assert(tabSwitches.length > 0, `${file} must include a dashboard tab switcher`);
  for (const tabSwitch of tabSwitches) {
    assert(tabSwitch.includes("__nexcoreDashboardPanelTransition"), `${file} tab switching must guard an active transition`);
    assert(tabSwitch.includes("is-entering"), `${file} tab switching must animate the incoming panel`);
    assert(tabSwitch.includes("is-leaving"), `${file} tab switching must animate the outgoing panel`);
  }

  assert(!html.includes('<h1>Dashboard</h1>'), `${file} must remove the old dashboard heading`);
  assert(!html.includes('<h1>لوحة التحكم</h1>'), `${file} must remove the old Arabic dashboard heading`);

  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || /application\/ld\+json/i.test(match[1])) continue;
    new vm.Script(match[2], { filename: `${file}:inline-script` });
  }
}

console.log("Dashboard command center tests passed.");
