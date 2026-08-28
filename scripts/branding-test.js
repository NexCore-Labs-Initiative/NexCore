"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const htmlFiles = (directory = root) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name);
  if (entry.isDirectory()) {
    if ([".git", ".vercel", "node_modules"].includes(entry.name)) return [];
    return htmlFiles(fullPath);
  }
  return entry.name.endsWith(".html") ? [path.relative(root, fullPath).replace(/\\/g, "/")] : [];
});

const englishSlogan = "Empower our SQU Community to do more.";
const arabicSlogan = "نمكّن مجتمع جامعة السلطان قابوس من إنجاز المزيد.";

assert(read("index.html").includes(englishSlogan), "English homepage must show the current slogan");
assert(read("ar/index.html").includes(arabicSlogan), "Arabic homepage must show the localized slogan");
assert(read("manifest.json").includes("Empower our SQU Community to do more"), "Manifest description must use the current positioning");
assert(read("package.json").includes(englishSlogan), "Package description must use the current slogan");
assert(read("README.md").includes(englishSlogan), "README must use the current slogan");

const retiredCopy = [
  "At the Core of Every Idea",
  "Brings projects to life online",
  "Bringing projects to life online",
  "student-driven digital solutions, rapid prototypes and polished showcases",
  "We take student projects and turn them into clean, presentable and deployable pages",
  "في قلب كل فكرة",
  "تحويل المشاريع إلى واقع رقمي",
  "نحن نأخذ مشاريع الطلاب ونحولها إلى صفحات نظيفة وقابلة للنشر",
];

for (const file of [
  "index.html",
  "ar/index.html",
  "thanks.html",
  "ar/thanks.html",
  "manifest.json",
  "package.json",
  "README.md",
]) {
  const content = read(file);
  for (const phrase of retiredCopy) {
    assert(!content.includes(phrase), `${file} still contains retired brand copy: ${phrase}`);
  }
}

assert(
  read("index.html").includes("independent, student-led platform"),
  "English homepage must preserve NexCore's independent status"
);
assert(
  read("ar/index.html").includes("منصة مستقلة يقودها طلاب"),
  "Arabic homepage must preserve NexCore's independent status"
);

const flaticonCredit = 'Uicons by <a href="https://www.flaticon.com/" target="_blank" rel="noopener">Flaticon</a>';
const standardFooterFiles = htmlFiles().filter((file) => {
  const html = read(file);
  return html.includes("site-footer") && html.includes("license-link");
});

for (const file of standardFooterFiles) {
  const html = read(file);
  assert(html.includes(`class="asset-credit">${flaticonCredit}</small>`), `${file} must include the shared Flaticon attribution credit`);
  assert(!html.includes("أيقونات Uicons"), `${file} must keep the Flaticon credit text identical across EN/AR pages`);
}

for (const file of ["assets/js/unminified-js.js", "assets/js/script.js"]) {
  const js = read(file);
  assert(js.includes("Uicons by "), `${file} must add the shared Flaticon attribution safeguard`);
  assert(js.includes("https://www.flaticon.com/"), `${file} must link Flaticon attribution to Flaticon`);
}

for (const file of ["assets/css/unminified-css.css", "assets/css/style.css"]) {
  assert(read(file).includes(".asset-credit"), `${file} must style the Flaticon attribution quietly in the footer`);
}

console.log("Branding consistency tests passed.");
