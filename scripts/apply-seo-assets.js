"use strict";

const fs = require("fs");
const path = require("path");
const {
  SITE_ORIGIN,
  OG_IMAGE,
  PAGE_PAIRS,
  absoluteUrl,
  flattenPages,
  schemaForPage,
} = require("./seo-assets");

const root = path.resolve(__dirname, "..");
const lastmod = "2026-06-16";

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, "utf8");

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const managedLdRegex =
  /\s*<!-- NexCore SEO structured data -->\s*<script\s+type=["']application\/ld\+json["']\s+data-nexcore-seo=["']true["']>[\s\S]*?<\/script>\s*/gi;

const alternateRegex = /\s*<link\b(?=[^>]*\bhreflang=)(?=[^>]*\brel=["'](?:alternate)?["'])[^>]*>\s*/gi;
const canonicalRegex = /\s*<link\s+rel=["']canonical["'][^>]*>\s*/gi;

const upsertMeta = (head, attribute, key, content) => {
  const tag = `<meta ${attribute}="${key}" content="${escapeAttr(content)}">`;
  const regex = new RegExp(`<meta\\s+[^>]*\\b${attribute}=["']${escapeRegExp(key)}["'][^>]*>`, "i");
  if (regex.test(head)) return head.replace(regex, tag);

  const titleEnd = head.match(/<\/title>/i);
  if (!titleEnd) return `${tag}\n${head}`;
  const insertAt = titleEnd.index + titleEnd[0].length;
  return `${head.slice(0, insertAt)}\n        ${tag}${head.slice(insertAt)}`;
};

const insertSeoLinksAfterDescription = (head, page) => {
  const enUrl = absoluteUrl(page.pair.en.path);
  const arUrl = absoluteUrl(page.pair.ar.path);
  const pageUrl = absoluteUrl(page.path);
  const links = [
    `<link rel="canonical" href="${escapeAttr(pageUrl)}">`,
    `<link rel="alternate" hreflang="en" href="${escapeAttr(enUrl)}">`,
    `<link rel="alternate" hreflang="ar" href="${escapeAttr(arUrl)}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(enUrl)}">`,
  ].join("\n        ");
  return head.replace(
    /<meta\s+[^>]*\bname=["']description["'][^>]*>/i,
    (match) => `${match}\n        ${links}`
  );
};

const dedupeExactStylesheets = (head) => {
  const seen = new Set();
  return head.replace(
    /([ \t]*)<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>\s*/gi,
    (match, indent, href) => {
      if (seen.has(href)) return "";
      seen.add(href);
      return match;
    }
  );
};

const normalizeHead = (html, page) => {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) {
    throw new Error(`${page.file} does not contain a <head> section`);
  }

  let head = headMatch[1];
  head = head.replace(managedLdRegex, "\n");
  head = head.replace(canonicalRegex, "\n");
  head = head.replace(alternateRegex, "\n");
  head = head.replace(/<title>[\s\S]*?<\/title>/i, `<title>${page.title}</title>`);
  head = upsertMeta(head, "name", "description", page.description);
  head = upsertMeta(head, "property", "og:url", absoluteUrl(page.path));
  head = upsertMeta(head, "property", "og:type", "website");
  head = upsertMeta(head, "property", "og:title", page.title);
  head = upsertMeta(head, "property", "og:description", page.description);
  head = upsertMeta(head, "property", "og:image", OG_IMAGE);
  head = upsertMeta(head, "name", "twitter:card", "summary_large_image");
  head = upsertMeta(head, "property", "twitter:domain", "nexcorelabs.vercel.app");
  head = upsertMeta(head, "property", "twitter:url", absoluteUrl(page.path));
  head = upsertMeta(head, "name", "twitter:title", page.title);
  head = upsertMeta(head, "name", "twitter:description", page.description);
  head = upsertMeta(head, "name", "twitter:image", OG_IMAGE);
  head = insertSeoLinksAfterDescription(head, page);
  head = dedupeExactStylesheets(head);

  const jsonLd = JSON.stringify(schemaForPage(page), null, 2).replace(/<\/script/gi, "<\\/script");
  head = `${head.trimEnd()}\n\n        <!-- NexCore SEO structured data -->\n        <script type="application/ld+json" data-nexcore-seo="true">\n${jsonLd}\n        </script>\n`;

  return html.replace(headMatch[0], `<head>${head}</head>`);
};

for (const page of flattenPages()) {
  const current = read(page.file);
  write(page.file, normalizeHead(current, page));
}

write(
  "robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
);

const sitemapUrls = PAGE_PAIRS.flatMap((pair) => [
  { loc: absoluteUrl(pair.en.path), priority: pair.priority },
  { loc: absoluteUrl(pair.ar.path), priority: pair.priority },
]);

write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
    .map(
      (entry) => `  <url>\n    <loc>${entry.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${entry.priority}</priority>\n  </url>`
    )
    .join("\n")}\n</urlset>\n`
);

const serviceWorkerPath = "service-worker.js";
const serviceWorker = read(serviceWorkerPath).replace(
  /const CACHE_VERSION = '([^']+)';/,
  "const CACHE_VERSION = 'v2.9.1-seo-assets-20260616';"
);
write(serviceWorkerPath, serviceWorker);

console.log(`Applied SEO assets to ${flattenPages().length} pages.`);
