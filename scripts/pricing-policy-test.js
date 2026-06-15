"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  FEATURE_CATALOG,
  OMR_TO_USD,
  PAYMENTS_ENABLED,
  PAYMENTS_PAUSED_MESSAGE,
  PRICING_POLICY_VERSION,
  calcPayPalUsd,
  validateAndPriceFeatures,
  validatePaymentsEnabled,
  validatePolicyAcceptance,
} = require("../lib/pricingPolicy");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

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
  const headerEnd = html.indexOf("</header>", menuStart);
  const menu = html.slice(menuStart, headerEnd);
  assert(
    /href="[^"]*pricing-policy(?:\.html)?"/.test(menu),
    `${file} navigation must link to the Pricing Policy`
  );
}

for (const file of ["pricing.html", "ar/pricing.html"]) {
  const html = read(file);
  assert(
    html.includes(`const PRICING_POLICY_VERSION = '${PRICING_POLICY_VERSION}'`),
    `${file} must use the current policy version`
  );
  assert(html.includes(`const OMR_TO_USD = ${OMR_TO_USD.toFixed(2)}`), `${file} exchange rate drift`);

  for (const [id, item] of Object.entries(FEATURE_CATALOG)) {
    if (!html.includes(`${id}:`)) continue;
    assert(
      html.includes(`price: ${item.price.toFixed(3)}`),
      `${file} price drift for ${id}`
    );
  }

  assert(html.includes("PAYMENTS_ENABLED = false"), `${file} must keep checkout disabled`);
  assert(html.includes('id="paymentPauseBanner"'), `${file} must show the payment pause notice`);
  assert(html.includes('id="orderForm"') && html.includes("hidden"), `${file} must hide the order form`);
  assert(!html.includes("0409011343820023"), `${file} must not publish the bank account number`);
  assert(!html.includes("OM1402704090113438200"), `${file} must not publish the IBAN`);
}

for (const file of ["pricing-policy.html", "ar/pricing-policy.html"]) {
  const html = read(file);
  assert(html.includes(PRICING_POLICY_VERSION), `${file} policy version drift`);
  assert(html.includes("0.950"), `${file} must disclose the base access price`);
  assert(html.includes("2.500"), `${file} must disclose the one-year support price`);
  assert(html.includes('class="background"'), `${file} must use the standard NexCore background`);
  assert(html.includes('class="navbar"'), `${file} must use the standard NexCore navigation`);
  assert(html.includes('id="coreMenu"'), `${file} must include the standard menu control`);
  assert(html.includes('class="table-of-contents"'), `${file} must include policy navigation`);
  assert(html.includes('class="nexcore-sign"'), `${file} must include the standard NexCore signature`);
  assert(html.includes("MIT License") || html.includes("رخصة MIT"), `${file} must use the standard footer`);
  assert(html.includes("assets/js/script.js"), `${file} must load the shared site behavior`);
}

const prohibitedClaims = [
  "accessible forever",
  "never expires",
  "guaranteed 4-hour response",
  "All bug fixes are covered",
  "7-day refund guarantee",
  "until renewal",
  "GDPR-compliant",
  "EU GDPR-aligned",
  "متوافق مع مبادئ GDPR",
];
for (const file of [
  "faq.html",
  "terms.html",
  "how-to-use.html",
  "ar/faq.html",
  "ar/terms.html",
  "ar/how-to-use.html",
  "assets/js/unminified-js.js",
  "assets/js/script.js",
]) {
  const html = read(file);
  for (const claim of prohibitedClaims) {
    assert(!html.includes(claim), `${file} still contains misleading wording: ${claim}`);
  }
}

