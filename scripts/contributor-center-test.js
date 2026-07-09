"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const pages = {
  "contribute.html": {
    title: "NexCore Labs | Contributor Center",
    canonical: "https://nexcorelabs.vercel.app/contribute",
    alternate: "https://nexcorelabs.vercel.app/ar/contribute",
    css: "assets/css/contribute.css",
    js: "assets/js/contribute.js",
    label: "Contributor Center",
  },
  "ar/contribute.html": {
    title: "NexCore Labs | مركز المساهمين",
    canonical: "https://nexcorelabs.vercel.app/ar/contribute",
    alternate: "https://nexcorelabs.vercel.app/contribute",
    css: "../assets/css/contribute.css",
    js: "../assets/js/contribute.js",
    label: "مركز المساهمين",
  },
};

for (const [file, expected] of Object.entries(pages)) {
  const html = read(file);
  assert(html.includes(`<title>${expected.title}</title>`), `${file} must use the localized title`);
  assert(html.includes(`<link rel="canonical" href="${expected.canonical}">`), `${file} must use a clean canonical URL`);
  assert(html.includes(expected.alternate), `${file} must link to its alternate locale`);
  assert(html.includes(`href="${expected.css}"`), `${file} must load shared Contributor Center styles`);
  assert(html.includes(`src="${expected.js}"`), `${file} must load shared Contributor Center behavior`);
  assert(html.includes('id="contributeFilters"'), `${file} must include path filters`);
  assert(html.includes('id="contributeGrid"'), `${file} must include contribution paths`);
  assert(html.includes('id="activityPanel"'), `${file} must include member activity`);
  assert(html.includes('data-contribute-nav'), `${file} must identify Contributor Center navigation`);
  assert(html.includes('aria-current="page"'), `${file} must mark the active navigation item`);
  assert(html.includes(expected.label), `${file} must include the localized Contributor Center label`);
  assert(html.includes("roadmap.html?action=suggest"), `${file} must deep-link to idea submission`);
  assert(!html.includes("fa-sparkles"), `${file} must only use supported Font Awesome Free icons`);
}

const contributorJs = read("assets/js/contribute.js");
for (const contract of [
  'db.from("projects")',
  '.eq("owner_user_id", session.user.id)',
  'db.from("features")',
  '.eq("created_by", session.user.id)',
  'window.ContributorCenter',
]) {
  assert(contributorJs.includes(contract), `Contributor activity must retain ${contract}`);
}

const windowStub = { ContributorCenter: null };
const documentStub = {
  readyState: "loading",
  documentElement: { lang: "en" },
  addEventListener() {},
  getElementById() { return null; },
};
vm.runInNewContext(contributorJs, {
  window: windowStub,
  document: documentStub,
  console,
  Intl,
  Date,
});
assert.strictEqual(windowStub.ContributorCenter.paths.length, 6, "Contributor Center must expose six honest contribution paths");
assert.strictEqual(windowStub.ContributorCenter.safeStatus("In Progress"), "inprogress", "Activity status classes must be sanitized");
assert.strictEqual(windowStub.ContributorCenter.safeStatus("", "draft"), "draft", "Missing activity status must fall back safely");

const authUi = read("assets/js/auth-ui-db.js");
assert(authUi.includes("function ensureContributeNavigation()"), "Shared navigation must inject Contributor Center where static markup is older");
assert(authUi.includes("data.contributeNav") || authUi.includes("dataset.contributeNav"), "Injected Contributor Center links must carry a stable data attribute");
assert(authUi.includes("fa-handshake-angle"), "Shared navigation must use the supported Contributor Center icon");
assert(authUi.includes("ensureContributeNavigation();"), "Contributor Center navigation injection must run during auth UI initialization");

const roadmap = read("assets/js/roadmap.js");
assert(roadmap.includes("get('action') === 'suggest'"), "Roadmap must recognize Contributor Center idea deep-links");
assert(roadmap.includes("openSuggestModal();"), "Roadmap idea deep-links must open the real submission workflow");

const routeConfig = JSON.parse(read("vercel.json"));
for (const [source, destination] of [["/contribute", "/contribute.html"], ["/ar/contribute", "/ar/contribute.html"]]) {
  assert(routeConfig.rewrites.some((rewrite) => rewrite.source === source && rewrite.destination === destination), `Vercel must rewrite ${source}`);
}

const serviceWorker = read("service-worker.js");
for (const url of ["/contribute", "/contribute.html", "/ar/contribute", "/ar/contribute.html", "/assets/css/contribute.css", "/assets/js/contribute.js"]) {
  assert(serviceWorker.includes(`'${url}'`), `Service worker must precache ${url}`);
}

const css = read("assets/css/contribute.css");
assert(css.includes('html[dir="rtl"]'), "Contributor Center styles must include explicit RTL details");
assert(css.includes("@media (max-width: 680px)"), "Contributor Center must include a mobile layout");
assert(css.includes("var(--card-shadow)"), "Contributor Center must reuse NexCore design tokens");

console.log("Contributor Center tests passed.");
