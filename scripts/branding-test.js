"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

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
  "arabic-demo.html",
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

console.log("Branding consistency tests passed.");
