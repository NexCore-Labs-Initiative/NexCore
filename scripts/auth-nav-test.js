"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const authUi = read("assets/js/auth-ui-db.js");

const userStart = authUi.indexOf('<div id="navUser"');
const userEnd = authUi.indexOf("</div>", authUi.indexOf("</span>", userStart)) + 6;
const userMarkup = authUi.slice(userStart, userEnd);

assert(userStart >= 0, "navUser toolbar markup must exist");
assert(userMarkup.includes('class="nav-user-toolbar"'), "navUser must use the compact toolbar");
assert(userMarkup.includes('class="nav-user-identity"'), "navUser must retain the avatar and name");
assert(userMarkup.includes('class="nav-user-actions"'), "navUser must contain the action group");
assert(userMarkup.includes('role="group"'), "Compact actions must expose an accessible group");

for (const id of ["navDashboard", "navAdmin", "navAccount", "navLogout"]) {
  assert(userMarkup.includes(`id="${id}"`), `${id} must be inside navUser`);
}

assert(
  userMarkup.includes('<button type="button" id="navLogout"'),
  "Logout must be a semantic button"
);
assert(
  userMarkup.includes('aria-label="${copy.dashboardTitle}"') &&
    userMarkup.includes('aria-label="${copy.adminTitle}"') &&
    userMarkup.includes('aria-label="${copy.accountTitle}"') &&
    userMarkup.includes('aria-label="${copy.logoutTitle}"'),
  "Every compact action must have a localized accessible label"
);
assert(
  authUi.includes("navAdmin.style.display = userIsAdmin ? 'inline-flex' : 'none'"),
  "Admin shortcut must remain role-gated"
);
assert(
  authUi.includes("window.location.href = `${routePrefix}/auth.html`"),
  "Logout must redirect to the locale-aware auth page"
);
assert(
  authUi.includes("fa-wand-magic-sparkles") && !authUi.includes("fa-sparkles"),
  "Injected Initiatives navigation must use a Font Awesome Free icon"
);

for (const file of ["assets/css/unminified-css.css", "assets/css/style.css"]) {
  const css = read(file);
  assert(css.includes(".nav-user-toolbar"), `${file} must style the compact toolbar`);
  assert(css.includes(".nav-user-action"), `${file} must style compact actions`);
  assert(/width:\s*36px/.test(css), `${file} must provide desktop touch targets`);
  assert(/width:\s*34px/.test(css), `${file} must provide compact mobile touch targets`);
  assert(css.includes("text-overflow: ellipsis") || css.includes("text-overflow:ellipsis"), `${file} must truncate long names`);
  assert(css.includes("direction: ltr") || css.includes("direction:ltr"), `${file} must keep action order stable in RTL`);
}

assert(
  /const CACHE_VERSION = 'v3\.0\.0';/.test(read("service-worker.js")),
  "Service worker cache must stay on v3.0.0 before publication"
);

console.log("Compact auth navigation tests passed.");
