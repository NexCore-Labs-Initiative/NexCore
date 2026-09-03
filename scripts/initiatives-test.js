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
  assert(html.includes("assets/css/initiatives.css?v=3.1.3"), `${file} must load the current initiatives styles`);
  assert(html.includes("assets/js/initiatives.js"), `${file} must load initiatives behavior`);
  assert(html.includes('id="initiativeFilters"'), `${file} must include category filters`);
  assert(html.includes('id="initiativesGrid"'), `${file} must include the initiative grid`);
  assert(html.includes('id="initiativeModal"'), `${file} must include the quick-view modal`);
  assert(html.includes('aria-modal="true"'), `${file} modal must be a modal dialog`);
  const menuStart = html.indexOf('id="myDropdown"');
  const menuEnd = html.indexOf('</header>', menuStart);
  const menu = html.slice(menuStart, menuEnd);
  for (const destination of ["auth.html", "hub.html", "roadmap.html", "releases.html", "pricing-policy.html", "faq.html", "how-to-use.html", "terms.html", "privacy-policy.html"]) {
    assert(menu.includes(destination), `${file} must retain the complete NexCore navigation menu (${destination})`);
  }
  assert(!menu.includes('ai-link'), `${file} must de-emphasize paused Intelligence navigation`);
  assert(!menu.includes('title="Pricing Plans"'), `${file} must de-emphasize paused pricing navigation`);
  assert(menu.includes('fa-cube'), `${file} must use the cube Font Awesome Free icon for Initiatives`);
  assert(!menu.includes('fa-sparkles'), `${file} must not use the unsupported fa-sparkles icon`);
  assert(menu.includes('onkeyup="filterFunction()"'), `${file} must retain menu search behavior`);
}

for (const [file, expectedHref, expectedLabel] of [
  ["index.html", "initiatives.html", "initiatives"],
  ["ar/index.html", "/ar/initiatives.html", "مبادرات"]
]) {
  const html = read(file);
  assert(html.includes('id="initiativeCount"'), `${file} must show the public initiatives count in the workflow card`);
  assert(html.includes(`href="${expectedHref}"`), `${file} workflow card must link to the initiatives catalogue`);
  assert(html.includes(`fa-cube"></i> ${expectedLabel}`), `${file} must label the initiatives KPI`);
  assert(html.includes("/api/public-metrics"), `${file} must use the protected aggregate metrics API`);
  assert(!html.includes('id="support"'), `${file} must remove the old support KPI`);
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
  const sectionTitles = isArabic
    ? ["المنصة", "نكسكور", "التحديثات", "المساعدة", "السياسات"]
    : ["Platform", "NexCore", "Updates", "Help", "Policies"];
  const platformTitleIndex = menu.indexOf(`<div class="menu-section-title">${sectionTitles[0]}</div>`);
  const policiesTitleIndex = menu.indexOf(`<div class="menu-section-title">${sectionTitles[4]}</div>`);
  const hubIndex = menu.indexOf('menu-dots-icon');
  const initiativesIndex = menu.indexOf('data-initiatives-nav');
  const pricingIndex = menu.indexOf('pricing-policy.html', policiesTitleIndex);
  const termsIndex = menu.indexOf('terms.html', policiesTitleIndex);
  const privacyIndex = menu.indexOf('privacy-policy.html', policiesTitleIndex);

  assert(initiativesIndex >= 0, `${file} navigation must include the Initiatives link`);
  assert(!menu.includes("div-menu-line"), `${file} navigation must replace divider lines with section titles`);
  for (const title of sectionTitles) {
    assert(menu.includes(`<div class="menu-section-title">${title}</div>`), `${file} navigation must include the ${title} section title`);
  }
  assert(
    platformTitleIndex >= 0 && platformTitleIndex < initiativesIndex && hubIndex >= 0 && initiativesIndex < hubIndex,
    `${file} navigation must group Initiatives and Hub under Platform`
  );
  assert(
    policiesTitleIndex >= 0 && policiesTitleIndex < pricingIndex && pricingIndex < termsIndex && termsIndex < privacyIndex,
    `${file} navigation must group Pricing Policy, Terms, and Privacy Policy under Policies`
  );
  assert(menu.includes('fa-cube'), `${file} must use the supported Initiatives icon`);
  assert(!menu.includes('fa-sparkles'), `${file} must not use the unsupported Initiatives icon`);
  if (isArabic) {
    const href = menu.includes('href="/ar/hub.html"') ? '/ar/initiatives.html' : 'initiatives.html';
    assert(menu.includes(`href="${href}"`), `${file} must link to the Arabic Initiatives page`);
    assert(menu.includes('> المبادرات <span class="new-badge">جديد</span></a>'), `${file} must label Initiatives with the Arabic new badge`);
  } else {
    assert(menu.includes('href="initiatives.html"'), `${file} must link to the English Initiatives page`);
    assert(menu.includes('> Initiatives <span class="new-badge">New</span></a>'), `${file} must label Initiatives with the English new badge`);
  }
}

