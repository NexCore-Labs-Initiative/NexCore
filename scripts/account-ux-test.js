"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

for (const file of ["account.html", "ar/account.html"]) {
  const html = read(file);
  const userIdStart = html.indexOf('id="userId"');
  const userIdMarkup = html.slice(html.lastIndexOf("<span", userIdStart), html.indexOf("</span>", userIdStart));

  assert(userIdMarkup.includes("info-value-copy"), `${file} User ID must expose the click-to-copy affordance`);
  assert(userIdMarkup.includes('role="button"'), `${file} User ID must have button semantics`);
  assert(userIdMarkup.includes('tabindex="0"'), `${file} User ID must be keyboard focusable`);
  assert(!html.includes('id="copyUserIdBtn"'), `${file} must remove the separate copy button`);
  assert(html.includes('userIdElement.addEventListener("click", copyUserId)'), `${file} must copy on click`);
  assert(html.includes('userIdElement.addEventListener("keydown", handleUserIdCopyKeydown)'), `${file} must support keyboard copying`);
  assert(html.includes('navigator.clipboard.writeText(userIdText)'), `${file} must copy the actual User ID text`);
  assert(html.includes('function initAccountAvatarPreview()'), `${file} must initialize the avatar preview`);
  assert(html.includes('avatar.classList.toggle("is-expanded")'), `${file} must toggle the enlarged avatar state`);
  assert(html.includes('if (!avatar.contains(event.target)) closePreview()'), `${file} must close the avatar preview on outside click`);
  assert(html.includes('avatar.setAttribute("tabindex", "0")'), `${file} avatar preview must be keyboard focusable`);
  assert(html.includes('initAccountAvatarPreview();'), `${file} must activate the avatar preview after profile data loads`);
  assert(html.includes('.account-avatar.is-expanded'), `${file} must style the enlarged avatar state`);

  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || /application\/ld\+json/i.test(match[1])) continue;
    new vm.Script(match[2], { filename: `${file}:inline-script` });
  }
}

console.log("Account click-to-copy tests passed.");