const englishFooterFiles = [
  "account.html",
  "intelligence.html",
  "auth.html",
  "dashboard.html",
  "faq.html",
  "how-to-use.html",
  "hub.html",
  "index.html",
  "pricing.html",
  "privacy-policy.html",
  "releases.html",
  "roadmap.html",
  "terms.html",
];
const arabicFooterFiles = [
  "ar/account.html",
  "ar/intelligence.html",
  "ar/auth.html",
  "ar/dashboard.html",
  "ar/faq.html",
  "ar/how-to-use.html",
  "ar/hub.html",
  "ar/index.html",
  "ar/pricing.html",
  "ar/privacy-policy.html",
  "ar/releases.html",
  "ar/roadmap.html",
  "ar/terms.html",
];

for (const file of englishFooterFiles) {
  const html = read(file);
  assert(
    html.includes("Optional contribution to support platform development"),
    `${file} must show the approved optional-contribution wording`
  );
  assert(html.includes('href="https://www.paypal.me/nexcorelabs"'), `${file} contribution must link to PayPal`);
  assert(!html.includes("(Currently paused)"), `${file} must not tie contributions to the paid-order pause`);
  assert(!html.includes("Support us via"), `${file} must not describe the contribution as support via PayPal`);
}

for (const file of arabicFooterFiles) {
  const html = read(file);
  assert(
    html.includes("مساهمة اختيارية لدعم تطوير المنصة"),
    `${file} must show the approved Arabic optional-contribution wording`
  );
  assert(html.includes('href="https://www.paypal.me/nexcorelabs"'), `${file} contribution must link to PayPal`);
  assert(!html.includes("(متوقفة حالياً)"), `${file} must not tie contributions to the paid-order pause`);
  assert(!html.includes("ادعمنا عبر"), `${file} must not use donation-style wording`);
}

assert(!read("assets/js/ai-chat.js").includes("optional contributions"));
assert(!read("assets/js/ai-chat.js").includes("paypal.me/nexcorelabs"));
assert(!read("pricing-policy.html").includes("Optional contributions:"));
assert(!read("ar/pricing-policy.html").includes("المساهمات الاختيارية:"));
assert(
  read("terms.html").includes("separate from service purchases, pricing,"),
  "English Terms must separate optional contributions from service pricing"
);
assert(
  read("terms.html").includes("does not grant any additional rights or benefits"),
  "English Terms must explain that contributions grant no rights or benefits"
);
assert(
  read("ar/terms.html").includes("منفصلة عن شراء الخدمات والأسعار والطلبات المدفوعة"),
  "Arabic Terms must separate optional contributions from service pricing"
);
assert(
  read("ar/terms.html").includes("المساهمة اختيارية لدعم تطوير المنصة ولا تمنح أي حقوق أو مزايا إضافية"),
  "Arabic Terms must include the approved contribution disclaimer"
);
assert(
  read("terms.html").includes("A customer may not request a voluntary refund after fulfillment begins"),
  "English Terms must clearly state when voluntary refund eligibility ends"
);
assert(
  read("ar/terms.html").includes("لا يحق للعميل طلب استرجاع اختياري بعد بدء تنفيذ الخدمة"),
  "Arabic Terms must clearly state when voluntary refund eligibility ends"
);
assert(
  read("pricing.html").includes("setup or priority review starts, or I benefit from any paid feature"),
  "English checkout consent must explain the refund cutoff"
);
assert(
  read("ar/pricing.html").includes("أو بدء الإعداد أو المراجعة ذات الأولوية، أو استفادتي من أي ميزة مدفوعة"),
  "Arabic checkout consent must explain the refund cutoff"
);

assert(read("index.html").includes("Independent Student Initiative"));
assert(read("ar/index.html").includes("مبادرة طلابية مستقلة"));
assert(read("terms.html").includes("Independent status:"));
assert(read("terms.html").includes("not operated,"));
assert(read("terms.html").includes("sponsored, endorsed, or licensed"));
assert(read("ar/terms.html").includes("الصفة المستقلة:"));
assert(read("privacy-policy.html").includes("Sultanate of Oman"));
assert(read("privacy-policy.html").includes("Personal Data"));
assert(read("privacy-policy.html").includes("Protection Law and its Executive Regulation"));
assert(read("ar/privacy-policy.html").includes("قانون حماية البيانات الشخصية"));

