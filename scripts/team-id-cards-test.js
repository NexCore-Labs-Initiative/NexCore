"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expected = {
  "index.html": {
    css: "assets/css/team-id-cards.css",
    js: "assets/js/team-id-cards.js",
    labels: ["View ID card for Al-Faris Mujahid AlZakwani", "View ID card for Talal AlKalbani"]
  },
  "ar/index.html": {
    css: "../assets/css/team-id-cards.css",
    js: "../assets/js/team-id-cards.js",
    labels: ["عرض بطاقة الفارس بن مجاهد الزكواني", "عرض بطاقة طلال الكلباني"]
  }
};

for (const [file, page] of Object.entries(expected)) {
  const html = read(file);
  assert(html.includes(page.css), `${file} must load ID-card styles`);
  assert(html.includes(page.js), `${file} must load ID-card behavior`);
  assert(!html.includes("team-id-card-trigger"), `${file} must not retain a separate ID-card trigger`);
  assert(html.includes("team-id-card-avatar"), `${file} must make member avatars the ID-card triggers`);
  assert(html.includes('aria-haspopup="dialog"'), `${file} avatar triggers must announce the preview dialog`);
  for (const label of page.labels) assert(html.includes(label), `${file} must include the localized avatar label: ${label}`);
  for (const member of ["al-faris", "talal"]) {
    assert(html.includes(`data-team-id-card="${member}"`), `${file} must expose the ${member} trigger`);
  }
  assert(!html.includes('data-team-id-card="chatgpt"'), `${file} must not issue an ID card to ChatGPT`);
  assert(!html.includes('data-team-id-card="claude"'), `${file} must not issue an ID card to Claude`);
  assert(!html.includes("https://blinq.me/cmgiwe8wn01zhs60mfmiu60fj"), `${file} must replace Al-Faris’s avatar contact link`);
  assert(!html.includes("https://blinq.me/cmgj7rwqz0hies60mmtf2i2f6"), `${file} must replace Talal’s avatar contact link`);
}

const behavior = read("assets/js/team-id-cards.js");
const styles = read("assets/css/team-id-cards.css");
for (const value of [
  "NCL-0001",
  "NCL-0002",
  "September 2025",
  "سبتمبر ٢٠٢٥",
  "https://blinq.me/cmgiwe8wn01zhs60mfmiu60fj",
  "https://blinq.me/cmgj7rwqz0hies60mmtf2i2f6",
  "team-id-ncl-0001.png",
  "team-id-ncl-0002.png",
  'aria-modal',
  'event.key === "Escape"',
  'event.key !== "Tab"',
  "trapFocus",
  'document.addEventListener("keydown", trapFocus)',
  'document.removeEventListener("keydown", trapFocus)',
  "team-id-card__qr-link",
  "team-id-card__back-mark",
  "nexcore-icon.png",
  "NexCoreTeamIdCards"
]) {
  assert(behavior.includes(value), `Team ID-card behavior must include ${value}`);
}

assert(!behavior.includes("contactLink"), "ID-card back must not render a separate contact profile text link");
assert(!behavior.includes("team-id-card__contact-link"), "ID-card back must not render the removed contact link class");
assert(behavior.includes("qrLink.href = member.contactUrl"), "ID-card QR must link to the member contact profile");
assert(!styles.includes("team-id-card__brand-icon"), "ID-card stylesheet must not keep front brand icon styling");
assert(styles.includes(".team-id-card__back-mark"), "ID-card stylesheet must style the back NexCore icon mark");
assert(!styles.includes("team-id-card__contact-link"), "ID-card stylesheet must not keep the removed contact-link styling");
assert(styles.includes(".team-id-card__qr-link"), "ID-card stylesheet must style the clickable QR target");
assert(styles.includes("pointer-events: none"), "ID-card modal overlay must ignore interaction until opened like the cookie modal");
assert(styles.includes("pointer-events: all"), "ID-card modal overlay must accept interaction when opened like the cookie modal");
assert(
  styles.includes(".team-id-card-modal.is-open .team-id-card-modal__panel"),
  "ID-card panel must animate from the open state like the cookie modal"
);

for (const image of ["assets/images/team-id-ncl-0001.png", "assets/images/team-id-ncl-0002.png"]) {
  assert(fs.existsSync(path.join(root, image)), `${image} must exist`);
  assert(fs.statSync(path.join(root, image)).size > 1000, `${image} must be a usable QR asset`);
}

const serviceWorker = read("service-worker.js");
assert(/const CACHE_VERSION = 'v3\.1\.1';/.test(serviceWorker), "Service worker cache must match the current shared-asset release");
for (const asset of [
  "/assets/css/team-id-cards.css",
  "/assets/js/team-id-cards.js",
  "/assets/images/team-id-ncl-0001.png",
  "/assets/images/team-id-ncl-0002.png"
]) {
  assert(serviceWorker.includes(`'${asset}'`), `Service worker must precache ${asset}`);
}

console.log("Team ID-card tests passed.");