const sql = read("docs/archive/sql/initiatives.legacy.sql");
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

const sharedMenuJs = read("assets/js/unminified-js.js");
const authUi = read("assets/js/auth-ui-db.js");
const sharedMenuCss = read("assets/css/unminified-css.css");
assert(sharedMenuJs.includes("window.NexCoreInitiativesMenu"), "Shared menu script must expose the initiatives shortcut drawer helper");
assert(sharedMenuJs.includes(".eq(\"visibility\", \"public\")"), "Shortcut drawer must only query public initiatives");
assert(sharedMenuJs.includes(".eq(\"featured\", true)"), "Shortcut drawer must only query featured initiatives");
assert(sharedMenuJs.includes(".limit(3)"), "Shortcut drawer must limit the menu to three initiative shortcuts");
assert(sharedMenuJs.includes("title, image, logo, sort_order"), "Shortcut drawer must fetch compact initiative logos");
assert(sharedMenuJs.includes("?initiative=${encodeURIComponent(initiative.slug)}"), "Shortcut links must deep-link to the initiative quick view");
assert(sharedMenuJs.includes("logo: normalizeImageUrl(raw?.logo?.src)"), "Shortcut drawer must normalize initiative logos");
assert(sharedMenuJs.includes("const visualSrc = initiative.logo || initiative.image"), "Shortcut drawer must prefer compact logos over larger initiative images");
assert(!sharedMenuJs.includes("image.loading = \"lazy\""), "Dynamically inserted shortcut images must not be hidden by the global lazy-image opacity rule");
assert(sharedMenuJs.includes("filterMenu(div, filter)"), "Menu search must delegate to the grouped-menu filter");
assert(sharedMenuJs.includes("menu-section-title"), "Menu search must hide section titles while filtering");
assert(authUi.includes("window.NexCoreInitiativesMenu?.init();"), "Auth navigation must re-run the shortcut drawer after injected menu links");
assert(authUi.includes("const initiativesGroup = menu.querySelector('[data-initiatives-nav-group]');"), "Contributor navigation must insert after the grouped initiatives drawer");
for (const selector of [".initiatives-nav-group", ".initiatives-shortcut-drawer", ".initiative-shortcut-link", ".initiative-shortcut-visual", ".initiative-shortcut-all"]) {
  assert(sharedMenuCss.includes(selector), `Shared menu CSS must style ${selector}`);
}
assert(sharedMenuCss.includes(".menu-section-title"), "Shared menu CSS must style section titles");

