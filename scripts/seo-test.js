"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { SITE_ORIGIN, PAGE_PAIRS, absoluteUrl, flattenPages } = require("./seo-assets");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const privateOrUtilityRoutes = [
  "/auth",
  "/dashboard",
  "/account",
  "/admin-users",
  "/unsubscribe",
  "/offline",
  "/order-confirmation",
  "/embed",
  "/project",
];

const assertIncludes = (content, expected, message) => {
  assert(content.includes(expected), `${message}: expected ${expected}`);
};

const assertNotIncludes = (content, unexpected, message) => {
  assert(!content.includes(unexpected), `${message}: found ${unexpected}`);
};

const managedSchema = (html, file) => {
  const match = html.match(
    /<script\s+type=["']application\/ld\+json["']\s+data-nexcore-seo=["']true["']>([\s\S]*?)<\/script>/i
  );
  assert(match, `${file} must include managed JSON-LD`);
  return JSON.parse(match[1]);
};

const robots = read("robots.txt");
assertIncludes(robots, `Sitemap: ${SITE_ORIGIN}/sitemap.xml`, "robots.txt must point at the production sitemap");
assertNotIncludes(robots, "nexcorelabs.github.io", "robots.txt must not reference GitHub Pages");

const sitemap = read("sitemap.xml");
assertNotIncludes(sitemap, ".html</loc>", "sitemap must use clean canonical URLs");
assertNotIncludes(sitemap, "github.io", "sitemap must not reference GitHub Pages");

for (const pair of PAGE_PAIRS) {
  for (const locale of ["en", "ar"]) {
    const page = pair[locale];
    const url = absoluteUrl(page.path);
    assertIncludes(sitemap, `<loc>${url}</loc>`, `sitemap must include ${page.file}`);
  }
}

for (const route of privateOrUtilityRoutes) {
  assertNotIncludes(sitemap, `<loc>${SITE_ORIGIN}${route}`, `sitemap must exclude utility route ${route}`);
  assertNotIncludes(sitemap, `<loc>${SITE_ORIGIN}/ar${route}`, `sitemap must exclude Arabic utility route ${route}`);
}

for (const page of flattenPages()) {
  const html = read(page.file);
  const canonical = absoluteUrl(page.path);
  const enUrl = absoluteUrl(page.pair.en.path);
  const arUrl = absoluteUrl(page.pair.ar.path);

  assertIncludes(html, `<title>${page.title}</title>`, `${page.file} title must match SEO manifest`);
  assertIncludes(
    html,
    `<meta name="description" content="${page.description.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`,
    `${page.file} must include canonical meta description`
  );
  assertIncludes(html, `<link rel="canonical" href="${canonical}">`, `${page.file} must include canonical link`);
  assertIncludes(html, `<link rel="alternate" hreflang="en" href="${enUrl}">`, `${page.file} must include absolute English alternate`);
  assertIncludes(html, `<link rel="alternate" hreflang="ar" href="${arUrl}">`, `${page.file} must include absolute Arabic alternate`);
  assertIncludes(html, `<link rel="alternate" hreflang="x-default" href="${enUrl}">`, `${page.file} must include x-default alternate`);
  assertIncludes(html, `<meta property="og:url" content="${canonical}">`, `${page.file} must align OG URL to canonical`);
  assertIncludes(html, `<meta property="twitter:url" content="${canonical}">`, `${page.file} must align Twitter URL to canonical`);
  assertIncludes(html, `data-nexcore-seo="true"`, `${page.file} must include managed JSON-LD`);
  assertIncludes(html, `"@type": "BreadcrumbList"`, `${page.file} must include BreadcrumbList structured data`);
  assertNotIncludes(html, `rel=""`, `${page.file} must not contain broken rel attributes`);
  assertNotIncludes(html, "nexcorelabs.github.io", `${page.file} must not reference GitHub Pages`);

  const schema = managedSchema(html, page.file);
  const graph = schema["@graph"] || [];
  const organizationNode = graph.find((node) => node["@type"] === "Organization");
  const pageNode = graph.find((node) => node["@id"] === `${canonical}#webpage`);
  assert(organizationNode, `${page.file} must include Organization structured data`);
  assert(pageNode, `${page.file} must include a page-specific WebPage/FAQPage node`);
  assert(!organizationNode.mainEntity, `${page.file} must not attach FAQ questions to Organization`);

  if (page.key === "home") {
    assertIncludes(html, `"@type": "Organization"`, `${page.file} must include Organization structured data`);
    assertIncludes(html, `"@type": "WebSite"`, `${page.file} must include WebSite structured data`);
  }

  if (page.key === "faq") {
    assertIncludes(html, `"@type": "FAQPage"`, `${page.file} must include FAQPage structured data`);
    assertIncludes(html, `"@type": "Question"`, `${page.file} must include FAQ questions`);
    assert.strictEqual(pageNode["@type"], "FAQPage", `${page.file} page node must be FAQPage`);
    assert(Array.isArray(pageNode.mainEntity), `${page.file} FAQPage must own FAQ questions`);
  } else {
    assert(!pageNode.mainEntity, `${page.file} non-FAQ page must not carry FAQ questions`);
  }
}

assertIncludes(
  read("service-worker.js"),
  "v3.0.5",
  "service worker cache must match the ID-card cookie-modal logic v3.0.5 version"
);

const serviceWorker = read("service-worker.js");
for (const page of flattenPages()) {
  assertIncludes(
    serviceWorker,
    `'${page.path}'`,
    `service worker must precache clean route ${page.path}`
  );
  if (!page.file.endsWith("index.html")) {
    assertIncludes(
      serviceWorker,
      `'/${page.file.replace(/\\/g, "/")}'`,
      `service worker must precache backing file ${page.file}`
    );
  }
}

console.log("SEO asset tests passed.");
