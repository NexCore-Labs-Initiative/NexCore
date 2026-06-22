"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = JSON.parse(fs.readFileSync(path.join(root, "assets/data/initiatives.json"), "utf8"));
const escape = (value) => String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

const labels = {
  en: { type: { platform: "Platform", program: "Program", campaign: "Campaign", event: "Event" }, status: { active: "Active", beta: "Beta", upcoming: "Upcoming", completed: "Completed", archived: "Archived" }, category: { "academic-learning": "Academic & Learning", "campus-services": "Campus Services", "research-innovation": "Research & Innovation", community: "Community", "student-life": "Student Life", "digital-infrastructure": "Digital Infrastructure" }, launch: "Launched", team: "Team", back: "All initiatives", language: "العربية" },
  ar: { type: { platform: "منصة", program: "برنامج", campaign: "حملة", event: "فعالية" }, status: { active: "نشطة", beta: "تجريبية", upcoming: "قريباً", completed: "مكتملة", archived: "مؤرشفة" }, category: { "academic-learning": "التعلّم والموارد الأكاديمية", "campus-services": "خدمات الحرم الجامعي", "research-innovation": "البحث والابتكار", community: "المجتمع", "student-life": "الحياة الطلابية", "digital-infrastructure": "البنية الرقمية" }, launch: "سنة الإطلاق", team: "الفريق", back: "كل المبادرات", language: "EN" },
};

function render(initiative, locale) {
  const isArabic = locale === "ar";
  const text = initiative[locale];
  const copy = labels[locale];
  const pagePath = isArabic ? `/ar/initiatives/${initiative.slug}/` : `/initiatives/${initiative.slug}/`;
  const alternate = isArabic ? `https://nexcorelabs.vercel.app/initiatives/${initiative.slug}/` : `https://nexcorelabs.vercel.app/ar/initiatives/${initiative.slug}/`;
  const title = isArabic ? `${text.name} | مبادرة من NexCore Labs` : `${text.name} | NexCore Labs Initiative`;
  const assets = "/assets";
  const back = isArabic ? "/ar/initiatives" : "/initiatives";
  const language = isArabic ? `/initiatives/${initiative.slug}/` : `/ar/initiatives/${initiative.slug}/`;
  return `<!DOCTYPE html>
<html lang="${locale}"${isArabic ? " dir=\"rtl\"" : ""}>
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="theme-color" content="#0a0b1c"><meta name="author" content="NexCore Labs">
  <title>${escape(title)}</title><meta name="description" content="${escape(text.summary)}">
  <link rel="canonical" href="https://nexcorelabs.vercel.app${pagePath}"><link rel="alternate" hreflang="${locale}" href="https://nexcorelabs.vercel.app${pagePath}"><link rel="alternate" hreflang="${isArabic ? "en" : "ar"}" href="${alternate}"><link rel="alternate" hreflang="x-default" href="https://nexcorelabs.vercel.app/initiatives/${initiative.slug}/">
  <meta property="og:url" content="https://nexcorelabs.vercel.app${pagePath}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(text.summary)}"><meta property="og:image" content="https://nexcorelabs.vercel.app/assets/images/nexcorelabs-og.png"><meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="${assets}/images/nexcore-icon.png" type="image/png"><link rel="stylesheet" href="${assets}/css/style.css">${isArabic ? `<link rel="stylesheet" href="${assets}/css/arabic.css">` : ""}<link rel="stylesheet" href="${assets}/css/initiatives.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"${escape(title)}","url":"https://nexcorelabs.vercel.app${pagePath}","description":"${escape(text.summary)}","inLanguage":"${locale}","isPartOf":{"@id":"https://nexcorelabs.vercel.app/#website"}}</script>
</head>
<body class="initiatives-page"><div class="background"><img class="logo-img" id="logoImg" src="${assets}/images/nexcore-logo.webp" alt="NexCore Labs logo"><div id="spotLight" class="spot-light"></div></div><header class="navbar"><div class="nav-container"><div class="logo"><h1>NexCore <span>Labs</span></h1></div><nav class="initiative-detail-nav" aria-label="${isArabic ? "التنقل في المبادرات" : "Initiative navigation"}"><a href="${back}"><i class="fa-solid ${isArabic ? "fa-arrow-right" : "fa-arrow-left"}" aria-hidden="true"></i><span>${copy.back}</span></a><a href="${language}"><span>${copy.language}</span></a></nav></div></header><main><section class="initiative-detail"><div class="initiatives-container"><article class="initiative-detail-shell"><span class="initiative-type"><i class="fa-solid ${escape(initiative.visual?.icon || "fa-lightbulb")}" aria-hidden="true"></i>${escape(copy.type[initiative.type])}</span><h1>${escape(text.name)}</h1><div class="initiative-badges"><span class="initiative-badge initiative-badge--${escape(initiative.status)}">${escape(copy.status[initiative.status])}</span>${initiative.communityDriven ? `<span class="initiative-badge initiative-badge--community"><i class="fa-solid fa-people-group" aria-hidden="true"></i>${isArabic ? "يقودها المجتمع" : "Community Driven"}</span>` : ""}</div><p>${escape(text.description)}</p><div class="initiative-detail-meta"><span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${copy.launch} ${initiative.launchYear}</span><span><i class="fa-solid fa-users" aria-hidden="true"></i>${copy.team}: ${escape(text.teamLabel)}</span><span><i class="fa-solid fa-tag" aria-hidden="true"></i>${escape(copy.category[initiative.category])}</span></div><a class="btn primary" href="${escape(initiative.links.primary)}" target="_blank" rel="noopener">${escape(text.primaryCta)} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></article></div></section></main><footer class="site-footer"><p>NexCore Labs © ${new Date().getFullYear()}</p></footer><script src="${assets}/js/script.js"></script></body></html>`;
}

for (const initiative of source.initiatives) {
  for (const locale of ["en", "ar"]) {
    const destination = locale === "ar"
      ? path.join(root, "ar", "initiatives", initiative.slug, "index.html")
      : path.join(root, "initiatives", initiative.slug, "index.html");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, render(initiative, locale));
  }
}

const { syncInitiativeShells } = require("./initiative-shells");
syncInitiativeShells();
console.log(`Built ${source.initiatives.length * 2} initiative detail page(s).`);