const initiativesCss = read("assets/css/initiatives.css");
const modalVisualRule = initiativesCss.match(/\.initiative-modal-visual\s*\{([^}]*)\}/)?.[1] || "";
const modalImageRule = initiativesCss.match(/\.initiative-modal-visual img\s*\{([^}]*)\}/)?.[1] || "";
assert(modalVisualRule.includes("align-items: center"), "Initiative modal artwork must be vertically centered");
assert(modalVisualRule.includes("justify-content: center"), "Initiative modal artwork must be horizontally centered");
assert(modalImageRule.includes("width: 100%"), "Initiative modal images must fit their visual column width");
assert(modalImageRule.includes("max-width: 100%"), "Initiative modal images must not overflow their visual column");
assert(modalImageRule.includes("height: auto"), "Initiative modal images must preserve their natural aspect ratio");
assert(modalImageRule.includes("object-fit: contain"), "Initiative modal images must remain fully visible");
assert(!modalImageRule.includes("height: 100%"), "Initiative modal images must not stretch to the modal height");
assert(!modalImageRule.includes("object-fit: cover"), "Initiative modal images must not be cropped");
assert(
  /@media \(max-width: 640px\)[\s\S]*?\.initiative-modal-visual\s*\{[\s\S]*?height: clamp\(260px, 76vw, 340px\);[\s\S]*?max-height: none;/.test(initiativesCss),
  "Small-screen initiative modals must provide a responsive, uncropped image stage"
);

const windowStub = {
  addEventListener() {},
  InitiativesPage: null
};
const documentStub = {
  readyState: "loading",
  documentElement: { lang: "en" },
  addEventListener() {}
};
vm.runInNewContext(read("assets/js/initiatives.js"), { window: windowStub, document: documentStub, URL, URLSearchParams, console });
const { normalizeInitiative, filterInitiatives, revealImageWhenReady } = windowStub.InitiativesPage;

let loadHandler = null;
const loadingImage = {
  complete: false,
  naturalWidth: 0,
  classList: { add(className) { this.added = className; } },
  addEventListener(eventName, handler, options) {
    assert.strictEqual(eventName, "load");
    assert.strictEqual(options.once, true);
    loadHandler = handler;
  }
};
revealImageWhenReady(loadingImage);
assert.strictEqual(loadingImage.classList.added, undefined, "An image must remain hidden until it loads");
loadHandler();
assert.strictEqual(loadingImage.classList.added, "is-loaded", "A loaded initiative image must become visible");

const cachedImage = {
  complete: true,
  naturalWidth: 512,
  classList: { add(className) { this.added = className; } },
  addEventListener() {}
};
revealImageWhenReady(cachedImage);
assert.strictEqual(cachedImage.classList.added, "is-loaded", "A cached initiative image must become visible immediately");
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
const githubImageRecord = normalizeInitiative({
  ...sourceRecord,
  logo: { src: "https://github.com/NexCore-Labs-Initiative/nexcore-study-hub/blob/main/assets/imgs/studyhub-logo.webp" },
  image: {
    src: "https://github.com/NexCore-Labs-Initiative/nexcore-study-hub/blob/main/assets/imgs/nexcorelabs-studyhub.webp",
    alt: { en: "Study Hub preview", ar: "معاينة مركز الدراسة" }
  }
});
assert.strictEqual(
  githubImageRecord.image.src,
  "https://raw.githubusercontent.com/NexCore-Labs-Initiative/nexcore-study-hub/main/assets/imgs/nexcorelabs-studyhub.webp",
  "Public initiative rendering should convert GitHub blob images to raw URLs"
);
assert.strictEqual(
  githubImageRecord.logo.src,
  "https://raw.githubusercontent.com/NexCore-Labs-Initiative/nexcore-study-hub/main/assets/imgs/studyhub-logo.webp",
  "Public initiative rendering should convert GitHub blob logos to raw URLs"
);
assert.strictEqual(normalizeInitiative({ ...sourceRecord, visibility: "draft" }), null, "Draft initiatives must not render publicly");
assert.strictEqual(normalizeInitiative({ ...sourceRecord, title: { en: "English only" } }), null, "Initiatives require both locale titles");
assert.strictEqual(filterInitiatives([valid], "community-events").length, 1, "Category filtering must retain matching records");
assert.strictEqual(filterInitiatives([valid], "hardware-exploration").length, 0, "Category filtering must exclude unrelated records");

console.log("Initiatives tests passed.");
