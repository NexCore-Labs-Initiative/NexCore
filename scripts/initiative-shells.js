"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, "utf8");

const extract = (html, tag) => {
  const match = html.match(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "i"));
  if (!match) throw new Error(`Could not find ${tag} in source shell`);
  return match[0];
};

const englishHeader = extract(read("hub.html"), "header");
const arabicHeader = extract(read("ar/hub.html"), "header");
const englishFooter = extract(read("hub.html"), "footer");
const arabicFooter = extract(read("ar/hub.html"), "footer");

const rootAssets = (html) => html.replace(/(href|src)="assets\//g, '$1="/assets/');

const englishShell = (languageHref) => {
  let html = rootAssets(englishHeader).replace('href="ar/hub.html"', `href="${languageHref}"`);
  const files = ["auth", "hub", "index", "roadmap", "releases", "pricing", "pricing-policy", "faq", "how-to-use", "terms", "privacy-policy"];
  for (const file of files) {
    html = html.replaceAll(`href="${file}.html`, `href="/${file}.html`);
  }
  return html;
};

const arabicShell = (languageHref) => {
  let html = rootAssets(arabicHeader).replace('href="../hub.html"', `href="${languageHref}"`);
  const files = ["auth", "hub", "index", "roadmap", "releases", "pricing", "pricing-policy", "faq", "how-to-use", "terms", "privacy-policy"];
  for (const file of files) {
    html = html.replaceAll(`href="${file}.html`, `href="/ar/${file}.html`);
  }
  return html;
};

const signature = '<div class="nexcore-sign"><img id="nexcoreSign" src="/assets/images/nexcore-word.webp" alt="NexCore Labs"></div>';

function replaceShell(file, { locale, languageHref }) {
  let html = read(file);
  const header = locale === "ar" ? arabicShell(languageHref) : englishShell(languageHref);
  const footer = locale === "ar" ? arabicFooter : englishFooter;
  html = html.replace(/<header\b[\s\S]*?<\/header>/i, header);
  html = html.replace(/(?:<div class="nexcore-sign">[\s\S]*?<\/div>\s*)?<footer\b[\s\S]*?<\/footer>/i, `${signature}\n${footer}`);
  write(file, html);
}

function syncInitiativeShells() {
  const targets = [
    { file: "initiatives.html", locale: "en", languageHref: "/ar/initiatives" },
    { file: "ar/initiatives.html", locale: "ar", languageHref: "/initiatives" },
    { file: "initiative.html", locale: "en", languageHref: "/ar/initiative" },
    { file: "ar/initiative.html", locale: "ar", languageHref: "/initiative" },
  ];

  for (const initiative of JSON.parse(read("assets/data/initiatives.json")).initiatives) {
    targets.push(
      { file: `initiatives/${initiative.slug}/index.html`, locale: "en", languageHref: `/ar/initiatives/${initiative.slug}/` },
      { file: `ar/initiatives/${initiative.slug}/index.html`, locale: "ar", languageHref: `/initiatives/${initiative.slug}/` },
    );
  }

  targets.forEach((target) => replaceShell(target.file, target));
  return targets.length;
}

if (require.main === module) {
  console.log(`Synced ${syncInitiativeShells()} initiative page shell(s).`);
}

module.exports = { syncInitiativeShells };
