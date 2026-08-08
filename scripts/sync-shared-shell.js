"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const excluded = new Set(["email-template.html"]);

function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", ".vercel"].includes(entry.name)) return [];
      return htmlFiles(fullPath);
    }
    return entry.name.endsWith(".html") && !excluded.has(entry.name) ? [fullPath] : [];
  });
}

function synchronize(file) {
  let html = fs.readFileSync(file, "utf8");
  const original = html;
  const isArabic = /[\\/]ar[\\/]/.test(file) || /<html[^>]+lang=["']ar/i.test(html);
  const menuLabel = isArabic ? "فتح القائمة" : "Open menu";
  const navLabel = isArabic ? "التنقل الرئيسي" : "Primary navigation";
  const skipLabel = isArabic ? "انتقل إلى المحتوى الرئيسي" : "Skip to main content";

  html = html.replace(
    /<div class="core-menu" id="coreMenu"[^>]*>([\s\S]*?<span class="dot"[^>]*><\/span>[\s\S]*?<span class="dot"[^>]*><\/span>[\s\S]*?<span class="dot"[^>]*><\/span>[\s\S]*?<span class="dot"[^>]*><\/span>[\s\S]*?<span class="dot"[^>]*><\/span>[\s\S]*?<span class="dot"[^>]*><\/span>[\s\S]*?)<\/div>/,
    `<button class="core-menu" id="coreMenu" type="button" aria-label="${menuLabel}" aria-expanded="false" aria-controls="myDropdown" title="${menuLabel}">$1</button>`
  );

  html = html.replace(
    /<button class="core-menu" id="coreMenu"(?![^>]*aria-expanded)[^>]*>/,
    (tag) => tag.replace(">", ` aria-expanded="false" aria-controls="myDropdown">`)
  );
  html = html.replace(/<h1 id="logo">([\s\S]*?)<\/h1>/, '<div id="logo" aria-label="NexCore Labs">$1</div>');
  html = html.replace(/<(div|header) class="navbar"(?![^>]*role=)/, `<$1 class="navbar" role="navigation" aria-label="${navLabel}"`);
  html = html.replace(/<main(?![^>]*id=)/, '<main id="main-content"');
  if (/<body[^>]*>/i.test(html) && !html.includes('class="skip-link"')) {
    html = html.replace(/(<body[^>]*>)/i, `$1\n  <a class="skip-link" href="#main-content">${skipLabel}</a>`);
  }
  // Paused products remain directly reachable, but not promoted in primary menus.
  html = html.replace(/\s*<a[^>]+class="[^"]*ai-link[^"]*"[^>]*>[\s\S]*?<\/a>/g, "");
  html = html.replace(/\s*<a[^>]+title="Pricing Plans"[^>]*>[\s\S]*?<\/a>/g, "");

  if (html !== original) fs.writeFileSync(file, html, "utf8");
  return html !== original;
}

const files = htmlFiles(root);
const changed = files.filter(synchronize);
console.log(`Shared shell synchronized: ${changed.length} changed, ${files.length} checked.`);
