"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const menuFiles = [
  ...fs.readdirSync(root).filter((file) => file.endsWith(".html")).map((file) => file),
  ...fs.readdirSync(path.join(root, "ar")).filter((file) => file.endsWith(".html")).map((file) => `ar/${file}`)
].filter((file) => read(file).includes('id="myDropdown"'));

for (const file of menuFiles) {
  const html = read(file);
  const menuStart = html.indexOf('id="myDropdown"');
  const menuEnd = html.indexOf("</header>", menuStart);
  const menu = html.slice(menuStart, menuEnd);

  assert(!/href="hub\.html#projects"[^>]*>/.test(menu), `${file} must not retain the flat Projects navigation link`);
  assert(menu.includes('menu-dots-icon'), `${file} must retain the Hub navigation anchor for project shortcuts`);
}

const sharedMenuJs = read("assets/js/unminified-js.js");
const authUi = read("assets/js/auth-ui-db.js");
const sharedMenuCss = read("assets/css/unminified-css.css");

assert(sharedMenuJs.includes("window.NexCoreProjectsMenu"), "Shared menu must expose the project shortcut drawer helper");
assert(sharedMenuJs.includes('.from("projects")'), "Project shortcuts must load project records");
assert(sharedMenuJs.includes('.eq("published", true)'), "Project shortcuts must only query published projects");
assert(sharedMenuJs.includes('.limit(3)'), "Project shortcuts must cap the list at three projects");
assert(sharedMenuJs.includes("logo_url, image_url"), "Project shortcuts must fetch and prefer project logos");
assert(sharedMenuJs.includes('data-projects-nav-group'), "Project shortcuts must render a grouped menu section");
assert(sharedMenuJs.includes('/ar/project.html'), "Arabic project shortcuts must use the Arabic project route");
assert(sharedMenuJs.includes('/ar/hub.html#projects'), "Arabic View all projects must use the Arabic hub route");
assert(sharedMenuJs.includes('View all projects'), "English project shortcuts must retain the full directory route");
assert(sharedMenuJs.includes('عرض كل المشاريع'), "Arabic project shortcuts must retain the full directory route");
assert(authUi.includes('window.NexCoreProjectsMenu?.init();'), "Auth navigation must re-run the project shortcut drawer after it injects navigation");

for (const selector of [".projects-nav-group", ".projects-shortcut-drawer", ".project-shortcut-link", ".project-shortcut-visual", ".project-shortcut-all"]) {
  assert(sharedMenuCss.includes(selector), `Shared menu CSS must style ${selector}`);
}
assert(sharedMenuCss.includes(".dropdown-content a.mt-0:not(.lang-switch-pill, .magic-signup, .ai-link, .nav-user-action)"), "Menu links with .mt-0 must retain the shared row spacing");

for (const file of ["dashboard.html", "ar/dashboard.html"]) {
  const html = read(file);
  assert(html.includes('id="profileLogoUrl"'), `${file} must let the owner provide a project logo URL`);
  assert(html.includes('id="logoPreview"'), `${file} must preview the project logo`);
  assert(html.includes("logo_url: valueOf(\"profileLogoUrl\")"), `${file} must include the logo in command-center state`);
  assert(html.includes("logo_url,"), `${file} must save the project logo URL`);
}

const migration = read("supabase/migrations/20260903193908_add_projects_logo_url.sql");
assert(migration.includes("add column if not exists logo_url text"), "Projects migration must add an optional logo URL column");

console.log("Project navigation tests passed.");
