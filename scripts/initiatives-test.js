"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expected = {
  "initiatives.html": {
    title: "NexCore Labs | Initiatives",
    canonical: "https://nexcorelabs.vercel.app/initiatives",
    alternate: "https://nexcorelabs.vercel.app/ar/initiatives"
  },
  "ar/initiatives.html": {
    title: "NexCore Labs | مبادرات NexCore Labs",
    canonical: "https://nexcorelabs.vercel.app/ar/initiatives",
    alternate: "https://nexcorelabs.vercel.app/initiatives"
  }
};

for (const [file, page] of Object.entries(expected)) {
  const html = read(file);
  assert(html.includes(`<title>${page.title}</title>`), `${file} must have its canonical title`);
  assert(html.includes(`<link rel="canonical" href="${page.canonical}">`), `${file} must declare its clean canonical`);
  assert(html.includes(`<link rel="alternate" hreflang="en" href="${page.alternate}">`) || html.includes(`<link rel="alternate" hreflang="ar" href="${page.alternate}">`), `${file} must declare its language alternate`);
  assert(html.includes("assets/css/initiatives.css"), `${file} must load initiatives styles`);
  assert(html.includes("assets/js/initiatives.js"), `${file} must load initiatives behavior`);
  assert(html.includes('id="initiativeFilters"'), `${file} must include category filters`);
  assert(html.includes('id="initiativesGrid"'), `${file} must include the initiative grid`);
  assert(html.includes('id="initiativeModal"'), `${file} must include the quick-view modal`);
  assert(html.includes('aria-modal="true"'), `${file} modal must be a modal dialog`);
  const menuStart = html.indexOf('id="myDropdown"');
  const menuEnd = html.indexOf('</header>', menuStart);
  const menu = html.slice(menuStart, menuEnd);
  for (const destination of ["auth.html", "intelligence", "hub.html", "roadmap.html", "releases.html", "pricing.html", "pricing-policy.html", "faq.html", "how-to-use.html", "terms.html", "privacy-policy.html"]) {
    assert(menu.includes(destination), `${file} must retain the complete NexCore navigation menu (${destination})`);
  }
  assert(menu.includes('ai-link-icon'), `${file} must retain the NexCore Intelligence menu icon`);
  assert(menu.includes('fa-wand-magic-sparkles'), `${file} must use a Font Awesome Free icon for Initiatives`);
  assert(!menu.includes('fa-sparkles'), `${file} must not use the unsupported fa-sparkles icon`);
  assert(menu.includes('onkeyup="filterFunction()"'), `${file} must retain menu search behavior`);
}

const menuFiles = [
  ...fs.readdirSync(root)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file),
  ...fs.readdirSync(path.join(root, "ar"))
    .filter((file) => file.endsWith(".html"))
    .map((file) => `ar/${file}`),
].filter((file) => read(file).includes('id="myDropdown"'));

for (const file of menuFiles) {
  const html = read(file);
  const menuStart = html.indexOf('id="myDropdown"');
  const menuEnd = html.indexOf('</header>', menuStart);
  const menu = html.slice(menuStart, menuEnd);
  const isArabic = file.startsWith("ar/");
  const hubIndex = menu.indexOf('menu-dots-icon');
  const initiativesIndex = menu.indexOf('data-initiatives-nav');
  const projectsIndex = menu.indexOf('fa-diagram-project');

  assert(initiativesIndex >= 0, `${file} navigation must include the Initiatives link`);
  assert(
    hubIndex >= 0 && hubIndex < initiativesIndex && initiativesIndex < projectsIndex,
    `${file} navigation must place Initiatives between Hub and Projects`
  );
  assert(menu.includes('fa-wand-magic-sparkles'), `${file} must use the supported Initiatives icon`);
  assert(!menu.includes('fa-sparkles'), `${file} must not use the unsupported Initiatives icon`);
  if (isArabic) {
    const href = menu.includes('href="/ar/hub.html"') ? '/ar/initiatives.html' : 'initiatives.html';
    assert(menu.includes(`href="${href}"`), `${file} must link to the Arabic Initiatives page`);
    assert(menu.includes('> المبادرات</a>'), `${file} must label Initiatives in Arabic`);
  } else {
    assert(menu.includes('href="initiatives.html"'), `${file} must link to the English Initiatives page`);
    assert(menu.includes('> Initiatives</a>'), `${file} must label Initiatives in English`);
  }
}

const sql = read("supabase/initiatives.sql");
for (const field of ["slug", "status", "categories", "title", "mission", "summary", "overview", "highlights", "primary_link", "visibility"]) {
  assert(sql.includes(field), `Initiatives schema must include ${field}`);
}
assert(sql.includes("enable row level security"), "Initiatives table must enable RLS");
assert(sql.includes("visibility = 'public'"), "Public select policy must only expose public records");

const routeConfig = JSON.parse(read("vercel.json"));
for (const [source, destination] of [["/initiatives", "/initiatives.html"], ["/ar/initiatives", "/ar/initiatives.html"]]) {
  assert(routeConfig.rewrites.some((rewrite) => rewrite.source === source && rewrite.destination === destination), `Vercel must rewrite ${source}`);
}

const serviceWorker = read("service-worker.js");
for (const url of ["/initiatives", "/initiatives.html", "/ar/initiatives", "/ar/initiatives.html", "/assets/css/initiatives.css", "/assets/js/initiatives.js"]) {
  assert(serviceWorker.includes(`'${url}'`), `Service worker must precache ${url}`);
}

const windowStub = {
  addEventListener() {},
  InitiativesPage: null
};
const documentStub = {
  readyState: "loading",
  documentElement: { lang: "en" },
  addEventListener() {}
};
vm.runInNewContext(read("assets/js/initiatives.js"), { window: windowStub, document: documentStub, URLSearchParams, console });
const { normalizeInitiative, filterInitiatives } = windowStub.InitiativesPage;
const sourceRecord = {
  slug: "nexcore-study-hub",
  status: "in-development",
  categories: ["ai-dev-tools", "community-events"],
  featured: true,
  sort_order: 1,
  visibility: "public",
  title: { en: "Study Hub", ar: "مركز الدراسة" },
  mission: { en: "A study resource experience.", ar: "تجربة لمصادر الدراسة." },
  summary: { en: "Short summary.", ar: "ملخص قصير." },
  overview: { en: "Detailed overview.", ar: "نظرة تفصيلية." },
  highlights: [{ en: "Curated", ar: "منسق" }]
};
const valid = normalizeInitiative(sourceRecord);
assert(valid && Object.isFrozen(valid), "A complete public initiative must normalize into an immutable record");
assert.strictEqual(normalizeInitiative({ ...sourceRecord, visibility: "draft" }), null, "Draft initiatives must not render publicly");
assert.strictEqual(normalizeInitiative({ ...sourceRecord, title: { en: "English only" } }), null, "Initiatives require both locale titles");
assert.strictEqual(filterInitiatives([valid], "community-events").length, 1, "Category filtering must retain matching records");
assert.strictEqual(filterInitiatives([valid], "hardware-exploration").length, 0, "Category filtering must exclude unrelated records");

console.log("Initiatives tests passed.");