const englishPolicy = read("pricing-policy.html");
const arabicPolicy = read("ar/pricing-policy.html");
for (const marker of ["operating life", "seven calendar days", "48 hours", "processing charge"]) {
  assert(englishPolicy.includes(marker), `English policy is missing: ${marker}`);
}
for (const marker of ["مدة تشغيل", "سبعة أيام", "48 ساعة", "رسوم المعالجة"]) {
  assert(arabicPolicy.includes(marker), `Arabic policy is missing: ${marker}`);
}

const disabledPaymentApis = [
  "submit-subscription.js",
  "bank-transfer.js",
  "paypal-capture.js",
  "check-email-order.js",
  "update-subscription-status.js",
  "receipt-url.js",
];

for (const fileName of disabledPaymentApis) {
  assert(
    !fs.existsSync(path.join(root, "api", fileName)),
    `api/${fileName} must stay outside the deployable API directory while payments are paused`
  );
  assert(
    fs.existsSync(path.join(root, "disabled-payment-api", fileName)),
    `disabled-payment-api/${fileName} must preserve the disabled handler`
  );
}

assert(
  read(".vercelignore").split(/\r?\n/).includes("disabled-payment-api/"),
  "The disabled payment API archive must not be uploaded in Vercel deployments"
);

for (const file of [
  "disabled-payment-api/submit-subscription.js",
  "disabled-payment-api/bank-transfer.js",
  "disabled-payment-api/paypal-capture.js",
]) {
  const source = read(file);
  assert(source.includes("../lib/pricingPolicy"), `${file} must use the canonical pricing module`);
  assert(source.includes("validatePaymentsEnabled"), `${file} must reject requests while payments are paused`);
  assert(!source.includes("const FEATURE_CATALOG ="), `${file} must not duplicate the feature catalog`);
}

assert.equal(validatePolicyAcceptance(true, PRICING_POLICY_VERSION), null);
assert(validatePolicyAcceptance(false, PRICING_POLICY_VERSION));
assert(validatePolicyAcceptance(true, "old-version"));
assert.equal(PAYMENTS_ENABLED, false);
assert.equal(validatePaymentsEnabled(), PAYMENTS_PAUSED_MESSAGE);

const priced = validateAndPriceFeatures(
  [{ id: "lifetime" }, { id: "support_1month" }],
  "paypal"
);
assert.equal(priced.error, undefined);
assert.equal(priced.totalOmr, 1.450);
assert.equal(calcPayPalUsd(priced.baseUsd), 4.42);
assert(validateAndPriceFeatures([{ id: "support_1month" }], "paypal").error);
assert(validateAndPriceFeatures([{ id: "lifetime" }, { id: "priority" }], "paypal").error);

async function expectEndpointPaymentPause(handler, body) {
  const req = { method: "POST", body, headers: {} };
  const res = {
    statusCode: 200,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
    end() {},
  };
  await handler(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.error, PAYMENTS_PAUSED_MESSAGE);
}

Promise.all([
  expectEndpointPaymentPause(require("../disabled-payment-api/submit-subscription"), {
    user_name: "Test User",
    user_email: "test@example.com",
    selected_features: [{ id: "lifetime" }],
    payment_method: "paypal",
  }),
  expectEndpointPaymentPause(require("../disabled-payment-api/bank-transfer"), {
    user_name: "Test User",
    user_email: "test@example.com",
    selected_features: [{ id: "lifetime" }],
  }),
  expectEndpointPaymentPause(require("../disabled-payment-api/paypal-capture"), {
    paypal_order_id: "TEST-ORDER",
    user_name: "Test User",
    user_email: "test@example.com",
    selected_features: [{ id: "lifetime" }],
  }),
]).then(() => {
  console.log("Pricing policy consistency tests passed.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
