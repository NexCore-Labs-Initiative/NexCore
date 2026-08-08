"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "config", "routes.json"), "utf8"));
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const rewrites = new Map(vercel.rewrites.map(({ source, destination }) => [source, destination]));
const routes = new Map(manifest.routes.map((route) => [route.route, route]));

assert.equal(routes.size, manifest.routes.length, "route paths must be unique");
for (const route of manifest.routes) {
  assert(fs.existsSync(path.join(root, route.file)), `${route.file} must exist`);
  assert(routes.has(route.pair), `${route.route} is missing localization pair ${route.pair}`);
  assert.equal(routes.get(route.pair).pair, route.route, `${route.route} pair must be reciprocal`);
  if (route.route !== "/") {
    assert.equal(rewrites.get(route.route), `/${route.file.replace(/\\/g, "/")}`, `${route.route} rewrite is missing`);
  }
  const canonical = `${manifest.canonicalOrigin}${route.route === "/" ? "/" : route.route}`;
  assert.equal(sitemap.includes(`<loc>${canonical}</loc>`), route.indexed, `${route.route} sitemap state must match indexed`);
  if (route.precache) assert(worker.includes(`'${route.route}'`), `${route.route} must be precached`);

  const html = fs.readFileSync(path.join(root, route.file), "utf8");
  if (["/pricing", "/ar/pricing", "/intelligence", "/ar/intelligence"].includes(route.route)) {
    assert(/<meta\s+name="robots"\s+content="noindex,\s*follow"/i.test(html), `${route.route} must be noindex, follow`);
  }
}

console.log(`Route manifest validated ${manifest.routes.length} bilingual route records.`);
