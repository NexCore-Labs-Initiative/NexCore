"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

for (const [file, pausedCopy, callbackPath] of [
  ["auth.html", "External access is currently paused.", "/auth.html"],
  ["ar/auth.html", "الوصول الخارجي متوقف مؤقتاً حالياً.", "/ar/auth.html"]
]) {
  const html = read(file);
  assert(html.includes('<body class="auth-page">'), `${file} must use the scoped auth page class`);
  assert(html.includes('class="auth-gateway"'), `${file} must render the access gateway`);
  assert(html.includes('class="auth-gateway__card"'), `${file} must retain the access card`);
  assert(html.includes('id="googleSignInBtn"'), `${file} must retain the Google OAuth trigger`);
  assert(html.includes('id="btnText"'), `${file} must retain the Google button state label`);
  assert(html.includes(pausedCopy), `${file} must state that external access is paused`);
  assert(html.includes('href="terms.html"'), `${file} must keep the terms link`);
  assert(html.includes('href="privacy-policy.html"'), `${file} must keep the privacy policy link`);
  assert(!html.includes('class="signup-wrapper"'), `${file} must not retain the legacy split auth layout`);
  assert(!html.includes('class="squ-notice"'), `${file} must not retain the old eligibility block`);
  assert(!html.includes('href="pricing.html"') && !html.includes('href="../pricing.html"'), `${file} must not link to paused pricing access`);
  assert(!html.includes("approved NexCore users") && !html.includes("المستخدمون المعتمدون"), `${file} must not advertise external approval`);
  assert(html.includes("NexCoreAuth?.beginGoogleAuthAttempt?.()"), `${file} must preserve Google sign-in context until the callback returns`);
  assert(html.includes("NexCoreAuth?.consumeGoogleAuthAttempt?.()"), `${file} must show the eligibility notice after a rejected Google callback`);
  assert(html.includes("database error saving new user"), `${file} must replace Supabase's generic rejected-account error with the eligibility notice`);
  assert(html.includes(`getOAuthCallbackUrl?.('${callbackPath}')`), `${file} must return Google sign-in callbacks to the auth page`);
}

const authUi = read("assets/js/auth-ui-db.js");
assert(authUi.includes("External access is paused."), "Shared auth UI must use the paused external-access message");
assert(authUi.includes("الوصول الخارجي متوقف مؤقتاً."), "Shared auth UI must localize the paused external-access message");
assert(authUi.includes("GOOGLE_AUTH_ATTEMPT_KEY"), "Shared auth UI must retain the pending Google sign-in marker");
assert(authUi.includes("GOOGLE_AUTH_ATTEMPT_MAX_AGE"), "Pending Google sign-in markers must expire");
assert(authUi.includes("const CANONICAL_ORIGIN = 'https://nexcorelabs.vercel.app'"), "OAuth callbacks must use the canonical production origin");
assert(authUi.includes("function getOAuthCallbackUrl(path)"), "Shared auth UI must build OAuth callbacks consistently");

console.log("Auth gateway tests passed.");
